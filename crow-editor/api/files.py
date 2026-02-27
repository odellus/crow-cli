"""
File API - File operations for Crow IDE.

Provides synchronous file operations for listing, reading, creating,
updating, and deleting files within a workspace.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional


def _validate_path(base_path: str, relative_path: Optional[str] = None) -> Path:
    """Validate that the path is within the workspace.

    Args:
        base_path: The workspace root path.
        relative_path: Optional relative path within workspace.

    Returns:
        Resolved absolute path.

    Raises:
        ValueError: If path escapes the workspace.
    """
    base = Path(base_path).resolve()
    if relative_path:
        full_path = (base / relative_path).resolve()
    else:
        full_path = base

    # Ensure path is within workspace
    try:
        full_path.relative_to(base)
    except ValueError:
        raise ValueError(f"Path {full_path} is outside workspace {base}")

    return full_path


def list_files_sync(workspace: str, relative_path: Optional[str] = None) -> Dict[str, Any]:
    """List files in a directory.

    Args:
        workspace: The workspace root path.
        relative_path: Optional relative path within workspace.

    Returns:
        Dictionary with 'files' key containing list of file info dicts.
    """
    target_path = _validate_path(workspace, relative_path)

    files = []
    for entry in os.scandir(target_path):
        files.append({
            "name": entry.name,
            "path": str(Path(entry.path).resolve()),
            "is_directory": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0,
        })

    # Sort directories first, then by name
    files.sort(key=lambda f: (not f["is_directory"], f["name"].lower()))

    return {"files": files}


def file_details_sync(file_path: str) -> Dict[str, Any]:
    """Get details and contents of a file.

    Args:
        file_path: Absolute path to the file.

    Returns:
        Dictionary with file details including contents.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    stat = path.stat()

    # Check if file is binary
    is_binary = False
    contents = ""

    try:
        # Try to read as text
        with open(path, 'r', encoding='utf-8') as f:
            contents = f.read()
    except UnicodeDecodeError:
        is_binary = True

    return {
        "name": path.name,
        "path": str(path),
        "size": stat.st_size,
        "is_binary": is_binary,
        "contents": contents if not is_binary else None,
    }


def create_file_sync(file_path: str, contents: str = "") -> Dict[str, Any]:
    """Create a new file.

    Args:
        file_path: Absolute path for the new file.
        contents: Initial contents for the file.

    Returns:
        Dictionary with success status.
    """
    path = Path(file_path)

    # Create parent directories if needed
    path.parent.mkdir(parents=True, exist_ok=True)

    # Write the file
    path.write_text(contents, encoding='utf-8')

    return {"success": True, "path": str(path)}


def delete_file_sync(file_path: str) -> Dict[str, Any]:
    """Delete a file.

    Args:
        file_path: Absolute path to the file to delete.

    Returns:
        Dictionary with success status.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.is_dir():
        import shutil
        shutil.rmtree(path)
    else:
        path.unlink()

    return {"success": True}


def update_file_sync(file_path: str, contents: str) -> Dict[str, Any]:
    """Update file contents.

    Args:
        file_path: Absolute path to the file.
        contents: New contents for the file.

    Returns:
        Dictionary with success status.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    path.write_text(contents, encoding='utf-8')

    return {"success": True}
