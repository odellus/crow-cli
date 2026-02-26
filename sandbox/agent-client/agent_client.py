"""
Stupid simple ACP Agent-Client router.

Usage:
    uv --project /home/thomas/src/nid/sandbox/agent-client run python agent_client.py
"""

import asyncio
import sys
from uuid import uuid4

from acp import run_agent, text_block
from acp.interfaces import Agent, Client
from acp.schema import (
    ClientCapabilities,
    Implementation,
    McpServerStdio,
    TextContentBlock,
)


class SimpleAgentClient(Agent):
    """
    Stupid simple router: Agent to CLI, Client to backend.

    Routes all prompts to a backend agent and returns the response.
    """

    _backend_conn: Client | None = None
    _backend_session_map: dict[str, str] = {}  # client_session → backend_session

    async def initialize(
        self,
        protocol_version: int,
        client_capabilities: ClientCapabilities | None = None,
        client_info: Implementation | None = None,
        **kwargs,
    ):
        return {"protocol_version": protocol_version}

    async def new_session(
        self,
        cwd: str,
        mcp_servers: list[McpServerStdio] | None = None,
        **kwargs,
    ):
        session_id = uuid4().hex

        # Connect to backend agent (EchoAgent for demo)
        if self._backend_conn is None:
            backend_cwd = "/home/thomas/src/nid/sandbox/crow-acp-learning"
            backend_script = f"{backend_cwd}/echo_agent.py"

            # We'll handle this via the client connection
            # For now, just create the session mapping
            backend_session_id = uuid4().hex
            self._backend_session_map[session_id] = backend_session_id

        return {"session_id": session_id}

    async def prompt(
        self,
        prompt: list[TextContentBlock],
        session_id: str,
        **kwargs,
    ):
        backend_session_id = self._backend_session_map.get(session_id)
        if not backend_session_id:
            raise ValueError(f"Session {session_id} not found")

        # For demo: just echo back the prompt
        text_content = []
        for block in prompt:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    text_content.append(block.get("text", ""))
            elif hasattr(block, "type") and block.type == "text":
                text_content.append(getattr(block, "text", ""))

        return {
            "stop_reason": "end_turn",
            "content": [
                {
                    "type": "text",
                    "text": f"Router received: {' '.join(text_content)}",
                }
            ],
        }

    async def cancel(self, session_id: str, **kwargs):
        pass


async def main():
    agent = SimpleAgentClient()
    await run_agent(agent)


if __name__ == "__main__":
    asyncio.run(main())
