from http.client import HTTPException
import os
from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
import psycopg

load_dotenv()

# Prefer MEMORY_DB_URL from environment; fallback to local default for dev
DB_URI = os.getenv(
    "MEMORY_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/obrolin_memory",
)

# Initialize langgraph postgres checkpoint schema
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()


def get_db_connection():
    return psycopg.connect(DB_URI, autocommit=True)


def create_conversations_table():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS conversation_metadata (
                        thread_id VARCHAR PRIMARY KEY,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


create_conversations_table()