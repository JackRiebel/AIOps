#!/usr/bin/env python3
"""Migration script to add RAG knowledge base tables with pgvector support.

This migration:
1. Enables the pgvector extension
2. Creates tables for document storage and vector embeddings
3. Creates indexes for efficient similarity search
"""

import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


async def run_migration():
    """Run the knowledge base migration."""
    database_url = os.getenv("DATABASE_URL", "postgresql://mcp_user:changeme@localhost:15432/meraki_mcp")

    # Convert to async URL if needed
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Step 1: Enable pgvector extension
            print("Enabling pgvector extension...")
            await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await session.commit()
            print("✓ pgvector extension enabled")

            # Step 2: Create knowledge_documents table
            print("\nCreating knowledge_documents table...")
            await session.execute(text("""
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
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            """))
            await session.commit()
            print("✓ knowledge_documents table created")

            # Step 3: Create knowledge_chunks table with vector column
            print("\nCreating knowledge_chunks table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS knowledge_chunks (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER REFERENCES knowledge_documents(id) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    content_tokens INTEGER,
                    metadata JSONB DEFAULT '{}',
                    embedding vector(1536),
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(document_id, chunk_index)
                );
            """))
            await session.commit()
            print("✓ knowledge_chunks table created")

            # Step 4: Create indexes
            print("\nCreating indexes...")

            # Vector similarity index using HNSW (better for large datasets)
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
                ON knowledge_chunks
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """))
            print("✓ HNSW index created for embeddings")

            # Metadata GIN index for filtering
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_metadata
                ON knowledge_chunks USING gin (metadata);
            """))
            print("✓ GIN index created for metadata")

            # Document indexes
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_documents_product
                ON knowledge_documents(product);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_documents_doc_type
                ON knowledge_documents(doc_type);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_hash
                ON knowledge_documents(content_hash);
            """))
            print("✓ Document lookup indexes created")

            await session.commit()

            # Step 5: Create knowledge_queries table for analytics
            print("\nCreating knowledge_queries table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS knowledge_queries (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    query_text TEXT NOT NULL,
                    context JSONB,
                    retrieved_chunk_ids INTEGER[],
                    response TEXT,
                    response_tokens INTEGER,
                    latency_ms INTEGER,
                    feedback_score INTEGER,
                    model_used VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
            await session.commit()
            print("✓ knowledge_queries table created")

            # Create index for query analytics
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user_id
                ON knowledge_queries(user_id);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_knowledge_queries_created_at
                ON knowledge_queries(created_at DESC);
            """))
            await session.commit()
            print("✓ Query analytics indexes created")

            # Step 6: Verify installation
            print("\n" + "="*50)
            print("Verifying installation...")

            # Check pgvector is working
            result = await session.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector';"))
            row = result.fetchone()
            if row:
                print(f"✓ pgvector version: {row[0]}")

            # Check tables exist
            result = await session.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name LIKE 'knowledge%'
                ORDER BY table_name;
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"✓ Knowledge tables created: {', '.join(tables)}")

            # Test vector operations
            await session.execute(text("""
                SELECT '[1,2,3]'::vector <-> '[3,2,1]'::vector as distance;
            """))
            print("✓ Vector operations working")

            print("\n" + "="*50)
            print("Migration completed successfully!")
            print("="*50)

        except Exception as e:
            print(f"\n✗ Migration failed: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_migration())
