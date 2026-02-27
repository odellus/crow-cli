import pytest
import tempfile
import os
from pathlib import Path

@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test structure
        os.makedirs(os.path.join(tmpdir, "subdir"))
        Path(os.path.join(tmpdir, "test.txt")).write_text("hello world")
        Path(os.path.join(tmpdir, "subdir", "nested.py")).write_text("print('hi')")
        yield tmpdir

def test_list_files_returns_directory_contents(temp_workspace):
    from crow.editor.api.files import list_files_sync

    result = list_files_sync(temp_workspace)

    names = [f["name"] for f in result["files"]]
    assert "test.txt" in names
    assert "subdir" in names

def test_list_files_identifies_directories(temp_workspace):
    from crow.editor.api.files import list_files_sync

    result = list_files_sync(temp_workspace)

    subdir = next(f for f in result["files"] if f["name"] == "subdir")
    assert subdir["is_directory"] == True

def test_file_details_returns_content(temp_workspace):
    from crow.editor.api.files import file_details_sync

    result = file_details_sync(os.path.join(temp_workspace, "test.txt"))

    assert result["contents"] == "hello world"

def test_file_details_binary_file(temp_workspace):
    from crow.editor.api.files import file_details_sync

    # Create binary file
    binary_path = os.path.join(temp_workspace, "binary.bin")
    with open(binary_path, "wb") as f:
        f.write(bytes([0, 1, 2, 255]))

    result = file_details_sync(binary_path)

    assert result["is_binary"] == True

def test_create_file(temp_workspace):
    from crow.editor.api.files import create_file_sync

    new_path = os.path.join(temp_workspace, "new.txt")
    create_file_sync(new_path, "new content")

    assert os.path.exists(new_path)
    assert Path(new_path).read_text() == "new content"

def test_delete_file(temp_workspace):
    from crow.editor.api.files import delete_file_sync

    target = os.path.join(temp_workspace, "test.txt")
    assert os.path.exists(target)

    delete_file_sync(target)

    assert not os.path.exists(target)

def test_update_file(temp_workspace):
    from crow.editor.api.files import update_file_sync

    target = os.path.join(temp_workspace, "test.txt")
    update_file_sync(target, "updated content")

    assert Path(target).read_text() == "updated content"

def test_path_traversal_blocked(temp_workspace):
    from crow.editor.api.files import list_files_sync

    # Attempting to escape workspace should fail
    with pytest.raises(ValueError, match="outside"):
        list_files_sync(temp_workspace, relative_path="../../../etc")
