# Crow IDE

A web-based IDE with an integrated AI coding agent. Crow IDE provides a browser-based development environment where an AI assistant (OpenHands) can read, write, and modify files in your project.

## Features

- **AI Agent Panel** - Chat interface with the OpenHands coding agent
- **File Explorer** - Browse and navigate project files
- **Code Editor** - View files selected from the explorer
- **Terminal** - Integrated terminal with WebSocket connection
- **Workspace Selector** - Switch between different project directories
- **Session History** - View and resume previous agent conversations

## Architecture

```
Browser <-> Crow IDE Server (:8000) <-> ACP Bridge <-> OpenHands ACP
```

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python Starlette server
- **Agent Communication**: ACP (Agent Communication Protocol) over WebSocket
- **Default Agent**: OpenHands (spawned as subprocess)

## Quick Start

### Prerequisites

- Python 3.12+ (managed via uv)
- Node.js 18+ and pnpm
- OpenHands-CLI (included in the orchestrator-project repository)

### Installation

```bash
cd ~/src/projects/letta-proj

# Sync the workspace (installs all dependencies)
uv sync

# Build the frontend
cd crow_ide/frontend
pnpm install
pnpm build
```

### Running

```bash
cd crow_ide
source .venv/bin/activate
uvicorn crow_ide.server:app --port 8000
```

Then open http://localhost:8000 in your browser.

On first launch, you'll be prompted to select a workspace directory. The AI agent will operate within this directory.

### Starting an Agent

Crow IDE supports multiple AI agents. OpenHands is the default and will be spawned automatically when you create a new session. Other agents can be started manually in separate terminals:

```bash
# Karla (local agent with Letta backend)
npx stdio-to-ws "karla-acp" --port 3000

# Claude Code (Anthropic)
npx stdio-to-ws "npx @zed-industries/claude-code-acp" --port 3017

# Gemini CLI (Google)
npx stdio-to-ws "npx @google/gemini-cli --experimental-acp" --port 3019

# Codex (Zed)
npx stdio-to-ws "npx @zed-industries/codex-acp" --port 3021
```

Then click "New session" in the IDE and select your agent.

## Project Structure

```
crow_ide/
├── server.py           # Main Starlette server
├── acp_bridge.py       # WebSocket proxy to karla-acp agent
├── db.py               # SQLite session history storage
├── api/                # API endpoint handlers
│   ├── files.py        # File operations (list, read, write, delete)
│   └── terminal.py     # Terminal WebSocket handler
├── frontend/           # React frontend
│   ├── src/
│   │   ├── App.tsx             # Main app layout
│   │   ├── components/
│   │   │   ├── acp/            # Agent panel components
│   │   │   │   ├── agent-panel.tsx   # Main agent chat UI
│   │   │   │   ├── state.ts          # Jotai state atoms
│   │   │   │   └── adapters.ts       # Utilities and helpers
│   │   │   ├── ui/             # Reusable UI components
│   │   │   ├── FileTree.tsx    # File explorer
│   │   │   ├── Terminal.tsx    # Terminal emulator
│   │   │   └── WorkspaceSelector.tsx
│   │   └── App.css             # Global styles
│   └── package.json
├── tests/              # Backend and E2E tests
└── pyproject.toml      # Python package config
```

## API Endpoints

### HTTP

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/files/list` | POST | List directory contents |
| `/api/files/details` | POST | Get file details and content |
| `/api/files/create` | POST | Create a new file |
| `/api/files/update` | POST | Update file contents |
| `/api/files/delete` | POST | Delete a file |
| `/api/directories/validate` | POST | Validate a directory path |
| `/api/sessions/list` | POST | List agent sessions |
| `/api/sessions/get` | POST | Get session with messages |
| `/api/sessions/delete` | POST | Delete a session |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/terminal` | Terminal pty connection |
| `/acp` | Agent Communication Protocol |

## Development

### Running Tests

```bash
# Backend tests
pytest crow_ide/tests/

# With coverage
pytest crow_ide/tests/ --cov=crow_ide
```

### Frontend Development

```bash
cd frontend

# Development server with hot reload
pnpm dev

# Type checking
pnpm tsc --noEmit

# Build for production
pnpm build
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CROW_WORKSPACE` | Default workspace path | Current directory |
| `CROW_OPENHANDS_CMD` | Command to spawn OpenHands ACP agent | `uv run --directory OpenHands-CLI openhands` |
| `CROW_CMD` | Command to spawn Crow ACP agent | `uv run --project crow crow` |
| `CROW_ACP_URL` | ACP WebSocket URL for external agents | `ws://localhost:3000/message` |

## Agent Integration

Crow IDE uses the Agent Communication Protocol (ACP) to communicate with AI agents. By default, it spawns OpenHands as a subprocess when you create a new session.

The ACP connection supports:
- Creating new sessions with a working directory (cwd)
- Sending prompts and receiving streaming responses
- Tool calls (file operations, terminal commands, etc.)
- Session history persistence
- Slash commands (e.g., `/clear`, `/compact`, `/help`)

### Supported Agents

#### OpenHands (Default)

OpenHands is spawned using the command specified in the `CROW_OPENHANDS_CMD` environment variable, or the default:

```bash
uv run --directory OpenHands-CLI openhands acp
```

You can customize this by setting the environment variable before starting the server:

```bash
export CROW_OPENHANDS_CMD="uv run --directory /path/to/OpenHands-CLI openhands"
uvicorn crow_ide.server:app --port 8000
```

#### Crow

Crow is a lightweight AI coding agent built on the OpenHands SDK. It's spawned using the command specified in the `CROW_CMD` environment variable, or the default:

```bash
uv run --project crow crow acp
```

You can customize this by setting the environment variable before starting the server:

```bash
export CROW_CMD="uv run --project /path/to/crow crow"
uvicorn crow_ide.server:app --port 8000
```

## License

MIT
