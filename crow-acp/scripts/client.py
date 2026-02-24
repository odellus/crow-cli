"""
Crow ACP Client - A transparent, observable agent client.

This is our microscope. Our Frankenstein monitor. Full visibility into:
- Session state (database)
- Message flow (what we send/receive)
- Agent behavior (logs, tool calls)

Usage:
    # Single-shot mode (default) - send prompt, get response, exit
    crow-client "list the files in this directory"
    
    # Interactive mode - REPL loop
    crow-client -i
    
    # Load existing session
    crow-client -s lumpy-energetic-hyrax-of-opportunity-77bcbd
    
    # Combine flags
    crow-client -i -s exuberant-grinning-nautilus-of-sunshine-9d3d35
    
    # Inspect database
    crow-client inspect
    crow-client inspect --session lumpy-energetic-hyrax-of-opportunity-77bcbd
"""

import asyncio
import contextlib
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

import typer
from acp import (
    PROTOCOL_VERSION,
    Client,
    RequestError,
    connect_to_agent,
    text_block,
)
from acp.core import ClientSideConnection
from acp.schema import (
    AgentMessageChunk,
    AgentThoughtChunk,
    AudioContentBlock,
    ClientCapabilities,
    EmbeddedResourceContentBlock,
    ImageContentBlock,
    Implementation,
    PermissionOption,
    ReadTextFileResponse,
    ResourceContentBlock,
    TextContentBlock,
    ToolCall,
    WriteTextFileResponse,
)
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

app = typer.Typer(
    name="crow-client",
    help="Transparent ACP client for Crow agent - full observability into agent state",
)
console = Console()


# ============================================================================
# Client Implementation
# ============================================================================


class CrowClient(Client):
    """
    Minimal ACP client that streams agent output beautifully.
    """
    
    _last_chunk: AgentMessageChunk | AgentThoughtChunk | None = None
    _console: Console = console

    async def request_permission(
        self,
        options: list[PermissionOption],
        session_id: str,
        tool_call: ToolCall,
        **kwargs: Any,
    ) -> Any:
        raise RequestError.method_not_found("session/request_permission")

    async def write_text_file(
        self, content: str, path: str, session_id: str, **kwargs: Any
    ) -> WriteTextFileResponse | None:
        raise RequestError.method_not_found("fs/write_text_file")

    async def read_text_file(
        self, path: str, session_id: str, **kwargs: Any
    ) -> ReadTextFileResponse:
        raise RequestError.method_not_found("fs/read_text_file")

    async def session_update(
        self,
        session_id: str,
        update: AgentMessageChunk | AgentThoughtChunk,
        **kwargs: Any,
    ) -> None:
        """Handle streaming updates from the agent."""
        if isinstance(update, AgentMessageChunk):
            if self._last_chunk is None or isinstance(self._last_chunk, AgentThoughtChunk):
                # Transition to message output
                self._console.print()
                self._console.rule("[bold purple]Assistant[/bold purple]")
                self._console.print()
            
            self._last_chunk = update
            content = update.content
            text = self._extract_text(content)
            self._console.print(text, end="", style="purple", highlight=False)

        elif isinstance(update, AgentThoughtChunk):
            if self._last_chunk is None or isinstance(self._last_chunk, AgentMessageChunk):
                # Transition to thinking output
                self._console.print()
                self._console.rule("[dim green]Thinking[/dim green]")
                self._console.print()
            
            self._last_chunk = update
            content = update.content
            text = self._extract_text(content)
            self._console.print(text, end="", style="dim green italic", highlight=False)

    def _extract_text(self, content: Any) -> str:
        """Extract text from various content block types."""
        if isinstance(content, TextContentBlock):
            return content.text
        elif isinstance(content, ImageContentBlock):
            return "<image>"
        elif isinstance(content, AudioContentBlock):
            return "<audio>"
        elif isinstance(content, ResourceContentBlock):
            return content.uri or "<resource>"
        elif isinstance(content, EmbeddedResourceContentBlock):
            return "<resource>"
        elif isinstance(content, dict):
            return content.get("text", "<content>")
        else:
            return "<content>"

    async def ext_method(self, method: str, params: dict) -> dict:
        raise RequestError.method_not_found(method)

    async def ext_notification(self, method: str, params: dict) -> None:
        raise RequestError.method_not_found(method)


