"""Scanner tests against tests/fixtures/fixrepo/fixpkg (task 2)."""
import shutil
import sys
from pathlib import Path

import pytest

from etch.models import ImportDetail
from etch.scanner import ScanError, detect_root_package, scan_repo

FIXREPO = Path(__file__).parent / "fixtures" / "fixrepo"


def deps_by_pair(graph):
    return {(d.source, d.target): d for d in graph.dependencies}


def test_layers_are_direct_child_packages_only():
    graph = scan_repo(FIXREPO, "fixpkg")
    assert graph.root_package == "fixpkg"
    # fixpkg/util.py is a plain module, not a package, so it is not a layer
    assert [(layer.id, layer.module) for layer in graph.layers] == [
        ("api", "fixpkg.api"),
        ("db", "fixpkg.db"),
        ("notifications", "fixpkg.notifications"),
        ("services", "fixpkg.services"),
    ]


def test_dependencies_sorted_and_aggregated_per_layer_pair():
    graph = scan_repo(FIXREPO, "fixpkg")
    assert [(d.source, d.target, len(d.imports)) for d in graph.dependencies] == [
        ("api", "db", 2),
        ("api", "services", 1),
        ("services", "db", 1),
    ]


def test_import_details_have_file_line_and_code():
    graph = scan_repo(FIXREPO, "fixpkg")
    assert deps_by_pair(graph)[("api", "db")].imports == [
        # lazy import inside a function body counts too
        ImportDetail(
            importer="fixpkg.api.admin",
            imported="fixpkg.db.repo",
            file="fixpkg/api/admin.py",
            line=2,
            code="import fixpkg.db.repo",
        ),
        ImportDetail(
            importer="fixpkg.api.routes",
            imported="fixpkg.db.repo",
            file="fixpkg/api/routes.py",
            line=2,
            code="from fixpkg.db import repo",
        ),
    ]


def test_missing_package_raises_scan_error():
    with pytest.raises(ScanError):
        scan_repo(FIXREPO, "nopkg")


def test_sys_path_is_restored():
    before = list(sys.path)
    scan_repo(FIXREPO, "fixpkg")
    assert sys.path == before


def test_rescan_sees_edits_in_a_different_copy(tmp_path):
    # Same package name at a new path, then edited: results must reflect
    # the new files (no stale grimp cache, sys.path or sys.modules state).
    scan_repo(FIXREPO, "fixpkg")
    repo = tmp_path / "repo"
    shutil.copytree(FIXREPO, repo)
    routes = repo / "fixpkg" / "api" / "routes.py"
    routes.write_text(
        "from fixpkg.services.users import get_user\n\n\n"
        "def user_route(user_id: int) -> dict:\n"
        "    return {'name': get_user(user_id)}\n",
        encoding="utf-8",
    )
    graph = scan_repo(repo, "fixpkg")
    api_db = deps_by_pair(graph)[("api", "db")]
    assert [(i.file, i.line) for i in api_db.imports] == [("fixpkg/api/admin.py", 2)]


def test_layers_count_python_files_recursively():
    graph = scan_repo(FIXREPO, "fixpkg")
    assert {layer.id: layer.files for layer in graph.layers} == {
        "api": 3,            # __init__, routes, admin
        "db": 2,             # __init__, repo
        "notifications": 1,  # __init__
        "services": 2,       # __init__, users
    }


def test_detect_root_package_finds_the_single_top_level_package():
    assert detect_root_package(FIXREPO) == "fixpkg"
    assert detect_root_package(Path(__file__).resolve().parents[2] / "demo-app") == "shop"


def test_detect_root_package_ignores_tests_docs_hidden_and_non_identifiers(tmp_path):
    for name in ("shop", "tests", "docs", ".cache", "_build", "not-a-pkg"):
        (tmp_path / name).mkdir()
        (tmp_path / name / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "plain_dir").mkdir()  # no __init__.py: not a package
    assert detect_root_package(tmp_path) == "shop"


def test_detect_root_package_errors_on_zero_or_many(tmp_path):
    with pytest.raises(ScanError):
        detect_root_package(tmp_path)
    for name in ("alpha", "beta"):
        (tmp_path / name).mkdir()
        (tmp_path / name / "__init__.py").write_text("", encoding="utf-8")
    with pytest.raises(ScanError):
        detect_root_package(tmp_path)
