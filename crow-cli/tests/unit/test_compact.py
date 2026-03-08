"""Unit tests for compaction without LLM calls."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from crow_cli.agent.compact import compact, get_middle_message
from crow_cli.agent.session import Session, lookup_or_create_prompt


class TestCompaction:
    """Test compaction logic without actual LLM calls."""

    @pytest.fixture
    def setup_session(self, temp_db_uri, sample_prompt_template):
        """Create a session with multiple messages."""
        prompt_id = lookup_or_create_prompt(
            sample_prompt_template,
            name="test-prompt",
            db_uri=temp_db_uri,
        )

        session = Session.create(
            prompt_id=prompt_id,
            prompt_args={"name": "Crow", "workspace": "/tmp", "display_tree": "test/"},
            tool_definitions=[],
            request_params={"temperature": 0.7},
            model_identifier="test-model",
            db_uri=temp_db_uri,
            cwd="/tmp",
        )

        # Add many messages to simulate a long conversation
        for i in range(20):
            session.add_message({"role": "user", "content": f"User message {i}"})
            session.add_message(
                {"role": "assistant", "content": f"Assistant response {i}"}
            )

        return session, temp_db_uri

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM client."""
        llm = AsyncMock()
        # Mock response with compacted summary
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[
            0
        ].message.content = "This is a compacted summary of the conversation."
        mock_response.usage = {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150,
        }
        llm.chat.completions.create = AsyncMock(return_value=mock_response)
        return llm

    def test_compact_calls_llm(self, setup_session, mock_llm):
        """Verify compact calls the LLM."""
        session, _ = setup_session

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify LLM was called
        mock_llm.chat.completions.create.assert_called_once()

    def test_compact_reduces_message_count(self, setup_session, mock_llm):
        """Verify compaction reduces message count."""
        session, _ = setup_session
        original_count = len(session.messages)

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify message count is reduced
        assert len(result.messages) < original_count

    def test_compact_preserves_first_and_last_user_message(
        self, setup_session, mock_llm
    ):
        """Verify first user message and last user message are preserved."""
        session, _ = setup_session
        original_first = session.messages[1]  # Skip system
        original_last_user = None
        for i in range(len(session.messages) - 1, 0, -1):
            if session.messages[i].get("role") == "user":
                original_last_user = session.messages[i]
                break

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify first user message is preserved
        assert result.messages[1] == original_first

        # Verify last user message is preserved
        result_last_user = None
        for i in range(len(result.messages) - 1, 0, -1):
            if result.messages[i].get("role") == "user":
                result_last_user = result.messages[i]
                break

        assert result_last_user == original_last_user

    def test_compact_creates_new_db_session(self, setup_session, mock_llm):
        """Verify compaction creates new session in database."""
        session, db_uri = setup_session
        original_id = session.session_id

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify session can be reloaded
        reloaded = Session.load(original_id, db_uri=db_uri)
        assert reloaded is not None
        assert len(reloaded.messages) < len(result.messages) + 10  # Should be compacted

    def test_compact_update_from_persists_changes(self, setup_session, mock_llm):
        """Verify update_from properly updates session state."""
        session, db_uri = setup_session
        original_count = len(session.messages)

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify original session object was updated in-place
        assert len(session.messages) < original_count
        assert len(session.messages) == len(result.messages)

        # Verify the updated state persists after reload
        reloaded = Session.load(session.session_id, db_uri=db_uri)
        assert len(reloaded.messages) == len(session.messages)

    def test_compact_with_no_tool_calls(self, setup_session, mock_llm):
        """Test compaction when no tools are defined."""
        session, _ = setup_session

        # Session already has no tools
        assert session.tools == []

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Should still work
        assert result is not None
        assert len(result.messages) < len(session.messages)

    def test_compact_with_tools(self, setup_session, mock_llm):
        """Test compaction when tools are defined."""
        session, _ = setup_session

        # Add tools
        session.tools = [
            {"name": "read_file", "description": "Read a file"},
            {"name": "write_file", "description": "Write a file"},
        ]
        session.request_params = {"temperature": 0.7, "max_tokens": 1000}

        # Call compact
        result = compact(session, mock_llm, "/tmp", logger=MagicMock())

        # Verify tools are preserved
        assert result.tools == session.tools
        assert result.request_params == session.request_params

    def test_compact_on_compact_callback(self, setup_session, mock_llm):
        """Test on_compact callback is called."""
        session, _ = setup_session
        callback_called = False
        callback_session_id = None

        def on_compact(session_id, compacted_session):
            nonlocal callback_called, callback_session_id
            callback_called = True
            callback_session_id = session_id

        # Call compact with callback
        result = compact(
            session, mock_llm, "/tmp", on_compact=on_compact, logger=MagicMock()
        )

        # Verify callback was called
        assert callback_called
        assert callback_session_id == session.session_id
