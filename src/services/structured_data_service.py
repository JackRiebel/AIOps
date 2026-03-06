"""Structured data service — upload, parse, introspect, and manage datasets.

Data tables live in a separate external Postgres (via structured_data_db).
Metadata (dataset records, embeddings, query examples) lives in the app's embedded Postgres.
"""

import io
import re
import math
import logging
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.structured_data_db import get_structured_engine
from src.models.structured_dataset import (
    StructuredDataset,
    StructuredSchemaEmbedding,
    StructuredQueryExample,
    SchemaMetadata,
)
from src.services.embedding_service import get_embedding_service
from src.services.agentic_rag.llm_adapter import get_agentic_rag_llm_service

logger = logging.getLogger(__name__)

# Pandas dtype → Postgres type mapping
DTYPE_MAP = {
    "int64": "BIGINT",
    "int32": "INTEGER",
    "float64": "DOUBLE PRECISION",
    "float32": "REAL",
    "bool": "BOOLEAN",
    "datetime64[ns]": "TIMESTAMP",
    "object": "TEXT",
}


def _sanitize_json(obj):
    """Recursively replace NaN/Infinity with None so it's valid JSON."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    return obj


def _sanitize_name(name: str) -> str:
    """Sanitize a string for use as a Postgres identifier."""
    s = re.sub(r"[^a-zA-Z0-9_]", "_", name.lower())
    s = re.sub(r"_+", "_", s).strip("_")
    return s[:60]


def _pg_type_for_series(series: pd.Series) -> str:
    """Infer the best Postgres type for a pandas Series."""
    dtype_str = str(series.dtype)
    if dtype_str in DTYPE_MAP:
        if dtype_str == "object":
            # Try to detect dates / numbers in object columns
            non_null = series.dropna()
            if len(non_null) == 0:
                return "TEXT"
            sample = non_null.head(100)
            # Try numeric
            try:
                pd.to_numeric(sample)
                return "DOUBLE PRECISION"
            except (ValueError, TypeError):
                pass
            # Try datetime
            try:
                pd.to_datetime(sample, format="mixed")
                return "TIMESTAMP"
            except (ValueError, TypeError):
                pass
            return "TEXT"
        return DTYPE_MAP[dtype_str]
    if "datetime" in dtype_str:
        return "TIMESTAMP"
    if "int" in dtype_str:
        return "BIGINT"
    if "float" in dtype_str:
        return "DOUBLE PRECISION"
    return "TEXT"


class StructuredDataService:
    """Service for ingesting, introspecting, and managing structured datasets."""

    async def analyze_columns(
        self,
        file_content: bytes,
        filename: str,
        provider: Optional[str] = None,
    ) -> dict:
        """Parse a file and use the LLM to suggest explicit, self-describing column names.

        Args:
            file_content: Raw file bytes
            filename: Original filename
            provider: LLM provider to use (defaults to Ollama/whatever is configured)

        Returns:
            {"columns": [{"original": str, "suggested": str, "sample_values": [...]}]}
        """
        df = self._parse_file(file_content, filename)

        # Build column info with sample values for the LLM
        col_info = []
        for col in df.columns:
            samples = df[col].dropna().head(5).tolist()
            # Convert to plain strings for serialization
            sample_strs = [str(v) for v in samples]
            col_info.append({
                "original": str(col),
                "sample_values": sample_strs,
                "dtype": str(df[col].dtype),
                "distinct_count": int(df[col].nunique()),
                "null_pct": round(float(df[col].isna().mean() * 100), 1),
            })

        # Build LLM prompt
        prompt = self._build_column_rename_prompt(col_info)

        llm_service = get_agentic_rag_llm_service()
        if not llm_service:
            # No LLM available — return originals as-is
            return {"columns": [
                {"original": c["original"], "suggested": _sanitize_name(c["original"]), "sample_values": c["sample_values"]}
                for c in col_info
            ]}

        try:
            raw = await llm_service.generate(
                prompt=prompt,
                json_output=True,
                max_tokens=2048,
                temperature=0.0,
                provider=provider,
            )

            # Parse the JSON response
            import json
            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```\w*\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)

            result = json.loads(cleaned)
            renames = result.get("columns", result.get("renames", []))

            # Build response, merging LLM suggestions with sample data
            columns = []
            for ci in col_info:
                original = ci["original"]
                suggested = original
                for r in renames:
                    if r.get("original", "").strip() == original.strip():
                        suggested = r.get("suggested", original)
                        break
                # Sanitize the suggestion for Postgres compatibility
                sanitized = _sanitize_name(suggested)
                columns.append({
                    "original": original,
                    "suggested": sanitized,
                    "sample_values": ci["sample_values"],
                })

            return {"columns": columns}

        except Exception as e:
            logger.warning(f"LLM column analysis failed, returning originals: {e}")
            return {"columns": [
                {"original": c["original"], "suggested": _sanitize_name(c["original"]), "sample_values": c["sample_values"]}
                for c in col_info
            ]}

    def _build_column_rename_prompt(self, col_info: list[dict]) -> str:
        """Build the prompt for LLM column renaming."""
        lines = []
        for c in col_info:
            samples = ", ".join(c["sample_values"][:5])
            lines.append(
                f"- Column: \"{c['original']}\" | dtype: {c['dtype']} | "
                f"{c['distinct_count']} distinct | {c['null_pct']}% null | "
                f"samples: [{samples}]"
            )

        return f"""You are a data engineering expert. Your job is to rename abbreviated or unclear column names into explicit, self-describing names that a text-to-SQL LLM can understand without any additional context.

