"""Static checks on the CI gate workflow (task 3). Real validation happens on GitHub."""
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "etch-architecture.yml"


def test_workflow_gates_prs_with_lint_imports_on_demo_app():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "pull_request" in text
    assert "working-directory: demo-app" in text
    assert "import-linter==2.15" in text
    assert "lint-imports --no-cache" in text
    # skip the gate until "Etch it" has written demo-app/.importlinter
    assert "hashFiles('demo-app/.importlinter')" in text


def test_workflow_runs_backend_and_demo_app_tests():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "pip install -e backend[dev]" in text or 'pip install -e "backend[dev]"' in text
    assert "pytest -q backend" in text
    assert "pytest -q demo-app" in text
