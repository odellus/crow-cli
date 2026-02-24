# Kimi Next Steps - Crow ACP Project

## Current State

**Working:** 
- db_v2.py schema with Message table (one row = one message)
- Session management with coolname-based IDs
- Typer CLI client (`client.py`) for testing
- Agent messages appear exactly once per conversation - **no duplication**

## Active Issues to Address

### 1. Cleanup: Cancel Events and State Accumulators

The `_cancel_events` and `_state_accumulators` in `agent.py` are legacy from the old db.py approach. They may not be needed anymore.

**Files involved:**
- `/home/thomas/src/nid/crow-acp/src/crow_acp/agent.py` (lines 116-119, 452-462, 505-507)
- `/home/thomas/src/nid/crow-acp/src/crow_acp/react.py` (lines 311, 313, 330, 339-355, 361, 421)

**Observation:** No code currently calls `cancel_event.set()` - the cancellation mechanism is never triggered!

**Questions to answer:**
1. Is cancellation actually needed? If so, what triggers it?
2. If we keep it, state_accumulator is used to save partial state on CancelledError
3. If we remove it, we can delete ~30 lines of code across both files

### 2. Test Load Session Flow

The `-s` flag for loading sessions needs more testing:

```bash
# Create a session first
uv --project crow-acp run crow-acp/scripts/client.py run "hello"

# Note the session ID from output, then continue:
uv --project crow-acp run crow-acp/scripts/client.py run -s <session-id> "what did I just say?"
```

---

## Testing Commands

### End-to-End Testing with Client

```bash
# Single-shot mode (default) - send prompt, get response, exit
uv --project crow-acp run crow-acp/scripts/client.py run "what is 2+2?"

# Interactive mode - REPL loop
uv --project crow-acp run crow-acp/scripts/client.py run -i

# Load existing session by ID
uv --project crow-acp run crow-acp/scripts/client.py run -s <session-id> "continue this conversation"

# Inspect database - list all sessions
uv --project crow-acp run crow-acp/scripts/client.py inspect

# Inspect specific session with messages
uv --project crow-acp run crow-acp/scripts/client.py inspect -s <session-id> -m
```

### Database Location

```
~/.crow/crow.db
```

### Session ID Format

Coolname-based: `{4-word-slug}-{uuid6}`

Example: `emotional-wine-trogon-of-development-590684`

---

## Key Files

| File | Purpose |
|------|---------|
| `crow-acp/src/crow_acp/db_v2.py` | Clean DB schema - Prompt, Session, Message tables |
| `crow-acp/src/crow_acp/session.py` | Session management with coolname IDs |
| `crow-acp/src/crow_acp/agent.py` | AcpAgent class implementing ACP protocol |
| `crow-acp/src/crow_acp/react.py` | ReAct loop with tool execution |
| `crow-acp/scripts/client.py` | Typer CLI for testing |

---

## Design Philosophy (from context)

- Flask-style extensions, no circular dependencies
- No sys.path manipulation
- Use `uv --project crow-acp add <package>` for dependencies
- Use lowercase `edit` tool, not StrReplaceFile
- Don't write tests first - build and test manually with client
- Local observability = stateful agents (full transparency into agent behavior)

---

## Quick Reference: Running Commands

```bash
# ALWAYS use this pattern:
uv --project /path/to/project run /path/to/script.py

# For crow-acp specifically:
uv --project crow-acp run crow-acp/scripts/client.py <command>
```