# ============================================================================
# Connection Management
# ============================================================================


async def spawn_agent(cwd: str) -> asyncio.subprocess.Process:
    """Spawn the crow-acp agent subprocess."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "crow_acp.agent",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        cwd=cwd,
    )
    if proc.stdin is None or proc.stdout is None:
        console.print("[red]Agent process does not expose stdio pipes[/red]")
        raise SystemExit(1)
    return proc


async def connect_client(proc: asyncio.subprocess.Process) -> ClientSideConnection:
    """Initialize ACP connection to agent."""
    client_impl = CrowClient()
    conn = connect_to_agent(client_impl, proc.stdin, proc.stdout)
    
    await conn.initialize(
        protocol_version=PROTOCOL_VERSION,
        client_capabilities=ClientCapabilities(),
        client_info=Implementation(
            name="crow-client",
            title="Crow Client", 
            version="0.1.0",
        ),
    )
    return conn


# ============================================================================
# Core Operations
# ============================================================================


async def send_prompt(
    conn: ClientSideConnection,
    session_id: str,
    prompt: str,
) -> None:
    """Send a single prompt and wait for completion."""
    console.print()
    console.print(Panel(f"[bold]{prompt}[/bold]", title="[cyan]You[/cyan]", border_style="cyan"))
    console.print()
    
    await conn.prompt(
        session_id=session_id,
        prompt=[text_block(prompt)],
    )
    
    console.print()  # Final newline after agent response


async def interactive_loop(conn: ClientSideConnection, session_id: str) -> None:
    """Interactive REPL loop."""
    console.print(Panel(
        "[bold]Crow Interactive Mode[/bold]\n\n"
        "Type your message and press Enter to send.\n"
        "Press Ctrl+D or Ctrl+C to exit.",
        title="[magenta]🪶 Crow Client[/magenta]",
        border_style="magenta",
    ))
    
    while True:
        try:
            # Use rich prompt
            console.print()
            prompt_text = Text("crow> ", style="bold magenta")
            line = await asyncio.get_running_loop().run_in_executor(
                None, lambda: console.input(prompt_text)
            )
        except EOFError:
            console.print("\n[yellow]Goodbye![/yellow]")
            break
        except KeyboardInterrupt:
            console.print("\n[yellow]Goodbye![/yellow]")
            break

        if not line.strip():
            continue

        await send_prompt(conn, session_id, line)


# ============================================================================
# Database Inspection
# ============================================================================


def get_db_path() -> str:
    """Get the default database path."""
    return os.path.expanduser("~/.crow/crow.db")


@app.command("inspect")
def inspect_db(
    session_id: str | None = typer.Option(None, "--session", "-s", help="Session ID to inspect"),
    messages: bool = typer.Option(False, "--messages", "-m", help="Show messages"),
    limit: int = typer.Option(20, "--limit", "-l", help="Limit number of rows"),
):
    """Inspect the Crow database - see session state, messages, etc."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        console.print(f"[red]Database not found at {db_path}[/red]")
        raise SystemExit(1)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    if session_id:
        # Show specific session
        cur.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
        session = cur.fetchone()
        
        if not session:
            console.print(f"[red]Session '{session_id}' not found[/red]")
            raise SystemExit(1)
        
        # Session info table
        table = Table(title=f"Session: {session_id}", show_header=False)
        table.add_column("Field", style="cyan")
        table.add_column("Value", style="green")
        
        for key in session.keys():
            if key not in ("tool_definitions", "request_params", "system_prompt"):
                table.add_row(key, str(session[key]))
        
        console.print(table)
        
        # Show messages if requested
        if messages:
            cur.execute(
                "SELECT id, role, created_at, data FROM messages WHERE session_id = ? ORDER BY id LIMIT ?",
                (session_id, limit)
            )
            msgs = cur.fetchall()
            
            msg_table = Table(title=f"Messages ({len(msgs)} shown)")
            msg_table.add_column("ID", style="dim")
            msg_table.add_column("Role", style="cyan")
            msg_table.add_column("Created", style="dim")
            msg_table.add_column("Content Preview", style="white")
            
            for msg in msgs:
                import json
                data = json.loads(msg["data"])
                content = data.get("content", "")
                preview = content[:100] + "..." if len(content) > 100 else content
                msg_table.add_row(
                    str(msg["id"]),
                    msg["role"],
                    msg["created_at"][:19] if msg["created_at"] else "",
                    preview.replace("\n", " ")
                )
            
            console.print(msg_table)
    else:
        # List all sessions
        cur.execute("""
            SELECT s.session_id, s.created_at, s.model_identifier, COUNT(m.id) as message_count
            FROM sessions s
            LEFT JOIN messages m ON s.session_id = m.session_id
            GROUP BY s.session_id
            ORDER BY s.created_at DESC
            LIMIT ?
        """, (limit,))
        sessions = cur.fetchall()
        
        if not sessions:
            console.print("[yellow]No sessions found[/yellow]")
            raise SystemExit(0)
        
        table = Table(title="Crow Sessions")
        table.add_column("Session ID", style="cyan")
        table.add_column("Created", style="dim")
        table.add_column("Model", style="green")
        table.add_column("Messages", style="yellow")
        
        for sess in sessions:
            table.add_row(
                sess["session_id"],
                sess["created_at"][:19] if sess["created_at"] else "",
                sess["model_identifier"] or "",
                str(sess["message_count"])
            )
        
        console.print(table)
        console.print(f"\n[dim]Use --session <id> --messages to inspect a specific session[/dim]")
    
    conn.close()


