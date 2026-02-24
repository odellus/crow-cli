#!/usr/bin/env python3
"""Add the missing 'crow-v1' prompt to the database."""

import os
from crow.agent.db import create_database, Prompt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SQLAlchemySession


def add_crow_v1_prompt(db_path: str | None = None) -> None:
    """Add the 'crow-v1' prompt if it doesn't exist."""
    if db_path is None:
        # Use the default database path from config
        db_path = os.environ.get("CROW_DB_PATH", "sqlite:////home/thomas/.crow/crow.db")
    
    # Create database if it doesn't exist
    create_database(db_path)
    
    # Add prompt
    db = SQLAlchemySession(create_engine(db_path))
    try:
        existing = db.query(Prompt).filter_by(id="crow-v1").first()
        if not existing:
            prompt = Prompt(
                id="crow-v1",
                name="Crow Default Prompt",
                template="You are a helpful assistant. Workspace: {{workspace}}",
            )
            db.add(prompt)
            db.commit()
            print(f"✓ Added prompt 'crow-v1' to database")
        else:
            print(f"✓ Prompt 'crow-v1' already exists")
    finally:
        db.close()


if __name__ == "__main__":
    add_crow_v1_prompt()
