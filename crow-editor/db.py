"""
Crow IDE Database - SQLite session persistence.

Stores all agent sessions and messages for replay and training data extraction.
"""

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional


# Default database location
DEFAULT_DB_PATH = Path.home() / ".crow_ide" / "sessions.db"


def get_db_path() -> Path:
    """Get the database path, creating parent directory if needed."""
    db_path = DEFAULT_DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path 


@contextmanager
def get_connection(db_path: Optional[Path] = None) -> Generator[sqlite3.Connection, None, None]:
    """Get a database connection with row factory."""
    path = db_path or get_db_path()
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize the database schema."""
    with get_connection(db_path) as conn:
        conn.executescript("""
            -- Sessions table
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                agent_type TEXT NOT NULL,
                agent_session_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                title TEXT,
                metadata TEXT
            );

            -- Messages table
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                direction TEXT NOT NULL,  -- 'inbound' (from agent) or 'outbound' (to agent)
                message_type TEXT,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                sequence_number INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_sessions_agent_type ON sessions(agent_type);
            CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
        """)
        conn.commit()


class SessionStore:
    """Store for agent sessions and messages."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_db_path()
        init_db(self.db_path)

    def create_session(
        self,
        agent_type: str,
        agent_session_id: Optional[str] = None,
        title: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> str:
        """Create a new session and return its ID."""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with get_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO sessions (id, agent_type, agent_session_id, created_at, updated_at, title, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    agent_type,
                    agent_session_id,
                    now,
                    now,
                    title,
                    json.dumps(metadata) if metadata else None,
                ),
            )
            conn.commit()

        return session_id

    def update_session(
        self,
        session_id: str,
        agent_session_id: Optional[str] = None,
        title: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        """Update session metadata."""
        now = datetime.utcnow().isoformat()

        with get_connection(self.db_path) as conn:
            updates = ["updated_at = ?"]
            params: list[Any] = [now]

            if agent_session_id is not None:
                updates.append("agent_session_id = ?")
                params.append(agent_session_id)

            if title is not None:
                updates.append("title = ?")
                params.append(title)

            if metadata is not None:
                updates.append("metadata = ?")
                params.append(json.dumps(metadata))

            params.append(session_id)

            conn.execute(
                f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            conn.commit()

    def add_message(
        self,
        session_id: str,
        direction: str,
        content: str,
        message_type: Optional[str] = None,
    ) -> str:
        """Add a message to a session."""
        message_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with get_connection(self.db_path) as conn:
            # Get next sequence number
            cursor = conn.execute(
                "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM messages WHERE session_id = ?",
                (session_id,),
            )
            seq_num = cursor.fetchone()[0]

            conn.execute(
                """
                INSERT INTO messages (id, session_id, direction, message_type, content, timestamp, sequence_number)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (message_id, session_id, direction, message_type, content, now, seq_num),
            )

            # Update session updated_at
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id),
            )

            conn.commit()

        return message_id

    def get_session(self, session_id: str) -> Optional[dict]:
        """Get a session by ID."""
        with get_connection(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT * FROM sessions WHERE id = ?",
                (session_id,),
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    def get_session_messages(self, session_id: str) -> list[dict]:
        """Get all messages for a session."""
        with get_connection(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM messages
                WHERE session_id = ?
                ORDER BY sequence_number
                """,
                (session_id,),
            )
            return [dict(row) for row in cursor.fetchall()]

    def list_sessions(
        self,
        agent_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """List sessions with optional filtering."""
        with get_connection(self.db_path) as conn:
            if agent_type:
                cursor = conn.execute(
                    """
                    SELECT * FROM sessions
                    WHERE agent_type = ?
                    ORDER BY updated_at DESC
                    LIMIT ? OFFSET ?
                    """,
                    (agent_type, limit, offset),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT * FROM sessions
                    ORDER BY updated_at DESC
                    LIMIT ? OFFSET ?
                    """,
                    (limit, offset),
                )
            return [dict(row) for row in cursor.fetchall()]

    def delete_session(self, session_id: str) -> bool:
        """Delete a session and its messages."""
        with get_connection(self.db_path) as conn:
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            cursor = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0


# Global store instance
_store: Optional[SessionStore] = None


def get_store() -> SessionStore:
    """Get the global session store."""
    global _store
    if _store is None:
        _store = SessionStore()
    return _store
