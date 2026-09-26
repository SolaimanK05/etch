"""Violation engine tests (task 2). Pure: builds ArchGraph by hand."""
from etch.models import ArchGraph, Arrow, Dependency, Drawing, ImportDetail, Layer
from etch.violations import find_violations


def imp(importer: str, imported: str, line: int) -> ImportDetail:
    return ImportDetail(
        importer=f"shop.{importer}",
        imported=f"shop.{imported}",
        file=f"shop/{importer.replace('.', '/')}.py",
        line=line,
        code=f"import shop.{imported}",
    )


GRAPH = ArchGraph(
    root_package="shop",
    layers=[Layer(id=i, module=f"shop.{i}") for i in ("api", "db", "notifications", "services")],
    dependencies=[
        Dependency(source="api", target="db", imports=[imp("api.routes", "db.repo", 3)]),
        Dependency(source="api", target="notifications", imports=[imp("api.routes", "notifications.email", 4)]),
        Dependency(source="api", target="services", imports=[imp("api.routes", "services.users", 1)]),
        Dependency(source="services", target="db", imports=[imp("services.users", "db.repo", 1)]),
    ],
)

ALL = ["api", "services", "db", "notifications"]


def pairs(violations):
    return [(v.source, v.target) for v in violations]


def test_undrawn_arrows_between_drawn_boxes_are_violations():
    drawing = Drawing(
        layers=ALL,
        arrows=[Arrow(source="api", target="services"), Arrow(source="services", target="db")],
    )
    violations = find_violations(GRAPH, drawing)
    assert pairs(violations) == [("api", "db"), ("api", "notifications")]
    assert violations[0].imports == GRAPH.dependencies[0].imports


def test_drawn_arrow_allows_dependency():
    arrows = [Arrow(source=s, target=t) for s, t in [("api", "services"), ("services", "db"), ("api", "db"), ("api", "notifications")]]
    assert find_violations(GRAPH, Drawing(layers=ALL, arrows=arrows)) == []


def test_arrow_direction_matters():
    drawing = Drawing(
        layers=ALL,
        arrows=[
            Arrow(source="api", target="services"),
            Arrow(source="services", target="db"),
            Arrow(source="notifications", target="api"),
            Arrow(source="db", target="api"),
        ],
    )
    assert pairs(find_violations(GRAPH, drawing)) == [("api", "db"), ("api", "notifications")]


def test_dependencies_touching_undrawn_boxes_are_ignored():
    drawing = Drawing(layers=["api", "services"], arrows=[Arrow(source="api", target="services")])
    assert find_violations(GRAPH, drawing) == []


def test_empty_drawing_has_no_violations():
    assert find_violations(GRAPH, Drawing(layers=[], arrows=[])) == []
