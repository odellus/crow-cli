import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_bridge_accepts_connection():
    """Bridge should accept WebSocket connections."""
    from crow.editor.acp_bridge import ACPBridge

    bridge = ACPBridge(["echo", "test"])
    mock_ws = AsyncMock()
    mock_ws.iter_text = AsyncMock(return_value=iter([]))

    # Should not raise
    with patch('asyncio.create_subprocess_exec') as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.stdout.readline = AsyncMock(return_value=b'')
        mock_exec.return_value = mock_proc

        # Run with timeout to prevent hanging
        try:
            await asyncio.wait_for(bridge.handle(mock_ws), timeout=0.5)
        except asyncio.TimeoutError:
            pass

    mock_ws.accept.assert_called_once()

@pytest.mark.asyncio
async def test_bridge_forwards_stdout_to_websocket():
    """Bridge should forward subprocess stdout to WebSocket."""
    from crow.editor.acp_bridge import ACPBridge

    bridge = ACPBridge(["cat"])
    mock_ws = AsyncMock()
    messages_sent = []
    mock_ws.send_text = AsyncMock(side_effect=lambda m: messages_sent.append(m))

    # Mock websocket to close after receiving
    async def mock_iter():
        return
        yield  # Make it a generator
    mock_ws.iter_text = mock_iter

    with patch('asyncio.create_subprocess_exec') as mock_exec:
        mock_proc = AsyncMock()

        # Simulate stdout output then EOF
        call_count = 0
        async def mock_readline():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return b'{"jsonrpc": "2.0", "result": "hello"}\n'
            return b''

        mock_proc.stdout.readline = mock_readline
        mock_exec.return_value = mock_proc

        try:
            await asyncio.wait_for(bridge.handle(mock_ws), timeout=1.0)
        except asyncio.TimeoutError:
            pass

    assert len(messages_sent) >= 1
    assert 'hello' in messages_sent[0]

@pytest.mark.asyncio
async def test_bridge_forwards_websocket_to_stdin():
    """Bridge should forward WebSocket messages to subprocess stdin."""
    from crow.editor.acp_bridge import ACPBridge

    bridge = ACPBridge(["cat"])
    mock_ws = AsyncMock()

    # Track what gets written to stdin
    stdin_writes = []

    async def mock_iter():
        yield '{"jsonrpc": "2.0", "method": "test"}'
    mock_ws.iter_text = mock_iter

    with patch('asyncio.create_subprocess_exec') as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.stdout.readline = AsyncMock(return_value=b'')
        mock_proc.stdin.write = MagicMock(side_effect=lambda d: stdin_writes.append(d))
        mock_proc.stdin.drain = AsyncMock()
        mock_exec.return_value = mock_proc

        try:
            await asyncio.wait_for(bridge.handle(mock_ws), timeout=1.0)
        except asyncio.TimeoutError:
            pass

    assert len(stdin_writes) >= 1
    assert b'test' in stdin_writes[0]
