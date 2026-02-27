"""
Playwright E2E Test Harness for Crow IDE

This module provides a test harness that:
1. Sets up test repositories (local or cloned)
2. Provides test fixtures for different difficulty levels
3. Interacts with Karla through the Crow IDE UI via Playwright
"""

import os
import json
import tempfile
import subprocess
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from enum import Enum


class Difficulty(Enum):
    """Test difficulty levels"""
    TRIVIAL = 1      # File listing, simple read
    EASY = 2         # Code reading, explanation
    MEDIUM = 3       # Code modification, docstrings
    HARD = 4         # Bug fixing, refactoring
    EXPERT = 5       # Feature implementation, architecture


@dataclass
class TestRepo:
    """Represents a test repository configuration"""
    name: str
    description: str
    difficulty: Difficulty
    setup_func: Optional[callable] = None
    clone_url: Optional[str] = None

    def create_in(self, base_dir: Path) -> Path:
        """Create or clone the repo in the given directory"""
        repo_path = base_dir / self.name

        if self.clone_url:
            subprocess.run(
                ["git", "clone", "--depth=1", self.clone_url, str(repo_path)],
                check=True,
                capture_output=True
            )
        else:
            repo_path.mkdir(parents=True, exist_ok=True)

        if self.setup_func:
            self.setup_func(repo_path)

        return repo_path


@dataclass
class TestChallenge:
    """A specific challenge for the agent to solve"""
    name: str
    description: str
    difficulty: Difficulty
    prompt: str
    success_criteria: List[str]
    timeout_seconds: int = 300
    repo: Optional[str] = None

    def verify_success(self, workspace_path: Path, response: str) -> tuple[bool, str]:
        """Verify if the challenge was completed successfully"""
        for criterion in self.success_criteria:
            if criterion.startswith("file_exists:"):
                filepath = workspace_path / criterion.split(":", 1)[1]
                if not filepath.exists():
                    return False, f"File {filepath} does not exist"
            elif criterion.startswith("file_contains:"):
                parts = criterion.split(":", 2)
                filepath = workspace_path / parts[1]
                expected = parts[2]
                if not filepath.exists():
                    return False, f"File {filepath} does not exist"
                if expected not in filepath.read_text():
                    return False, f"File {filepath} does not contain '{expected}'"
            elif criterion.startswith("response_contains:"):
                expected = criterion.split(":", 1)[1]
                if expected.lower() not in response.lower():
                    return False, f"Response does not contain '{expected}'"
            elif criterion.startswith("no_error"):
                if "error" in response.lower() and "no error" not in response.lower():
                    return False, "Response contains error"
        return True, "All criteria met"


# =============================================================================
# Pre-defined Test Repositories (as Python functions instead of shell scripts)
# =============================================================================

def setup_simple_python_repo(repo_path: Path):
    """Set up a simple Python repository"""
    src_dir = repo_path / "src"
    tests_dir = repo_path / "tests"
    src_dir.mkdir(parents=True, exist_ok=True)
    tests_dir.mkdir(parents=True, exist_ok=True)

    (src_dir / "greeting.py").write_text('''"""A simple greeting module."""

def greet(name: str) -> str:
    """Return a greeting for the given name."""
    return f"Hello, {name}!"

def farewell(name: str) -> str:
    """Return a farewell for the given name."""
    return f"Goodbye, {name}!"

if __name__ == "__main__":
    print(greet("World"))
''')

    (tests_dir / "test_greeting.py").write_text('''"""Tests for greeting module."""
import pytest
from src.greeting import greet, farewell

def test_greet():
    assert greet("Alice") == "Hello, Alice!"

def test_farewell():
    assert farewell("Bob") == "Goodbye, Bob!"
''')

    (repo_path / "README.md").write_text('''# Simple Python Project

A basic Python project for testing.

## Usage

```python
from src.greeting import greet
print(greet("World"))
```
''')

    (repo_path / "pyproject.toml").write_text('''[project]
name = "simple-python"
version = "0.1.0"
''')


