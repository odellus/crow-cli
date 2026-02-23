"""
Test for adding initial_messages to Session.create().

The goal is to be able to create a new session from a list of existing messages,
persisting them correctly using the existing methods (add_message, _save_event).

Message shapes we need to handle:
1. {"role": "system", "content": "..."} - skip (Session.create adds its own)
2. {"role": "user", "content": "..."} - easy
3. {"role": "assistant", "content": "..."} - easy
4. {"role": "assistant", "tool_calls": [...]} - need to unpack and save each
5. {"role": "tool", "tool_call_id": "...", "content": "..."} - easy

The tricky one is #4 - assistant messages with tool_calls.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

# Fix python import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from crow_acp.session import Session, lookup_or_create_prompt
from sqlalchemy import create_engine
from crow_acp.db import Base


def get_fixture_messages():
    """Load messages from the saved fixture."""
    fixture_path = Path(__file__).parent / "fixtures" / "session_messages.json"
    with open(fixture_path) as f:
        return json.load(f)


class TempDBManager:
    """Manage a temporary database for testing."""
    def __init__(self):
        self.f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = f"sqlite:///{self.f.name}"
        # Create tables
        engine = create_engine(self.db_path)
        Base.metadata.create_all(engine)

    def get_path(self):
        return self.db_path

    def cleanup(self):
        self.f.close()
        Path(self.f.name).unlink(missing_ok=True)


def test_analyze_message_shapes(fixture_messages):
    """Analyze the shapes of messages in our fixture."""
    shapes = {}
    for msg in fixture_messages:
        role = msg.get("role")
        keys = tuple(sorted(k for k in msg.keys() if k != "role"))
        shape_key = f"{role}: {keys}"
        shapes[shape_key] = shapes.get(shape_key, 0) + 1

    print("\n=== Message Shapes ===")
    for shape, count in sorted(shapes.items()):
        print(f"  {count:3d}x  {shape}")


def test_add_simple_messages_to_session(temp_db, fixture_messages):
    """Test adding simple messages (user, assistant with content, tool) to a session."""
    prompt_id = lookup_or_create_prompt(
        template="You are helpful. Workspace: {{workspace}}",
        name="test-prompt",
        db_path=temp_db,
    )

    session = Session.create(
        prompt_id=prompt_id,
        prompt_args={"workspace": "/tmp"},
        tool_definitions=[],
        request_params={},
        model_identifier="test-model",
        db_path=temp_db,
        cwd="/tmp",
    )

    added = {"user": 0, "assistant": 0, "tool": 0}

    for msg in fixture_messages[:20]:
        role = msg.get("role")

        if role == "system":
            continue

        if role == "user":
            session.add_message(role="user", content=msg.get("content"))
            added["user"] += 1

        elif role == "assistant":
            if "tool_calls" in msg:
                continue
            elif "content" in msg or "reasoning_content" in msg:
                session.add_message(
                    role="assistant",
                    content=msg.get("content"),
                    reasoning_content=msg.get("reasoning_content"),
                )
                added["assistant"] += 1

        elif role == "tool":
            session.add_message(
                role="tool",
                tool_call_id=msg.get("tool_call_id"),
                content=msg.get("content"),
            )
            added["tool"] += 1

    print(f"\nAdded: {added}")
    print(f"Session has {len(session.messages)} messages in memory")

    loaded = Session.load(session.session_id, db_path=temp_db)
    print(f"Loaded session has {len(loaded.messages)} messages in memory")

    expected = 1 + added["user"] + added["assistant"] + added["tool"]
    assert len(loaded.messages) == expected, (
        f"Expected {expected} messages, got {len(loaded.messages)}"
    )

def test_add_tool_calls_message_to_session(temp_db, fixture_messages):
    """Test adding assistant messages with tool_calls to a session."""
    tool_call_msgs = [
        m
        for m in fixture_messages
        if m.get("role") == "assistant" and "tool_calls" in m
    ]
    assert len(tool_call_msgs) > 0, "No tool_calls messages in fixture"

    prompt_id = lookup_or_create_prompt(
        template="You are helpful.",
        name="test-prompt",
        db_path=temp_db,
    )

    session = Session.create(
        prompt_id=prompt_id,
        prompt_args={},
        tool_definitions=[],
        request_params={},
        model_identifier="test-model",
        db_path=temp_db,
        cwd="/tmp",
    )

    tc_msg = tool_call_msgs[0]
    tool_calls = tc_msg["tool_calls"]

    print(f"\n=== Tool Calls Message ===")
    print(f"Number of tool calls: {len(tool_calls)}")
    for tc in tool_calls:
        print(f"  - {tc['function']['name']} (id: {tc['id'][:20]}...)")

    for tc in tool_calls:
        session._save_event(
            role="assistant",
            tool_call_id=tc["id"],
            tool_call_name=tc["function"]["name"],
            tool_arguments=json.loads(tc["function"]["arguments"]),
        )

    session.messages.append({"role": "assistant", "tool_calls": tool_calls})

    print(f"\nSession has {len(session.messages)} messages")
    print(f"Session conv_index: {session.conv_index}")

    loaded = Session.load(session.session_id, db_path=temp_db)

    print(f"\nLoaded session has {len(loaded.messages)} messages")

    loaded_tc_msgs = [
        m for m in loaded.messages if m.get("role") == "assistant" and "tool_calls" in m
    ]
    print(f"Found {len(loaded_tc_msgs)} tool_calls messages in loaded session")

    if loaded_tc_msgs:
        loaded_tc = loaded_tc_msgs[0]["tool_calls"]
        print(f"First loaded tool_calls has {len(loaded_tc)} entries")
        for tc in loaded_tc:
            print(f"  - {tc['function']['name']} (id: {tc['id'][:20]}...)")

def test_full_message_chain_persistence(temp_db, fixture_messages):
    """
    Test persisting a full chain of messages including tool calls and results.
    """
    prompt_id = lookup_or_create_prompt(
        template="You are helpful.",
        name="test-prompt",
        db_path=temp_db,
    )

    start_idx = 1
    messages_to_add = fixture_messages[start_idx : start_idx + 10]

    session = Session.create(
        prompt_id=prompt_id,
        prompt_args={},
        tool_definitions=[],
        request_params={},
        model_identifier="test-model",
        db_path=temp_db,
        cwd="/tmp",
        initial_messages=messages_to_add,
    )

    print(f"\n=== Session state ===")
    print(f"In-memory messages: {len(session.messages)}")
    print(f"Conv index (events saved): {session.conv_index}")

    loaded = Session.load(session.session_id, db_path=temp_db)

    print(f"\n=== Loaded session ===")
    print(f"In-memory messages: {len(loaded.messages)}")

    assert len(loaded.messages) == len(session.messages), (
        f"Message count mismatch: {len(loaded.messages)} vs {len(session.messages)}"
    )

def run_tests():
    fixture_messages = get_fixture_messages()
    
    print("Running: test_analyze_message_shapes")
    test_analyze_message_shapes(fixture_messages)
    
    db_mgr = TempDBManager()
    temp_db = db_mgr.get_path()
    try:
        print("\n\nRunning: test_add_simple_messages_to_session")
        test_add_simple_messages_to_session(temp_db, fixture_messages)
    finally:
        db_mgr.cleanup()
        
    db_mgr = TempDBManager()
    temp_db = db_mgr.get_path()
    try:
        print("\n\nRunning: test_add_tool_calls_message_to_session")
        test_add_tool_calls_message_to_session(temp_db, fixture_messages)
    finally:
        db_mgr.cleanup()

    db_mgr = TempDBManager()
    temp_db = db_mgr.get_path()
    try:
        print("\n\nRunning: test_full_message_chain_persistence")
        test_full_message_chain_persistence(temp_db, fixture_messages)
    finally:
        db_mgr.cleanup()

if __name__ == "__main__":
    run_tests()
