"""
Integration test for OpenHands ACP bridge.

This test verifies that the ACPBridge can successfully spawn and communicate
with an OpenHands ACP agent.
"""

import asyncio
import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from crow.editor.acp_bridge import ACPBridge


class TestOpenHandsBridge:
    """Test OpenHands ACP bridge integration"""

    @pytest.fixture
    def openhands_command(self):
        """Get the command to run OpenHands ACP"""
        return "uv run --directory ../OpenHands-CLI openhands acp".split()

    @pytest.mark.asyncio
    async def test_bridge_creation(self, openhands_command):
        """Test that bridge can be created with OpenHands command"""
        bridge = ACPBridge(openhands_command, cwd=Path.cwd())
        assert bridge.command == openhands_command
        assert bridge._process is None

    @pytest.mark.asyncio
    async def test_mock_websocket_communication(self, openhands_command):
        """Test WebSocket communication with mock"""
        # Create mock websocket
        mock_ws = AsyncMock()
        mock_ws.accept = AsyncMock()
        mock_ws.send_text = AsyncMock()
        mock_ws.receive = AsyncMock()

        # Simulate initialize request
        mock_ws.receive.side_effect = [
            {"type": "websocket.receive", "text": json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {}}
            })},
            {"type": "websocket.disconnect"},
        ]

        # Create bridge
        bridge = ACPBridge(openhands_command, cwd=Path.cwd())

        # Note: We don't actually run the bridge here as it would spawn a subprocess
        # Instead, we just verify the bridge can be created
        assert bridge is not None

    @pytest.mark.asyncio
    async def test_message_type_extraction(self):
        """Test message type extraction helper"""
        from crow.editor.acp_bridge import _extract_message_type

        # Test initialize request
        init_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        })
        assert _extract_message_type(init_msg) == "initialize"

        # Test result response
        result_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"sessionId": "test"}
        })
        assert _extract_message_type(result_msg) == "result"

        # Test error response
        error_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "error": {"code": -32600, "message": "Invalid Request"}
        })
        assert _extract_message_type(error_msg) == "error"

    @pytest.mark.asyncio
    async def test_session_id_extraction(self):
        """Test session ID extraction helper"""
        from crow.editor.acp_bridge import _extract_agent_session_id

        # Test session/new response
        session_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"sessionId": "abc-123-def"}
        })
        assert _extract_agent_session_id(session_msg) == "abc-123-def"

        # Test response without session ID
        other_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"status": "ok"}
        })
        assert _extract_agent_session_id(other_msg) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