NAMING RULES:
- Use snake_case (lowercase with underscores)
- Max 60 characters
- Expand ALL abbreviations (e.g., "avg" → "average", "util" → "utilization", "pct" → "percent")
- Include the unit or type if inferable from sample values (e.g., "_ms", "_bytes", "_percent", "_count")
- Include the entity if clear from context (e.g., "cpu_utilization_percent" not just "utilization")
- If a column is already clear and explicit, keep it as-is (just clean to snake_case)
- Never lose information from the original name

COLUMNS TO RENAME:
{chr(10).join(lines)}

Return valid JSON with this exact structure:
{{"columns": [{{"original": "original_name", "suggested": "explicit_descriptive_name"}}]}}

Return ONLY the JSON, nothing else."""

    async def ingest_file(
        self,
        session: AsyncSession,
        file_content: bytes,
        filename: str,
        dataset_name: Optional[str] = None,
        column_renames: Optional[dict[str, str]] = None,
    ) -> StructuredDataset:
        """Full ingest pipeline: parse → rename columns → create table → introspect → embed schema.

        Args:
            session: App DB session (for metadata storage)
            file_content: Raw file bytes
            filename: Original filename
            dataset_name: Optional human-readable name
            column_renames: Optional mapping of original column name → new explicit name

        Returns:
            StructuredDataset record
        """
        name = dataset_name or filename.rsplit(".", 1)[0]

        # Create dataset record first
        dataset = StructuredDataset(
            name=name,
            table_name="",  # Filled after we get the ID
            source_filename=filename,
            status="processing",
        )
        session.add(dataset)
        await session.flush()  # Get the ID

        table_name = f"sd_{dataset.id}_{_sanitize_name(name)}"
        dataset.table_name = table_name

        try:
            # Parse file
            df = self._parse_file(file_content, filename)
            dataset.row_count = len(df)
            dataset.column_count = len(df.columns)

            # Apply LLM-suggested column renames before sanitization
            if column_renames:
                df = df.rename(columns={
                    orig: rename for orig, rename in column_renames.items()
                    if orig in df.columns
                })

            # Sanitize column names
            df.columns = [_sanitize_name(c) for c in df.columns]

            # Infer column types
            col_types = {col: _pg_type_for_series(df[col]) for col in df.columns}

            # Create table + insert data in external Postgres
            await self._create_and_populate_table(table_name, df, col_types)

            # Introspect column statistics from external Postgres
            schema_info = await self._introspect_table(table_name, df.columns.tolist(), col_types)
            # Sanitize NaN/Infinity before storing as JSON
            schema_info = _sanitize_json(schema_info)
            dataset.schema_info = schema_info

            # Generate editable schema metadata (the LLM's map of the data)
            await self._generate_schema_metadata(session, dataset, schema_info)

            # Generate and embed schema descriptions + seed queries
            # These are nice-to-have — don't fail the whole ingest if embeddings break
            try:
                await self._generate_and_embed_schema(session, dataset, schema_info)
                await self._generate_and_embed_seed_queries(session, dataset, schema_info)
            except Exception as e:
                logger.warning(f"Embedding generation failed (dataset still usable): {e}")

            dataset.status = "ready"
            logger.info(f"Dataset '{name}' ingested: {dataset.row_count} rows, {dataset.column_count} columns → {table_name}")

        except Exception as e:
            dataset.status = "error"
            dataset.error_message = str(e)[:2000]
            logger.exception(f"Failed to ingest dataset '{name}': {e}")

        return dataset

    def _parse_file(self, content: bytes, filename: str) -> pd.DataFrame:
        """Parse Excel or CSV file content into a DataFrame."""
        lower = filename.lower()
        buf = io.BytesIO(content)
        if lower.endswith((".xlsx", ".xls")):
            df = pd.read_excel(buf)
        elif lower.endswith(".csv"):
            df = pd.read_csv(buf)
        else:
            raise ValueError(f"Unsupported file type: {filename}. Use .xlsx, .xls, or .csv")

        if df.empty:
            raise ValueError("File contains no data")
        if len(df.columns) == 0:
            raise ValueError("File contains no columns")

        return df

    async def _create_and_populate_table(
        self,
        table_name: str,
        df: pd.DataFrame,
        col_types: dict[str, str],
    ):
        """Create a table and bulk insert data in the external Postgres."""
        engine = get_structured_engine()

        # Build CREATE TABLE DDL
        col_defs = ", ".join(
            f'"{col}" {pg_type}' for col, pg_type in col_types.items()
        )
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" (id SERIAL PRIMARY KEY, {col_defs})'

        async with engine.begin() as conn:
            await conn.execute(text(create_sql))

        # Bulk insert using executemany with parameterized query
        columns = list(col_types.keys())
        col_list = ", ".join(f'"{c}"' for c in columns)
        placeholders = ", ".join(f":{c}" for c in columns)
        insert_sql = f'INSERT INTO "{table_name}" ({col_list}) VALUES ({placeholders})'

        # Convert DataFrame to list of dicts, handling NaN → None
        records = df[columns].where(df[columns].notna(), None).to_dict("records")

        # Convert numpy/pandas types to Python native types for asyncpg
        clean_records = []
        for record in records:
            clean = {}
            for k, v in record.items():
                if v is None:
                    clean[k] = None
                elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    clean[k] = None  # NaN/Inf → SQL NULL (not IEEE 754 NaN)
                elif hasattr(v, "item"):  # numpy scalar
                    val = v.item()
                    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                        clean[k] = None
                    else:
                        clean[k] = val
                elif isinstance(v, pd.Timestamp):
                    clean[k] = v.to_pydatetime()
                else:
                    clean[k] = v
            clean_records.append(clean)

        # Insert in batches
        batch_size = 1000
        async with engine.begin() as conn:
            for i in range(0, len(clean_records), batch_size):
                batch = clean_records[i : i + batch_size]
                await conn.execute(text(insert_sql), batch)

    async def _introspect_table(
        self,
        table_name: str,
        columns: list[str],
        col_types: dict[str, str],
    ) -> dict:
        """Run introspection queries against the external table."""
        engine = get_structured_engine()
        schema_info = {"columns": {}}

        async with engine.connect() as conn:
            # Get row count
            result = await conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            total_rows = result.scalar() or 0

            for col in columns:
                pg_type = col_types[col]
                info: dict = {"type": pg_type}

                # Count distinct values and nulls
                result = await conn.execute(
                    text(f'SELECT COUNT(DISTINCT "{col}"), COUNT(*) - COUNT("{col}") FROM "{table_name}"')
                )
                row = result.fetchone()
                info["distinct_count"] = row[0] if row else 0
                info["null_count"] = row[1] if row else 0

                # Numeric stats
                if pg_type in ("BIGINT", "INTEGER", "DOUBLE PRECISION", "REAL"):
                    result = await conn.execute(
                        text(f'SELECT MIN("{col}"), MAX("{col}"), AVG("{col}")::DOUBLE PRECISION FROM "{table_name}"')
                    )
                    row = result.fetchone()
                    if row:
                        info["min"] = float(row[0]) if row[0] is not None else None
                        info["max"] = float(row[1]) if row[1] is not None else None
                        info["avg"] = round(float(row[2]), 4) if row[2] is not None else None

                # Sample values for categorical columns (≤50 distinct)
                if pg_type == "TEXT" and info["distinct_count"] <= 50:
                    result = await conn.execute(
                        text(f'SELECT DISTINCT "{col}" FROM "{table_name}" WHERE "{col}" IS NOT NULL ORDER BY "{col}" LIMIT 50')
                    )
                    info["sample_values"] = [str(r[0]) for r in result.fetchall()]

                # Sample values for other types (first 5)
                elif info["distinct_count"] > 50 or pg_type != "TEXT":
                    result = await conn.execute(
                        text(f'SELECT DISTINCT "{col}" FROM "{table_name}" WHERE "{col}" IS NOT NULL LIMIT 5')
                    )
                    info["sample_values"] = [str(r[0]) for r in result.fetchall()]

                schema_info["columns"][col] = info

        schema_info["total_rows"] = total_rows
        return schema_info

    async def _generate_schema_metadata(
        self,
        session: AsyncSession,
        dataset: StructuredDataset,
        schema_info: dict,
    ):
        """Auto-generate editable SchemaMetadata rows from introspection.

        These are the human-editable descriptions the guide calls 'schema_metadata'.
        Auto-populated on ingest, then the user can edit descriptions, add business
        terms, and mark columns as metrics/filterable to improve SQL generation.
        """
        table = dataset.table_name

        # Table-level description
        col_names = list(schema_info.get("columns", {}).keys())
        table_desc = (
            f"Table with {schema_info.get('total_rows', 0)} rows and {len(col_names)} columns: "
            f"{', '.join(col_names)}"
        )
        session.add(SchemaMetadata(
            dataset_id=dataset.id,
            table_name=table,
            column_name=None,
            description=table_desc,
        ))

        # Column-level descriptions — make them extremely explicit
        for col_name, col_info in schema_info.get("columns", {}).items():
            pg_type = col_info["type"]
            is_metric = pg_type in ("BIGINT", "INTEGER", "DOUBLE PRECISION", "REAL")
            distinct = col_info.get("distinct_count", 0)
            null_count = col_info.get("null_count", 0)
            total = schema_info.get("total_rows", 1) or 1

            parts = []

            # Type + semantic hint
            if pg_type == "TEXT":
                if distinct <= 10:
                    parts.append(f"Categorical TEXT column with {distinct} distinct values.")
                elif distinct <= 50:
                    parts.append(f"Low-cardinality TEXT column with {distinct} distinct values.")
                else:
                    parts.append(f"High-cardinality TEXT column ({distinct} distinct values — likely identifiers).")
            elif pg_type == "TIMESTAMP":
                parts.append("Timestamp column (date/time values).")
            elif pg_type == "BOOLEAN":
                parts.append("Boolean column (true/false).")
            elif is_metric:
                parts.append(f"Numeric {pg_type} column — likely a measurable metric.")
            else:
                parts.append(f"{pg_type} column.")

            # Range + average for numerics (encode the scale explicitly)
            min_v = col_info.get("min")
            max_v = col_info.get("max")
            avg_v = col_info.get("avg")
            if min_v is not None and max_v is not None:
                parts.append(f"Range: {min_v} to {max_v}.")
                if avg_v is not None:
                    parts.append(f"Average: {avg_v}.")
                # If it looks like a percentage (0-100 range)
                if is_metric and min_v >= 0 and max_v <= 100:
                    parts.append("Scale suggests a percentage (0–100).")
                elif is_metric and min_v >= 0 and max_v <= 1:
                    parts.append("Scale suggests a ratio (0.0–1.0).")

            # Null info
            if null_count > 0:
                pct = round(100 * null_count / total, 1)
                parts.append(f"{null_count} nulls ({pct}% of rows).")

            parts.append(f"{distinct} distinct values total.")

            samples = col_info.get("sample_values", [])
            sample_str = ", ".join(samples[:10]) if samples else None

            session.add(SchemaMetadata(
                dataset_id=dataset.id,
                table_name=table,
                column_name=col_name,
                data_type=pg_type,
                description=" ".join(parts),
                sample_values=sample_str,
                business_term=None,  # User fills this in
                is_filterable=True,
                is_metric=is_metric,
            ))

    async def _generate_and_embed_schema(
        self,
        session: AsyncSession,
        dataset: StructuredDataset,
        schema_info: dict,
    ):
        """Generate NL schema descriptions and embed them."""
        embedding_service = get_embedding_service()
        descriptions = []

        # Table overview
        col_summaries = []
        for col_name, col_info in schema_info.get("columns", {}).items():
            s = f"{col_name} ({col_info['type']}, {col_info['distinct_count']} distinct)"
            if "avg" in col_info and col_info["avg"] is not None:
                s += f", avg {col_info['avg']}"
            col_summaries.append(s)

        overview = (
            f"Table '{dataset.table_name}' has {schema_info.get('total_rows', 0)} rows. "
            f"Columns: {', '.join(col_summaries)}"
        )
        descriptions.append(("table_overview", None, overview))

        # Column details — explicit descriptions that encode type, range, unit hints
        for col_name, col_info in schema_info.get("columns", {}).items():
            pg_type = col_info["type"]
            distinct = col_info.get("distinct_count", 0)
            is_numeric = pg_type in ("BIGINT", "INTEGER", "DOUBLE PRECISION", "REAL")

            parts = [f"Column \"{col_name}\" is {pg_type}."]

            min_v, max_v = col_info.get("min"), col_info.get("max")
            if is_numeric and min_v is not None and max_v is not None:
                parts.append(f"Range: {min_v} to {max_v}, average {col_info.get('avg', 'N/A')}.")
                if min_v >= 0 and max_v <= 100:
                    parts.append("Likely a percentage (0-100 scale).")
            elif pg_type == "TEXT" and distinct <= 50:
                vals = col_info.get("sample_values", [])
                if vals:
                    parts.append(f"Categorical with {distinct} values: {', '.join(vals[:15])}.")
            elif pg_type == "TIMESTAMP":
                parts.append("Contains date/time values. Use DATE_TRUNC for time-series grouping.")

            parts.append(f"{distinct} distinct values.")

            if col_info.get("null_count", 0) > 0:
                total = schema_info.get("total_rows", 1) or 1
                pct = round(100 * col_info["null_count"] / total, 1)
                parts.append(f"{pct}% nulls.")

            descriptions.append(("column_detail", col_name, " ".join(parts)))

        # Value distributions for categorical columns
        for col_name, col_info in schema_info.get("columns", {}).items():
            if col_info["type"] == "TEXT" and col_info["distinct_count"] <= 50:
                vals = col_info.get("sample_values", [])
                if vals:
                    desc = f"Column '{col_name}' values: {', '.join(vals)}"
                    descriptions.append(("value_distribution", col_name, desc))

        # Embed and store
        for desc_type, col_name, desc_text in descriptions:
            embedding = await embedding_service.generate_embedding(desc_text)
            emb_record = StructuredSchemaEmbedding(
                dataset_id=dataset.id,
                description_type=desc_type,
                column_name=col_name,
                description=desc_text,
                embedding=embedding,
            )
            session.add(emb_record)

    async def _generate_and_embed_seed_queries(
        self,
        session: AsyncSession,
        dataset: StructuredDataset,
        schema_info: dict,
    ):
        """Generate few-shot NL→SQL examples from column types and embed them."""
        embedding_service = get_embedding_service()
        table = dataset.table_name
        columns = schema_info.get("columns", {})

        numeric_cols = [c for c, i in columns.items() if i["type"] in ("BIGINT", "INTEGER", "DOUBLE PRECISION", "REAL")]
        text_cols = [c for c, i in columns.items() if i["type"] == "TEXT" and i["distinct_count"] <= 50]
        timestamp_cols = [c for c, i in columns.items() if i["type"] == "TIMESTAMP"]

        examples = []

        # Basic aggregation for each numeric column
        for col in numeric_cols[:5]:
            examples.append((
                f"What is the average {col}?",
                f'SELECT ROUND(AVG("{col}")::numeric, 2) AS avg_{col} FROM "{table}"',
            ))

        # Categorical + numeric: group by
        for cat in text_cols[:3]:
            for num in numeric_cols[:2]:
                examples.append((
                    f"Average {num} by {cat}?",
                    f'SELECT "{cat}", ROUND(AVG("{num}")::numeric, 2) AS avg_{num} FROM "{table}" GROUP BY "{cat}" ORDER BY avg_{num} DESC',
                ))

        # Timestamp + numeric: trend over time
        for ts in timestamp_cols[:1]:
            for num in numeric_cols[:2]:
                examples.append((
                    f"{num} trend over time?",
                    f"SELECT DATE_TRUNC('day', \"{ts}\") AS day, ROUND(AVG(\"{num}\")::numeric, 2) AS avg_{num} "
                    f'FROM "{table}" GROUP BY 1 ORDER BY 1',
                ))

        # Row count
        examples.append((
            "How many rows are in the dataset?",
            f'SELECT COUNT(*) AS total_rows FROM "{table}"',
        ))

        # Embed and store
        for nl, sql in examples:
            embedding = await embedding_service.generate_embedding(nl)
            ex_record = StructuredQueryExample(
                dataset_id=dataset.id,
                natural_language=nl,
                sql_query=sql,
                is_seed=True,
                embedding=embedding,
            )
            session.add(ex_record)

    async def delete_dataset(self, session: AsyncSession, dataset: StructuredDataset):
        """Drop the data table and delete the dataset record (cascades embeddings/examples/logs)."""
        # Drop table in external Postgres
        try:
            engine = get_structured_engine()
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP TABLE IF EXISTS "{dataset.table_name}" CASCADE'))
        except Exception as e:
            logger.warning(f"Failed to drop external table '{dataset.table_name}': {e}")

        # Delete metadata record (cascade deletes embeddings, examples, logs)
        await session.delete(dataset)

    async def get_preview(self, table_name: str, limit: int = 50) -> dict:
        """Get first N rows from the data table in external Postgres."""
        engine = get_structured_engine()
        async with engine.connect() as conn:
            result = await conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT :lim'), {"lim": limit})
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]

            # Convert non-serializable types and sanitize NaN
            for row in rows:
                for k, v in row.items():
                    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                        row[k] = None
                    elif isinstance(v, datetime):
                        row[k] = v.isoformat()
                    elif v is not None and not isinstance(v, (str, int, float, bool)):
                        row[k] = str(v)

            return {"columns": columns, "rows": rows, "row_count": len(rows)}