def setup_flask_api_repo(repo_path: Path):
    """Set up a Flask REST API repo with real issues to fix"""
    src_dir = repo_path / "app"
    tests_dir = repo_path / "tests"
    src_dir.mkdir(parents=True, exist_ok=True)
    tests_dir.mkdir(parents=True, exist_ok=True)

    (src_dir / "__init__.py").write_text('''"""Flask API Application"""
from flask import Flask

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev-key-change-in-prod'

    from . import routes
    app.register_blueprint(routes.bp)

    return app
''')

    (src_dir / "routes.py").write_text('''"""API Routes - has issues that need fixing"""
from flask import Blueprint, jsonify, request, abort

bp = Blueprint('api', __name__, url_prefix='/api')

# In-memory storage (should use database)
users = {}
next_id = 1

@bp.route('/users', methods=['GET'])
def list_users():
    return jsonify(list(users.values()))

@bp.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    # BUG: No 404 handling
    return jsonify(users[user_id])

@bp.route('/users', methods=['POST'])
def create_user():
    global next_id
    data = request.json
    # BUG: No validation of required fields
    user = {
        'id': next_id,
        'name': data['name'],
        'email': data['email']
    }
    users[next_id] = user
    next_id += 1
    return jsonify(user), 201

@bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    # BUG: No check if user exists
    data = request.json
    users[user_id].update(data)
    return jsonify(users[user_id])

@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    # BUG: No error handling
    del users[user_id]
    return '', 204
''')

    (src_dir / "models.py").write_text('''"""Data models - needs SQLAlchemy integration"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }
''')

    (tests_dir / "test_routes.py").write_text('''"""API route tests"""
import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_list_users_empty(client):
    response = client.get('/api/users')
    assert response.status_code == 200
    assert response.json == []

def test_create_user(client):
    response = client.post('/api/users', json={
        'name': 'Alice',
        'email': 'alice@example.com'
    })
    assert response.status_code == 201
    assert response.json['name'] == 'Alice'

# TODO: Add more tests for error cases
''')

    (repo_path / "requirements.txt").write_text('''flask>=2.0
pytest>=7.0
''')

    (repo_path / "README.md").write_text('''# Flask REST API

A simple REST API with user management.

## Issues to Fix
- GET /users/<id> returns 500 on missing user (should be 404)
- POST /users doesn\'t validate required fields
- PUT /users/<id> crashes if user doesn\'t exist
- DELETE /users/<id> crashes if user doesn\'t exist
- No input sanitization

## Run
```bash
flask run
```

## Test
```bash
pytest
```
''')


def setup_todo_app_repo(repo_path: Path):
    """Set up a simple TODO app repository"""
    src_dir = repo_path / "src"
    src_dir.mkdir(parents=True, exist_ok=True)

    (src_dir / "todo.py").write_text('''"""Simple TODO application."""
from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime

@dataclass
class Todo:
    id: int
    title: str
    completed: bool = False
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

class TodoApp:
    def __init__(self):
        self._todos: List[Todo] = []
        self._next_id = 1

    def add(self, title: str) -> Todo:
        todo = Todo(id=self._next_id, title=title)
        self._todos.append(todo)
        self._next_id += 1
        return todo

    def get(self, todo_id: int) -> Optional[Todo]:
        for todo in self._todos:
            if todo.id == todo_id:
                return todo
        return None

    def complete(self, todo_id: int) -> bool:
        todo = self.get(todo_id)
        if todo:
            todo.completed = True
            return True
        return False

    def list_all(self) -> List[Todo]:
        return self._todos.copy()

    def list_pending(self) -> List[Todo]:
        return [t for t in self._todos if not t.completed]

    def delete(self, todo_id: int) -> bool:
        for i, todo in enumerate(self._todos):
            if todo.id == todo_id:
                self._todos.pop(i)
                return True
        return False
''')

    (repo_path / "README.md").write_text('''# TODO Application

A simple TODO management application.

## Features
- Add todos
- Mark as complete
- List all/pending
- Delete todos

## Missing Features
- Update todo title
- Due dates
- Priority levels
''')


# =============================================================================
# Test Repositories Registry
# =============================================================================

TEST_REPOS: Dict[str, TestRepo] = {
    "simple-python": TestRepo(
        name="simple-python",
        description="Simple Python project for basic tests",
        difficulty=Difficulty.TRIVIAL,
        setup_func=setup_simple_python_repo,
    ),
    "flask-api": TestRepo(
        name="flask-api",
        description="Flask REST API with bugs to fix",
        difficulty=Difficulty.MEDIUM,
        setup_func=setup_flask_api_repo,
    ),
    "todo-app": TestRepo(
        name="todo-app",
        description="TODO app needing features",
        difficulty=Difficulty.HARD,
        setup_func=setup_todo_app_repo,
    ),
    # Real open source repos to clone
    "httpie": TestRepo(
        name="httpie",
        description="HTTPie CLI - real codebase",
        difficulty=Difficulty.EXPERT,
        clone_url="https://github.com/httpie/cli.git",
    ),
    "rich": TestRepo(
        name="rich",
        description="Rich terminal formatting library",
        difficulty=Difficulty.HARD,
        clone_url="https://github.com/Textualize/rich.git",
    ),
}


# =============================================================================
# Test Challenges by Difficulty
# =============================================================================

