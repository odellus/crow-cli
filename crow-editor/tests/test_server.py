import pytest
import tempfile
import os
from pathlib import Path
from starlette.testclient import TestClient

@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test structure
        os.makedirs(os.path.join(tmpdir, "subdir"))
        Path(os.path.join(tmpdir, "test.txt")).write_text("hello world")
        Path(os.path.join(tmpdir, "subdir", "nested.py")).write_text("print('hi')")
        yield tmpdir

@pytest.fixture
def client(temp_workspace, monkeypatch):
    monkeypatch.setenv("CROW_WORKSPACE", temp_workspace)
    from crow.editor.server import app
    return TestClient(app)

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_list_files_endpoint(client, temp_workspace):
    response = client.post("/api/files/list", json={"path": temp_workspace})
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    names = [f["name"] for f in data["files"]]
    assert "test.txt" in names

def test_file_details_endpoint(client, temp_workspace):
    file_path = os.path.join(temp_workspace, "test.txt")
    response = client.post("/api/files/details", json={"path": file_path})
    assert response.status_code == 200
    data = response.json()
    assert data["contents"] == "hello world"

def test_create_file_endpoint(client, temp_workspace):
    new_path = os.path.join(temp_workspace, "new_file.txt")
    response = client.post("/api/files/create", json={
        "path": new_path,
        "contents": "new content"
    })
    assert response.status_code == 200
    assert Path(new_path).read_text() == "new content"

def test_update_file_endpoint(client, temp_workspace):
    file_path = os.path.join(temp_workspace, "test.txt")
    response = client.post("/api/files/update", json={
        "path": file_path,
        "contents": "updated content"
    })
    assert response.status_code == 200
    assert Path(file_path).read_text() == "updated content"

def test_delete_file_endpoint(client, temp_workspace):
    file_path = os.path.join(temp_workspace, "test.txt")
    assert Path(file_path).exists()
    response = client.post("/api/files/delete", json={"path": file_path})
    assert response.status_code == 200
    assert not Path(file_path).exists()

def test_terminal_websocket_connects(client):
    # Skip actual terminal test in CI - PTY requires forking
    # Just verify the endpoint is registered
    from crow.editor.server import app
    routes = [r.path for r in app.routes]
    assert "/terminal" in routes

def test_acp_websocket_connects(client):
    # Skip actual ACP test - requires subprocess
    # Just verify the endpoint is registered
    from crow.editor.server import app
    routes = [r.path for r in app.routes]
    assert "/acp" in routes