# ============================================================================
# Main Commands
# ============================================================================


@app.command()
def run(
    prompt: str = typer.Argument(None, help="Prompt to send (optional in interactive mode)"),
    interactive: bool = typer.Option(False, "--interactive", "-i", help="Run in interactive mode"),
    session_id: str | None = typer.Option(None, "--session", "-s", help="Load existing session"),
    cwd: str = typer.Option(os.getcwd(), "--cwd", "-c", help="Working directory"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
):
    """
    Run the Crow client.
    
    Default mode: Send a single prompt and exit after response.
    Interactive mode (-i): Start a REPL loop.
    """
    import logging
    
    if verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.WARNING)
    
    # Validate arguments
    if not interactive and prompt is None:
        console.print("[red]Error: Either provide a prompt or use -i for interactive mode[/red]")
        console.print("\n[yellow]Examples:[/yellow]")
        console.print("  crow-client 'list the files'")
        console.print("  crow-client -i")
        console.print("  crow-client -s <session-id> -i")
        raise SystemExit(1)
    
    # Run the async main
    asyncio.run(_run_async(prompt, interactive, session_id, cwd))


async def _run_async(
    prompt: str | None,
    interactive: bool,
    session_id: str | None,
    cwd: str,
) -> None:
    """Async implementation of run command."""
    console.print(Panel(
        "[bold]Crow ACP Client[/bold]\n\n"
        f"Working directory: [cyan]{cwd}[/cyan]\n"
        f"Mode: {'[green]Interactive[/green]' if interactive else '[yellow]Single-shot[/yellow]'}\n"
        f"Session: {session_id or '[dim]New session[/dim]'}",
        title="[magenta]🪶 Crow[/magenta]",
        border_style="magenta",
    ))
    
    # Spawn agent
    proc = await spawn_agent(cwd)
    
    try:
        # Connect
        conn = await connect_client(proc)
        
        # Create or load session
        if session_id:
            console.print(f"[cyan]Loading session: {session_id}[/cyan]")
            await conn.load_session(session_id=session_id, mcp_servers=[], cwd=cwd)
            actual_session_id = session_id
        else:
            console.print("[cyan]Creating new session...[/cyan]")
            session = await conn.new_session(mcp_servers=[], cwd=cwd)
            actual_session_id = session.session_id
            console.print(f"[green]Session created: {actual_session_id}[/green]")
        
        # Run
        if interactive:
            await interactive_loop(conn, actual_session_id)
        else:
            await send_prompt(conn, actual_session_id, prompt)
            console.print(f"\n[dim]Session: {actual_session_id}[/dim]")
            console.print("[dim]Use -s {actual_session_id} -i to continue this conversation[/dim]")
        
    finally:
        # Cleanup
        if proc.returncode is None:
            proc.terminate()
            with contextlib.suppress(ProcessLookupError):
                await proc.wait()


# ============================================================================
# Entry Point
# ============================================================================


@app.callback()
def main():
    """Crow ACP Client - Transparent, observable agent client."""
    pass


if __name__ == "__main__":
    app()
