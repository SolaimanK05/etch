"""Scanner — implemented in task 2.

Builds a grimp graph of root_package inside the given repo.
Layers are the direct child packages of root_package.
Aggregates direct imports between different layers, recording file and line.
"""
from __future__ import annotations

import importlib
import sys
import threading
from collections import defaultdict
from pathlib import Path

import grimp

from etch.models import ArchGraph, Dependency, ImportDetail, Layer

_graph_lock = threading.Lock()

_SKIP_NAMES = {"tests", "test", "docs"}


class ScanError(Exception):
    """Repo or package can't be scanned (missing package, unparsable source)."""


def detect_root_package(repo_path: Path) -> str:
    """Return the single top-level Python package under *repo_path*.

    Considers direct subdirectories that contain ``__init__.py``, skipping
    ``tests``, ``test``, ``docs``, names starting with ``.`` or ``_``, and
    names that are not valid Python identifiers.

    Raises:
        ScanError: if the number of qualifying packages is not exactly one.
    """
    candidates = [
        d.name
        for d in repo_path.iterdir()
        if d.is_dir()
        and (d / "__init__.py").is_file()
        and d.name not in _SKIP_NAMES
        and not d.name.startswith(".")
        and not d.name.startswith("_")
        and d.name.isidentifier()
    ]
    if len(candidates) == 1:
        return candidates[0]
    raise ScanError(
        f"found {len(candidates)} top-level packages in {repo_path}, pass root_package"
    )


def scan_repo(repo_path: Path, root_package: str) -> ArchGraph:
    """Build an ArchGraph by scanning *root_package* inside *repo_path*.

    Uses grimp to resolve all imports. Layers are the direct child packages of
    *root_package*. Each cross-layer import is recorded as an ImportDetail
    (file path, 1-based line number, stripped source line).

    Raises:
        ScanError: if the package is missing or grimp fails to parse the source.
    """
    # 1. Check the package exists.
    if not (repo_path / root_package / "__init__.py").is_file():
        raise ScanError(f"package {root_package!r} not found in {repo_path}")

    # 2. Build the graph under a lock (grimp mutates sys.path).
    with _graph_lock:
        sys.path.insert(0, str(repo_path))
        importlib.invalidate_caches()
        try:
            graph = grimp.build_graph(root_package, cache_dir=None)
        except Exception as exc:
            raise ScanError(str(exc)) from exc
        finally:
            sys.path.remove(str(repo_path))
            importlib.invalidate_caches()

    # 3. Find layers: direct child packages only.
    layers: list[Layer] = []
    for child in graph.find_children(root_package):
        child_path = Path(*child.split("."))
        layer_dir = repo_path / child_path
        if (layer_dir / "__init__.py").is_file():
            file_count = len(list(layer_dir.rglob("*.py")))
            layers.append(Layer(id=child.split(".")[-1], module=child, files=file_count))
    layers.sort(key=lambda l: l.id)

    # 4. Build a module -> layer mapping.
    def module_layer(module: str) -> str | None:
        for layer in layers:
            if module == layer.module or module.startswith(layer.module + "."):
                return layer.id
        return None

    # 5 & 6. Collect and aggregate dependencies.
    dep_imports: dict[tuple[str, str], list[ImportDetail]] = defaultdict(list)

    for module in graph.modules:
        src_layer = module_layer(module)
        if src_layer is None:
            continue
        for imported in graph.find_modules_directly_imported_by(module):
            tgt_layer = module_layer(imported)
            if tgt_layer is None or tgt_layer == src_layer:
                continue
            for detail in graph.get_import_details(importer=module, imported=imported):
                # Compute repo-relative POSIX file path for the importer.
                parts = detail["importer"].split(".")
                if (repo_path / Path(*parts) / "__init__.py").is_file():
                    file_path = "/".join(parts) + "/__init__.py"
                else:
                    file_path = "/".join(parts[:-1]) + "/" + parts[-1] + ".py"
                dep_imports[(src_layer, tgt_layer)].append(
                    ImportDetail(
                        importer=detail["importer"],
                        imported=detail["imported"],
                        file=file_path,
                        line=detail["line_number"],
                        code=detail["line_contents"].strip(),
                    )
                )

    # Sort imports within each dependency by (file, line).
    dependencies: list[Dependency] = []
    for (src, tgt), imports in dep_imports.items():
        imports.sort(key=lambda i: (i.file, i.line))
        dependencies.append(Dependency(source=src, target=tgt, imports=imports))
    dependencies.sort(key=lambda d: (d.source, d.target))

    return ArchGraph(root_package=root_package, layers=layers, dependencies=dependencies)
