"""Models for structured data RAG — dataset metadata, schema embeddings, query examples, query logs, and business glossary.

Data tables live in a separate external Postgres instance.
These metadata models live in the app's embedded Postgres.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON, Float, Boolean
from sqlalchemy.orm import relationship

from src.config.database import Base

try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    Vector = lambda dim: Text  # noqa: E731
    PGVECTOR_AVAILABLE = False


class StructuredDataset(Base):
    """Metadata for an uploaded structured dataset."""
    __tablename__ = "structured_datasets"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    table_name = Column(String(255), nullable=False, unique=True)  # e.g. sd_1_network_perf
    source_filename = Column(String(500), nullable=False)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    schema_info = Column(JSON, default=dict)  # Introspected column stats
    status = Column(String(50), default="processing")  # processing, ready, error
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schema_embeddings = relationship(
        "StructuredSchemaEmbedding", back_populates="dataset", cascade="all, delete-orphan"
    )
    query_examples = relationship(
        "StructuredQueryExample", back_populates="dataset", cascade="all, delete-orphan"
    )
    query_logs = relationship(
        "StructuredQueryLog", back_populates="dataset", cascade="all, delete-orphan"
    )
    glossary_terms = relationship(
        "BusinessGlossary", back_populates="dataset", cascade="all, delete-orphan"
    )
    schema_metadata = relationship(
        "SchemaMetadata", back_populates="dataset", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_structured_datasets_status", "status"),
        Index("idx_structured_datasets_created_at", "created_at"),
    )


class StructuredSchemaEmbedding(Base):
    """Embedded schema descriptions for RAG retrieval."""
    __tablename__ = "structured_schema_embeddings"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("structured_datasets.id", ondelete="CASCADE"), nullable=False)
    description_type = Column(String(50), nullable=False)  # table_overview, column_detail, value_distribution
    column_name = Column(String(255), nullable=True)  # NULL for table-level descriptions
    description = Column(Text, nullable=False)
    embedding = Column(Vector(384) if PGVECTOR_AVAILABLE else Text)  # e5-small-v2
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("StructuredDataset", back_populates="schema_embeddings")

    __table_args__ = (
        Index("idx_structured_schema_embeddings_dataset_id", "dataset_id"),
    )


class StructuredQueryExample(Base):
    """Few-shot NL→SQL pairs with embeddings for RAG retrieval."""
    __tablename__ = "structured_query_examples"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("structured_datasets.id", ondelete="CASCADE"), nullable=False)
    natural_language = Column(Text, nullable=False)
    sql_query = Column(Text, nullable=False)
    is_seed = Column(Boolean, default=True)  # True = auto-generated, False = from user feedback
    embedding = Column(Vector(384) if PGVECTOR_AVAILABLE else Text)  # e5-small-v2
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("StructuredDataset", back_populates="query_examples")

    __table_args__ = (
        Index("idx_structured_query_examples_dataset_id", "dataset_id"),
    )


class StructuredQueryLog(Base):
    """Query history with execution stats and feedback."""
    __tablename__ = "structured_query_logs"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("structured_datasets.id", ondelete="CASCADE"), nullable=False)
    natural_language = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=False)
    was_executed = Column(Boolean, default=False)
    execution_time_ms = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    feedback = Column(String(20), nullable=True)  # good, bad
    llm_provider = Column(String(50), nullable=True)
    llm_model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("StructuredDataset", back_populates="query_logs")

    __table_args__ = (
        Index("idx_structured_query_logs_dataset_id", "dataset_id"),
        Index("idx_structured_query_logs_created_at", "created_at"),
    )


class SchemaMetadata(Base):
    """Human-curated schema descriptions — the LLM's map of the data.

    Auto-generated on ingest, then editable by the user to add domain context,
    business terms, and sample values that improve SQL generation quality.
    """
    __tablename__ = "structured_schema_metadata"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("structured_datasets.id", ondelete="CASCADE"), nullable=False)
    table_name = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=True)  # NULL = table-level description
    data_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)  # Plain English explanation
    sample_values = Column(Text, nullable=True)  # Representative examples
    business_term = Column(Text, nullable=True)  # Synonyms users might say
    is_filterable = Column(Boolean, default=True)
    is_metric = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("StructuredDataset", back_populates="schema_metadata")

    __table_args__ = (
        Index("idx_schema_metadata_dataset_id", "dataset_id"),
        Index("idx_schema_metadata_table_column", "table_name", "column_name"),
    )


class BusinessGlossary(Base):
    """Maps domain language to SQL expressions.

    When a user says 'high utilization', the glossary translates it to
    'cpu_utilization > 80 OR memory_utilization > 80' in the prompt.
    """
    __tablename__ = "structured_business_glossary"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("structured_datasets.id", ondelete="CASCADE"), nullable=False)
    term = Column(String(255), nullable=False)  # "high utilization"
    synonyms = Column(Text, nullable=True)  # "maxed out, overloaded, stressed"
    definition = Column(Text, nullable=False)  # Plain English meaning
    sql_expression = Column(Text, nullable=False)  # Actual SQL fragment
    applies_to = Column(String(255), nullable=True)  # Table or column name
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("StructuredDataset", back_populates="glossary_terms")

    __table_args__ = (
        Index("idx_business_glossary_dataset_id", "dataset_id"),
    )
