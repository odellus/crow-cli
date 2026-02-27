"""
Playwright E2E Tests for Karla Agent in Crow IDE

These tests use Playwright to interact with the Crow IDE UI
and verify that Karla can complete coding tasks of increasing difficulty.

Usage:
    pytest tests/e2e/test_agent_e2e.py -v --timeout=600
"""

import pytest
import time
import tempfile
import os
from pathlib import Path
from playwright.sync_api import Page, expect, TimeoutError as PlaywrightTimeout

from .playwright_harness import (
    TestHarness,
    TestChallenge,
    Difficulty,
    get_challenges_by_difficulty,
    get_all_challenges_sorted,
    CHALLENGES,
)


# Test configuration
CROW_IDE_URL = os.environ.get("CROW_IDE_URL", "http://localhost:8000")
AGENT_TIMEOUT_MS = 600_000  # 10 minutes for slow local LLM
MESSAGE_CHECK_INTERVAL_MS = 5_000


class CrowIDEPage:
    """Page object for interacting with Crow IDE"""

    def __init__(self, page: Page):
        self.page = page

    def navigate(self):
        """Navigate to Crow IDE"""
        self.page.goto(CROW_IDE_URL)
        self.page.wait_for_load_state("networkidle")

    def wait_for_agent_connected(self, timeout_ms: int = 60_000):
        """Wait for agent to show connected status"""
        self.page.get_by_text("Connected").wait_for(timeout=timeout_ms)

    def wait_for_agent_ready(self, timeout_ms: int = 120_000):
        """Wait for agent to be ready to chat"""
        start_time = time.time()

        # First check if we need to create a new session
        while (time.time() - start_time) * 1000 < timeout_ms:
            # Check if "No Agent Sessions" is showing
            no_sessions = self.page.get_by_text("No Agent Sessions")
            if no_sessions.count() > 0 and no_sessions.is_visible():
                # Click "New session" dropdown to open menu
                new_session_btn = self.page.get_by_role("button", name="New session").first
                new_session_btn.click()
                time.sleep(0.5)

                # Click "New Karla session" from dropdown
                karla_option = self.page.get_by_text("New Karla session")
                if karla_option.count() > 0:
                    karla_option.click()
                    # Wait for session to be created (can take 10-30 seconds)
                    for _ in range(30):
                        time.sleep(1)
                        creating = self.page.get_by_text("Creating a new session").count() > 0
                        if not creating:
                            break
                    time.sleep(2)  # Extra buffer
                continue

            # Check if chat input is available
            try:
                textbox = self.page.get_by_placeholder("Ask anything...")
                if textbox.count() > 0 and textbox.is_visible():
                    return
            except Exception:
                pass
            time.sleep(1)
        raise TimeoutError(f"Agent not ready within {timeout_ms}ms")

    def send_message(self, message: str):
        """Send a message to the agent"""
        textarea = self.page.get_by_placeholder("Ask anything...")
        textarea.fill(message)
        textarea.press("Enter")

    def wait_for_response(self, timeout_ms: int = AGENT_TIMEOUT_MS) -> str:
        """Wait for agent to finish responding and return the response"""
        start_time = time.time()
        initial_content = self._get_response_content()
        check_count = 0
        was_processing = False
        processing_stopped_at = None

        while (time.time() - start_time) * 1000 < timeout_ms:
            check_count += 1
            elapsed = int((time.time() - start_time))

            # Check if still processing
            processing = self.page.get_by_text("Agent is working...").count() > 0
            current_content = self._get_response_content()

            if check_count % 6 == 0:  # Log every 30 seconds
                print(f"[{elapsed}s] Processing: {processing}, Content length: {len(current_content)}")

            if processing:
                was_processing = True
                processing_stopped_at = None
            elif was_processing:
                # Agent just stopped processing
                if processing_stopped_at is None:
                    processing_stopped_at = time.time()
                    print(f"[{elapsed}s] Agent stopped processing")

                # Wait a couple seconds for final content to render
                if time.time() - processing_stopped_at > 2:
                    response_content = self._get_response_content()
                    # Return if we have more content than we started with
                    if len(response_content) > len(initial_content) + 10:
                        print(f"[{elapsed}s] Got response ({len(response_content)} chars): {response_content[:100]}...")
                        return response_content
                    # Or if Send button is ready and we have any content
                    send_button = self.page.get_by_role("button", name="Send")
                    if send_button.count() > 0 and send_button.is_enabled() and response_content:
                        print(f"[{elapsed}s] Send ready, returning: {response_content[:100]}...")
                        return response_content

            time.sleep(MESSAGE_CHECK_INTERVAL_MS / 1000)

        raise TimeoutError(f"Agent did not respond within {timeout_ms}ms")

    def _get_response_content(self) -> str:
        """Get the current response content from the chat"""
        # Try multiple selectors to find response content
        # First try prose class
        messages = self.page.locator("[class*='prose']").all()
        if messages:
            content = "\n".join([m.inner_text() for m in messages])
            if content.strip():
                return content

        # Try finding paragraphs in the chat area
        paragraphs = self.page.locator("p").all()
        if paragraphs:
            texts = []
            for p in paragraphs:
                try:
                    text = p.inner_text()
                    # Filter out UI text
                    if text and "Select a file" not in text and "Enter to send" not in text:
                        texts.append(text)
                except:
                    pass
            if texts:
                return "\n".join(texts)

        return ""

    def wait_for_agent_response(self, timeout_seconds: int = 60) -> str:
        """Wait for agent to process and return response"""
        start = time.time()
        saw_processing = False

        while time.time() - start < timeout_seconds:
            processing = self.page.get_by_text("Agent is working...").count() > 0
            if processing:
                saw_processing = True
            elif saw_processing:
                # Agent finished processing
                break
            time.sleep(1)

        # Give it a moment to render the response
        time.sleep(1)
        return self._get_response_content()

    def clear_chat(self):
        """Clear the current chat/start new session"""
        restart_button = self.page.get_by_role("button", name="Restart")
        if restart_button.count() > 0 and restart_button.is_visible():
            restart_button.click()
            time.sleep(2)

    def is_agent_processing(self) -> bool:
        """Check if agent is currently processing"""
        return self.page.get_by_text("Agent is working...").count() > 0

    def stop_agent(self):
        """Stop the current agent operation"""
        stop_button = self.page.get_by_role("button", name="Stop")
        if stop_button.count() > 0 and stop_button.is_visible():
            stop_button.click()


