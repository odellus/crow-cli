"""
Terminal API - PTY-based terminal for Crow IDE.

Provides a WebSocket-connected terminal with PTY support.
"""

import asyncio
import fcntl
import json
import os
import pty
import struct
import termios
from typing import Optional


class TerminalHandler:
    """Handle WebSocket terminal connections with PTY support."""

    def __init__(self, shell: str = "/bin/bash"):
        """Initialize terminal handler.

        Args:
            shell: Shell to spawn (default: /bin/bash).
        """
        self.shell = shell
        self._master_fd: Optional[int] = None
        self._pid: Optional[int] = None

    async def handle(self, websocket) -> None:
        """Handle a WebSocket terminal connection.

        Args:
            websocket: Starlette WebSocket connection.
        """
        await websocket.accept()

        # Create PTY
        master_fd, slave_fd = pty.openpty()
        self._master_fd = master_fd

        # Fork process
        pid = os.fork()
        self._pid = pid

        if pid == 0:
            # Child process
            os.close(master_fd)
            os.setsid()

            # Set up slave as controlling terminal
            os.dup2(slave_fd, 0)  # stdin
            os.dup2(slave_fd, 1)  # stdout
            os.dup2(slave_fd, 2)  # stderr

            if slave_fd > 2:
                os.close(slave_fd)

            # Execute shell
            os.execlp(self.shell, self.shell)
        else:
            # Parent process
            os.close(slave_fd)

            # Set master to non-blocking
            flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
            fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            # Create tasks for reading and writing
            read_task = asyncio.create_task(self._read_pty(websocket))
            write_task = asyncio.create_task(self._write_pty(websocket))

            try:
                done, pending = await asyncio.wait(
                    [read_task, write_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            finally:
                os.close(master_fd)
                try:
                    os.kill(pid, 9)
                    os.waitpid(pid, 0)
                except (ProcessLookupError, ChildProcessError):
                    pass

    async def _read_pty(self, websocket) -> None:
        """Read from PTY and send to WebSocket.

        Args:
            websocket: Starlette WebSocket connection.
        """
        loop = asyncio.get_event_loop()

        while True:
            try:
                # Use run_in_executor for blocking read
                data = await loop.run_in_executor(
                    None,
                    lambda: self._read_nonblocking(),
                )
                if data:
                    await websocket.send_text(data.decode('utf-8', errors='replace'))
                else:
                    await asyncio.sleep(0.01)
            except Exception:
                break

    def _read_nonblocking(self) -> bytes:
        """Read from master fd in non-blocking mode."""
        try:
            return os.read(self._master_fd, 4096)
        except (BlockingIOError, OSError):
            return b''

    async def _write_pty(self, websocket) -> None:
        """Read from WebSocket and write to PTY.

        Args:
            websocket: Starlette WebSocket connection.
        """
        async for message in websocket.iter_text():
            try:
                # Check if it's a JSON command
                data = json.loads(message)
                if data.get("type") == "resize":
                    self._resize(data.get("cols", 80), data.get("rows", 24))
                    continue
            except (json.JSONDecodeError, TypeError):
                pass

            # Regular input
            os.write(self._master_fd, message.encode('utf-8'))

    def _resize(self, cols: int, rows: int) -> None:
        """Resize the PTY.

        Args:
            cols: Number of columns.
            rows: Number of rows.
        """
        if self._master_fd is not None:
            winsize = struct.pack('HHHH', rows, cols, 0, 0)
            fcntl.ioctl(self._master_fd, termios.TIOCSWINSZ, winsize)
