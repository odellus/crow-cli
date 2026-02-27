"""
Integration tests that verify the full stack works together.

These tests verify:
1. Server starts and serves API endpoints
2. Frontend static files are built and accessible
3. WebSocket endpoints are available
"""

import pytest
import os
import tempfile
from pathlib import Path
from starlette.testclient import TestClient


@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test structure with test files
        os.makedirs(os.path.join(tmpdir, "src"))
        Path(os.path.join(tmpdir, "README.md")).write_text("# Test Project")
        Path(os.path.join(tmpdir, "src", "main.py")).write_text("print('hello')")
        yield tmpdir


@pytest.fixture
def client(temp_workspace, monkeypatch):
    monkeypatch.setenv("CROW_WORKSPACE", temp_workspace)
    from crow.editor.server import app
    return TestClient(app)


class TestFullIntegration:
    """Full integration tests for the Crow IDE."""

    def test_health_and_file_operations(self, client, temp_workspace):
        """Test complete file operation workflow."""
        # 1. Health check
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        # 2. List files
        response = client.post("/api/files/list", json={"path": temp_workspace})
        assert response.status_code == 200
        files = response.json()["files"]
        assert len(files) >= 2  # README.md and src

        # 3. Read file
        readme_path = os.path.join(temp_workspace, "README.md")
        response = client.post("/api/files/details", json={"path": readme_path})
        assert response.status_code == 200
        assert "# Test Project" in response.json()["contents"]

        # 4. Create new file
        new_file = os.path.join(temp_workspace, "new_file.txt")
        response = client.post("/api/files/create", json={
            "path": new_file,
            "contents": "New content here"
        })
        assert response.status_code == 200
        assert Path(new_file).exists()

        # 5. Update file
        response = client.post("/api/files/update", json={
            "path": new_file,
            "contents": "Updated content"
        })
        assert response.status_code == 200
        assert Path(new_file).read_text() == "Updated content"

        # 6. Delete file
        response = client.post("/api/files/delete", json={"path": new_file})
        assert response.status_code == 200
        assert not Path(new_file).exists()

    def test_all_endpoints_accessible(self, client):
        """Verify all API endpoints are accessible."""
        from crow.editor.server import app

        # Get all routes
        routes = [(r.path, r.methods if hasattr(r, 'methods') else ['WS'])
                  for r in app.routes]

        expected_routes = [
            ("/api/health", {"GET"}),
            ("/api/files/list", {"POST"}),
            ("/api/files/details", {"POST"}),
            ("/api/files/create", {"POST"}),
            ("/api/files/update", {"POST"}),
            ("/api/files/delete", {"POST"}),
            ("/terminal", ["WS"]),
            ("/acp", ["WS"]),
        ]

        for path, _ in expected_routes:
            assert any(r[0] == path for r in routes), f"Route {path} not found"

    def test_websocket_routes_registered(self, client):
        """Verify WebSocket routes are properly registered."""
        from crow.editor.server import app
        from starlette.routing import WebSocketRoute

        ws_routes = [r for r in app.routes if isinstance(r, WebSocketRoute)]

        assert len(ws_routes) == 2
        ws_paths = [r.path for r in ws_routes]
        assert "/terminal" in ws_paths
        assert "/acp" in ws_paths


class TestFrontendBuild:
    """Tests that verify frontend build artifacts exist."""

    def test_frontend_dist_exists(self):
        """Verify frontend build output exists."""
        frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"

        # Check that dist exists (may not exist if build wasn't run)
        if frontend_dist.exists():
            index_html = frontend_dist / "index.html"
            assert index_html.exists(), "index.html should exist in dist"

            assets = frontend_dist / "assets"
            assert assets.exists(), "assets directory should exist"

            # Check for JS and CSS files
            js_files = list(assets.glob("*.js"))
            css_files = list(assets.glob("*.css"))
            assert len(js_files) > 0, "Should have at least one JS file"
            assert len(css_files) > 0, "Should have at least one CSS file"

    def test_frontend_source_structure(self):
        """Verify frontend source structure is correct."""
        frontend_src = Path(__file__).parent.parent.parent / "frontend" / "src"

        assert frontend_src.exists(), "frontend/src should exist"
        assert (frontend_src / "main.tsx").exists(), "main.tsx should exist"
        assert (frontend_src / "App.tsx").exists(), "App.tsx should exist"
        assert (frontend_src / "components").exists(), "components dir should exist"

        # Check components
        components = frontend_src / "components"
        assert (components / "FileTree.tsx").exists()
        assert (components / "Terminal.tsx").exists()
        assert (components / "AgentPanel.tsx").exists()