@pytest.fixture(scope="session")
def test_harness():
    """Create test harness for the entire test session"""
    harness = TestHarness()
    yield harness
    harness.cleanup()


@pytest.fixture
def crow_ide(page: Page) -> CrowIDEPage:
    """Fixture that provides a connected Crow IDE page"""
    crow = CrowIDEPage(page)
    crow.navigate()
    crow.wait_for_agent_connected()
    crow.wait_for_agent_ready()
    return crow


class TestAgentTrivial:
    """Trivial difficulty tests - Level 1"""

    @pytest.mark.timeout(180)
    def test_simple_greeting(self, crow_ide: CrowIDEPage):
        """Test that agent can respond to a simple greeting"""
        crow_ide.send_message("Hello! Can you hear me?")
        response = crow_ide.wait_for_agent_response(timeout_seconds=60)

        assert len(response) > 0, "Agent should respond"
        # Agent should acknowledge the greeting
        assert any(word in response.lower() for word in ["hello", "hi", "yes", "hear", "need"]), \
            f"Agent should acknowledge greeting, got: {response}"

    @pytest.mark.timeout(300)
    def test_list_files(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can list files"""
        # Setup repo
        repo_path = test_harness.setup_repo("simple-python")

        crow_ide.send_message(f"List all the Python files in {repo_path}")
        response = crow_ide.wait_for_response()

        assert "greeting.py" in response.lower() or ".py" in response, \
            "Agent should list Python files"


class TestAgentEasy:
    """Easy difficulty tests - Level 2"""

    @pytest.mark.timeout(360)
    def test_read_and_explain(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can read a file and explain it"""
        repo_path = test_harness.setup_repo("simple-python")

        crow_ide.send_message(
            f"Read the file {repo_path}/src/greeting.py and explain what it does"
        )
        response = crow_ide.wait_for_response()

        assert "greet" in response.lower(), "Should mention the greet function"
        assert "hello" in response.lower() or "greeting" in response.lower(), \
            "Should explain the greeting functionality"

    @pytest.mark.timeout(360)
    def test_find_function(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can find a specific function"""
        repo_path = test_harness.setup_repo("simple-python")

        crow_ide.send_message(
            f"Find the farewell function in {repo_path} and show me its code"
        )
        response = crow_ide.wait_for_response()

        assert "farewell" in response.lower(), "Should find the farewell function"
        assert "goodbye" in response.lower(), "Should show the function content"


class TestAgentMedium:
    """Medium difficulty tests - Level 3"""

    @pytest.mark.timeout(420)
    def test_identify_bugs(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can identify bugs in code"""
        repo_path = test_harness.setup_repo("flask-api")

        crow_ide.send_message(
            f"Read {repo_path}/app/routes.py and identify any bugs or issues. "
            "Don't fix them, just list what's wrong."
        )
        response = crow_ide.wait_for_response()

        # Should identify at least one bug (missing 404, no validation, etc.)
        bug_indicators = ["bug", "error", "wrong", "issue", "problem", "404", "validation", "missing"]
        found_bug = any(indicator in response.lower() for indicator in bug_indicators)
        assert found_bug, "Agent should identify bugs in the code"

    @pytest.mark.timeout(420)
    def test_add_comment(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can add a comment to code"""
        repo_path = test_harness.setup_repo("simple-python")

        crow_ide.send_message(
            f"Add a comment above the greet function in {repo_path}/src/greeting.py "
            "explaining that it's the main greeting function"
        )
        response = crow_ide.wait_for_response()

        # Check if file was modified
        greeting_file = repo_path / "src" / "greeting.py"
        content = greeting_file.read_text()
        # Should have added some kind of comment
        assert "#" in content or '"""' in content, "Should add a comment"


class TestAgentHard:
    """Hard difficulty tests - Level 4"""

    @pytest.mark.timeout(480)
    def test_fix_bug(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can fix a bug in Flask API"""
        repo_path = test_harness.setup_repo("flask-api")

        crow_ide.send_message(
            f"Fix get_user in {repo_path}/app/routes.py to return a 404 error "
            "when the user is not found instead of crashing with a KeyError."
        )
        response = crow_ide.wait_for_response()

        # Check if the bug was fixed
        routes_file = repo_path / "app" / "routes.py"
        content = routes_file.read_text()
        assert "404" in content, "Should add 404 error handling"

    @pytest.mark.timeout(480)
    def test_add_error_handling(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can add error handling"""
        repo_path = test_harness.setup_repo("flask-api")

        crow_ide.send_message(
            f"Add validation to create_user in {repo_path}/app/routes.py "
            "to return a 400 error if name or email is missing from the request body."
        )
        response = crow_ide.wait_for_response()

        # Check if validation was added
        routes_file = repo_path / "app" / "routes.py"
        content = routes_file.read_text()
        has_validation = "400" in content or "name" in content.lower() and "email" in content.lower()
        assert has_validation, "Should add input validation"


class TestAgentExpert:
    """Expert difficulty tests - Level 5"""

    @pytest.mark.timeout(600)
    def test_add_new_method(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can add a new method to a class"""
        repo_path = test_harness.setup_repo("todo-app")

        crow_ide.send_message(
            f"Add a delete method to the TodoApp class in {repo_path}/src/todo.py. "
            "It should take a todo_id and remove the todo from the list. "
            "Return True if found and deleted, False otherwise."
        )
        response = crow_ide.wait_for_response()

        # Check if method was added
        todo_file = repo_path / "src" / "todo.py"
        content = todo_file.read_text()
        assert "def delete" in content, "Should add delete method"
        assert "todo_id" in content, "Delete should take todo_id parameter"

    @pytest.mark.timeout(600)
    def test_add_feature(self, crow_ide: CrowIDEPage, test_harness: TestHarness):
        """Test that agent can add a complete feature"""
        repo_path = test_harness.setup_repo("todo-app")

        crow_ide.send_message(
            f"Add a priority field to the Todo class in {repo_path}/src/todo.py. "
            "Priority should be an enum with HIGH, MEDIUM, LOW values. "
            "Also add a list_by_priority method to TodoApp that returns todos sorted by priority."
        )
        response = crow_ide.wait_for_response()

        # Check if feature was added
        todo_file = repo_path / "src" / "todo.py"
        content = todo_file.read_text()
        has_priority = "priority" in content.lower()
        has_enum = "HIGH" in content or "high" in content.lower()
        assert has_priority, "Should add priority field"
        assert has_enum, "Should have priority levels"


# =============================================================================
# Challenge-based tests using the harness
# =============================================================================

def run_challenge(crow_ide: CrowIDEPage, harness: TestHarness, challenge: TestChallenge) -> tuple[bool, str]:
    """Run a single challenge and return (success, message)"""
    # Setup repo if needed
    if challenge.repo:
        repo_path = harness.setup_repo(challenge.repo)
        # Replace placeholder in prompt
        prompt = challenge.prompt.replace("$REPO", str(repo_path))
    else:
        prompt = challenge.prompt
        repo_path = harness.base_dir

    # Send the challenge prompt
    crow_ide.send_message(prompt)

    try:
        response = crow_ide.wait_for_response(timeout_ms=challenge.timeout_seconds * 1000)
    except TimeoutError as e:
        return False, f"Timeout: {e}"

    # Verify success
    return challenge.verify_success(repo_path, response)


@pytest.mark.parametrize(
    "challenge",
    [c for c in CHALLENGES if c.difficulty == Difficulty.TRIVIAL],
    ids=lambda c: c.name
)
def test_trivial_challenges(crow_ide: CrowIDEPage, test_harness: TestHarness, challenge: TestChallenge):
    """Run all trivial difficulty challenges"""
    success, message = run_challenge(crow_ide, test_harness, challenge)
    assert success, f"Challenge {challenge.name} failed: {message}"


@pytest.mark.parametrize(
    "challenge",
    [c for c in CHALLENGES if c.difficulty == Difficulty.EASY],
    ids=lambda c: c.name
)
def test_easy_challenges(crow_ide: CrowIDEPage, test_harness: TestHarness, challenge: TestChallenge):
    """Run all easy difficulty challenges"""
    success, message = run_challenge(crow_ide, test_harness, challenge)
    assert success, f"Challenge {challenge.name} failed: {message}"


@pytest.mark.parametrize(
    "challenge",
    [c for c in CHALLENGES if c.difficulty == Difficulty.MEDIUM],
    ids=lambda c: c.name
)
def test_medium_challenges(crow_ide: CrowIDEPage, test_harness: TestHarness, challenge: TestChallenge):
    """Run all medium difficulty challenges"""
    success, message = run_challenge(crow_ide, test_harness, challenge)
    assert success, f"Challenge {challenge.name} failed: {message}"


@pytest.mark.parametrize(
    "challenge",
    [c for c in CHALLENGES if c.difficulty == Difficulty.HARD],
    ids=lambda c: c.name
)
def test_hard_challenges(crow_ide: CrowIDEPage, test_harness: TestHarness, challenge: TestChallenge):
    """Run all hard difficulty challenges"""
    success, message = run_challenge(crow_ide, test_harness, challenge)
    assert success, f"Challenge {challenge.name} failed: {message}"


@pytest.mark.parametrize(
    "challenge",
    [c for c in CHALLENGES if c.difficulty == Difficulty.EXPERT],
    ids=lambda c: c.name
)
def test_expert_challenges(crow_ide: CrowIDEPage, test_harness: TestHarness, challenge: TestChallenge):
    """Run all expert difficulty challenges"""
    success, message = run_challenge(crow_ide, test_harness, challenge)
    assert success, f"Challenge {challenge.name} failed: {message}"


if __name__ == "__main__":
    # Print available challenges
    from .playwright_harness import get_all_challenges_sorted

    print("E2E Agent Tests")
    print("=" * 60)
    print("\nTo run tests:")
    print("  pytest tests/e2e/test_agent_e2e.py -v")
    print("\nTo run specific difficulty:")
    print("  pytest tests/e2e/test_agent_e2e.py -k 'trivial'")
    print("  pytest tests/e2e/test_agent_e2e.py -k 'easy'")
    print("  pytest tests/e2e/test_agent_e2e.py -k 'medium'")
    print("  pytest tests/e2e/test_agent_e2e.py -k 'hard'")
    print("  pytest tests/e2e/test_agent_e2e.py -k 'expert'")
