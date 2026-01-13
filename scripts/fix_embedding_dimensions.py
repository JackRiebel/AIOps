"""Create knowledge tables with 384-dimension vectors."""

import asyncio
import asyncpg

KNOWLEDGE_SCHEMA = """
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    filepath VARCHAR(1000),
    doc_type VARCHAR(50) NOT NULL,
    product VARCHAR(100),
    version VARCHAR(50),
    title VARCHAR(500),
    description TEXT,
    source_url VARCHAR(1000),
    content_hash VARCHAR(64) UNIQUE,
    total_chunks INTEGER DEFAULT 0,
    doc_metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge chunks table with 384-dimension vectors (e5-small-v2)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_tokens INTEGER,
    quality_score FLOAT,
    chunk_metadata JSON DEFAULT '{}',
    embedding VECTOR(384),
    created_at TIMESTAMP DEFAULT NOW(),
    parent_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    hierarchy_level INTEGER DEFAULT 2
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_parent ON knowledge_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hierarchy ON knowledge_chunks(document_id, hierarchy_level);

-- Knowledge entities table
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    description TEXT,
    aliases JSON DEFAULT '[]',
    properties JSON DEFAULT '{}',
    source_count INTEGER DEFAULT 1,
    embedding VECTOR(384),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(normalized_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_normalized_name ON knowledge_entities(normalized_name);

-- Knowledge relationships table
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id SERIAL PRIMARY KEY,
    source_entity_id INTEGER REFERENCES knowledge_entities(id) ON DELETE CASCADE NOT NULL,
    target_entity_id INTEGER REFERENCES knowledge_entities(id) ON DELETE CASCADE NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    weight FLOAT DEFAULT 1.0,
    properties JSON DEFAULT '{}',
    source_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON knowledge_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target ON knowledge_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);

-- Entity chunk mentions table
CREATE TABLE IF NOT EXISTS entity_chunk_mentions (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES knowledge_entities(id) ON DELETE CASCADE NOT NULL,
    chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE CASCADE NOT NULL,
    mention_count INTEGER DEFAULT 1,
    mention_positions JSON DEFAULT '[]',
    context_snippet TEXT,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_chunk_mentions_entity ON entity_chunk_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_chunk_mentions_chunk ON entity_chunk_mentions(chunk_id);

-- Chunk references table
CREATE TABLE IF NOT EXISTS chunk_references (
    id SERIAL PRIMARY KEY,
    source_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE CASCADE NOT NULL,
    target_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE CASCADE NOT NULL,
    reference_type VARCHAR(50) DEFAULT 'see_also',
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_chunk_id, target_chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_chunk_references_source ON chunk_references(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_references_target ON chunk_references(target_chunk_id);

-- Agent sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    implementation_goal TEXT,
    environment_snapshot JSON,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    consultation_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    accumulated_discoveries JSON DEFAULT '[]',
    conversation_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created_at ON agent_sessions(created_at);

-- Knowledge queries table
CREATE TABLE IF NOT EXISTS knowledge_queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    agent_session_id VARCHAR(64),
    query_text TEXT NOT NULL,
    context JSON,
    retrieved_chunk_ids JSON,
    response TEXT,
    response_tokens INTEGER,
    latency_ms INTEGER,
    feedback_score INTEGER,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    query_classification JSON DEFAULT '{}',
    retrieval_metrics JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user_id ON knowledge_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_created_at ON knowledge_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_agent_session ON knowledge_queries(agent_session_id);

-- Knowledge feedback table
CREATE TABLE IF NOT EXISTS knowledge_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    query_text TEXT NOT NULL,
    feedback_type VARCHAR(20) NOT NULL,
    feedback_target VARCHAR(20) NOT NULL,
    chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    rating INTEGER,
    comment TEXT,
    feedback_metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_user_id ON knowledge_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_type ON knowledge_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_target ON knowledge_feedback(feedback_target);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_chunk_id ON knowledge_feedback(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_created_at ON knowledge_feedback(created_at);
"""

async def create_knowledge_tables():
    # Connect to the embedded PostgreSQL via Unix socket
    conn = await asyncpg.connect(
        host='/Users/jariebel/Desktop/Lumen/data/postgres',
        database='lumen',
        user='postgres'
    )

    try:
        print("Connected to database")

        # Execute the schema
        print("Creating knowledge tables with 384-dimension vectors...")
        await conn.execute(KNOWLEDGE_SCHEMA)
        print("Knowledge tables created successfully!")

        # Verify
        tables = await conn.fetch("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'knowledge%'
            ORDER BY table_name
        """)
        print(f"Created tables: {[t['table_name'] for t in tables]}")

    except Exception as e:
        print(f"Error: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(create_knowledge_tables())