CHALLENGES: List[TestChallenge] = [
    # TRIVIAL - Level 1
    TestChallenge(
        name="list_files",
        description="List all Python files in the project",
        difficulty=Difficulty.TRIVIAL,
        prompt="List all the Python files in this project",
        success_criteria=["response_contains:greeting.py", "response_contains:.py"],
        timeout_seconds=120,
        repo="simple-python",
    ),
    TestChallenge(
        name="read_readme",
        description="Read and summarize the README",
        difficulty=Difficulty.TRIVIAL,
        prompt="Read the README.md and tell me what this project does",
        success_criteria=["response_contains:python", "no_error"],
        timeout_seconds=120,
        repo="simple-python",
    ),

    # EASY - Level 2
    TestChallenge(
        name="explain_function",
        description="Explain what a function does",
        difficulty=Difficulty.EASY,
        prompt="Read src/greeting.py and explain what the greet function does",
        success_criteria=["response_contains:hello", "response_contains:name"],
        timeout_seconds=180,
        repo="simple-python",
    ),
    TestChallenge(
        name="find_tests",
        description="Find and describe the tests",
        difficulty=Difficulty.EASY,
        prompt="Find the test files and tell me what they test",
        success_criteria=["response_contains:test", "response_contains:greet"],
        timeout_seconds=180,
        repo="simple-python",
    ),

    # MEDIUM - Level 3: Real API bug fixes
    TestChallenge(
        name="fix_404_handling",
        description="Fix missing 404 error handling in Flask API",
        difficulty=Difficulty.MEDIUM,
        prompt="Fix get_user in app/routes.py to return 404 when user not found instead of crashing",
        success_criteria=[
            "file_contains:app/routes.py:404",
        ],
        timeout_seconds=300,
        repo="flask-api",
    ),
    TestChallenge(
        name="add_input_validation",
        description="Add input validation to API endpoint",
        difficulty=Difficulty.MEDIUM,
        prompt="Add validation to create_user in app/routes.py - return 400 if name or email is missing from request",
        success_criteria=[
            "file_contains:app/routes.py:400",
        ],
        timeout_seconds=300,
        repo="flask-api",
    ),

    # HARD - Level 4: Feature implementation
    TestChallenge(
        name="add_search_endpoint",
        description="Add search endpoint to Flask API",
        difficulty=Difficulty.HARD,
        prompt="Add GET /api/users/search endpoint to app/routes.py that filters users by name using 'q' query param",
        success_criteria=[
            "file_contains:app/routes.py:search",
        ],
        timeout_seconds=360,
        repo="flask-api",
    ),
    TestChallenge(
        name="add_pagination",
        description="Add pagination to list endpoint",
        difficulty=Difficulty.HARD,
        prompt="Add pagination to list_users in app/routes.py - accept page and per_page query params",
        success_criteria=[
            "file_contains:app/routes.py:page",
        ],
        timeout_seconds=360,
        repo="flask-api",
    ),

    # EXPERT - Level 5
    TestChallenge(
        name="add_delete_method",
        description="Add delete functionality to TODO app",
        difficulty=Difficulty.EXPERT,
        prompt="Add a delete method to the TodoApp class in src/todo.py that removes a todo by ID and returns True if found, False otherwise",
        success_criteria=[
            "file_contains:src/todo.py:def delete",
            "file_contains:src/todo.py:todo_id",
        ],
        timeout_seconds=420,
        repo="todo-app",
    ),
    TestChallenge(
        name="add_priority",
        description="Add priority to TODO items",
        difficulty=Difficulty.EXPERT,
        prompt="Add a priority field (high/medium/low) to the Todo dataclass and a method to list todos sorted by priority",
        success_criteria=[
            "file_contains:src/todo.py:priority",
            "file_contains:src/todo.py:high",
        ],
        timeout_seconds=420,
        repo="todo-app",
    ),
]


def get_challenges_by_difficulty(difficulty: Difficulty) -> List[TestChallenge]:
    """Get all challenges of a specific difficulty level"""
    return [c for c in CHALLENGES if c.difficulty == difficulty]


def get_all_challenges_sorted() -> List[TestChallenge]:
    """Get all challenges sorted by difficulty"""
    return sorted(CHALLENGES, key=lambda c: c.difficulty.value)


class TestHarness:
    """Main test harness class for running E2E tests"""

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(tempfile.mkdtemp(prefix="crow_e2e_"))
        self.repos: Dict[str, Path] = {}

    def setup_repo(self, repo_name: str) -> Path:
        """Set up a test repository"""
        if repo_name in self.repos:
            return self.repos[repo_name]

        if repo_name not in TEST_REPOS:
            raise ValueError(f"Unknown repo: {repo_name}")

        repo_config = TEST_REPOS[repo_name]
        repo_path = repo_config.create_in(self.base_dir)
        self.repos[repo_name] = repo_path
        return repo_path

    def cleanup(self):
        """Clean up test repositories"""
        if self.base_dir.exists():
            shutil.rmtree(self.base_dir)

    def get_challenge(self, name: str) -> Optional[TestChallenge]:
        """Get a challenge by name"""
        for challenge in CHALLENGES:
            if challenge.name == name:
                return challenge
        return None


if __name__ == "__main__":
    # Print available challenges
    print("Available E2E Test Challenges:")
    print("=" * 60)

    for difficulty in Difficulty:
        challenges = get_challenges_by_difficulty(difficulty)
        if challenges:
            print(f"\n{difficulty.name} (Level {difficulty.value}):")
            for c in challenges:
                print(f"  - {c.name}: {c.description}")
                print(f"    Repo: {c.repo}")
