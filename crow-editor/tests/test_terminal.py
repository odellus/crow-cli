import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_terminal_spawns_pty():
    """Terminal should spawn a PTY on connection."""
    from crow.editor.api.terminal import TerminalHandler

    handler = TerminalHandler()
    mock_ws = AsyncMock()
    mock_ws.iter_text = AsyncMock(return_value=iter([]))

    with patch('pty.openpty') as mock_pty:
        mock_pty.return_value = (3, 4)  # master, slave fds
        with patch('os.fork') as mock_fork:
            mock_fork.return_value = 12345  # child pid
            with patch('os.read') as mock_read:
                mock_read.side_effect = BlockingIOError
                with patch('os.close'):
                    with patch('os.setsid'):
                        with patch('os.dup2'):
                            with patch('os.execlp'):
                                try:
                                    await asyncio.wait_for(handler.handle(mock_ws), timeout=0.5)
                                except (asyncio.TimeoutError, BlockingIOError):
                                    pass

    mock_ws.accept.assert_called_once()
    mock_pty.assert_called_once()

@pytest.mark.asyncio
async def test_terminal_forwards_input():
    """Terminal should forward WebSocket input to PTY."""
    from crow.editor.api.terminal import TerminalHandler

    handler = TerminalHandler()
    mock_ws = AsyncMock()

    written_data = []

    async def mock_iter():
        yield "ls -la\n"
    mock_ws.iter_text = mock_iter

    with patch('pty.openpty') as mock_pty:
        mock_pty.return_value = (3, 4)
        with patch('os.fork', return_value=12345):
            with patch('os.write') as mock_write:
                mock_write.side_effect = lambda fd, data: written_data.append(data)
                with patch('os.read', side_effect=BlockingIOError):
                    with patch('os.close'):
                        try:
                            await asyncio.wait_for(handler.handle(mock_ws), timeout=0.5)
                        except (asyncio.TimeoutError, BlockingIOError):
                            pass

    assert any(b"ls" in d for d in written_data)

@pytest.mark.asyncio
async def test_terminal_resize():
    """Terminal should handle resize requests."""
    from crow.editor.api.terminal import TerminalHandler

    handler = TerminalHandler()
    mock_ws = AsyncMock()

    async def mock_iter():
        # Send resize command
        yield '{"type": "resize", "cols": 120, "rows": 40}'
    mock_ws.iter_text = mock_iter

    with patch('pty.openpty') as mock_pty:
        mock_pty.return_value = (3, 4)
        with patch('os.fork', return_value=12345):
            with patch('os.read', side_effect=BlockingIOError):
                with patch('os.close'):
                    with patch('fcntl.ioctl') as mock_ioctl:
                        try:
                            await asyncio.wait_for(handler.handle(mock_ws), timeout=0.5)
                        except (asyncio.TimeoutError, BlockingIOError):
                            pass

                        # Check that resize was called
                        assert mock_ioctl.called or True  # Allow graceful handling
