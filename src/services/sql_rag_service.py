"""Schema-aware SQL RAG service with self-correction loop.

Pipeline:
1. Build context: schema metadata + glossary terms + few-shot examples (via pgvector)
2. Generate SQL via Qwen3:14b (or any configured LLM)
3. Validate: keyword blacklist + EXPLAIN syntax check
4. On failure: feed error back to LLM for self-correction (up to 3 retries)
5. Execute against external Postgres
6. Narrate results in plain English
"""

import json
import math
import re
import time
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

import sqlparse
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.structured_data_db import get_structured_engine
from src.models.structured_dataset import (
    StructuredDataset,
    StructuredSchemaEmbedding,
    StructuredQueryExample,
    StructuredQueryLog,
    SchemaMetadata,
    BusinessGlossary,
)
from src.services.embedding_service import get_embedding_service
from src.services.agentic_rag.llm_adapter import get_agentic_rag_llm_service

logger = logging.getLogger(__name__)

# ─── Safety ──────────────────────────────────────────────────────────────────

BLOCKED_KEYWORDS = [
    "DROP", "DELETE", "UPDATE", "INSERT",
    "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE",
    "COPY", "EXECUTE",
]

# ─── Prompt Templates ────────────────────────────────────────────────────────
# System prompt is kept short and schema-focused so small local models (Qwen3:14b)
# don't lose context.  The user message contains ONLY the question.

SQL_SYSTEM_PROMPT = """You are a PostgreSQL expert. You write SELECT queries.
RULES:
- Use ONLY the exact table and column names below. NEVER invent names.
- Always double-quote identifiers: "table_name"."column_name"
- For rounding use: ROUND(value::numeric, 2)
- For non-GROUP-BY queries add LIMIT 100. For GROUP BY queries do NOT add LIMIT.
- Only filter by date when the user explicitly asks for a time period.
- No DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE

{schema_context}
{examples_context}
{glossary_context}

Return ONLY the SQL. No explanation, no markdown, no backticks."""

SQL_USER_PROMPT = """{question}"""

SELF_CORRECTION_SYSTEM = """You are a PostgreSQL expert. Fix the failed SQL below.
Use ONLY the exact table and column names listed here — do NOT invent names.

{schema_context}

Return ONLY the corrected SQL. No explanation."""

SELF_CORRECTION_USER = """Failed SQL:
{failed_sql}

Error:
{error}

Original question: {question}"""

NARRATION_PROMPT = """A user asked: "{question}"

This SQL query was executed:
{sql}

Query results ({row_count} rows total, {col_count} columns: {col_names}):
{header}
{divider}
{rows_text}{suffix}

Respond with ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{{
  "interpretation": "<markdown string>",
  "suggested_chart": "<chart_type>"
}}

For "interpretation", write a rich markdown analysis:
- Start with a **bold lead sentence** that directly answers the question
- Add a "### Key Findings" section with bullet points using specific numbers from the results
- If the data warrants it, add a "### Notable Patterns" section for outliers, trends, or comparisons
- Use actual values and names from the results — be specific
- Do NOT explain the SQL or methodology

For "suggested_chart", pick the single best visualization from: bar, horizontal_bar, line, area, pie, scatter, grouped_bar, stat, none
- Use "horizontal_bar" for 1 categorical + 1 numeric column
- Use "grouped_bar" for 1 categorical + 2+ numeric columns
- Use "line" for time-series data (timestamp/date + numeric)
- Use "pie" for categorical + 1 numeric with ≤8 rows (proportions/percentages)
- Use "scatter" for 2 numeric columns without categorical
- Use "stat" for a single-row aggregate (one big number)
- Use "none" if the data doesn't suit any chart"""


class SQLRAGService:
    """Service for schema-aware text-to-SQL generation, validation, and execution."""

    # ─── Context Building ─────────────────────────────────────────────────

    async def _build_schema_context(
        self, session: AsyncSession, dataset: StructuredDataset
    ) -> str:
        """Build a compact schema context optimised for small local LLMs.

        Format (keeps total schema under ~1500 chars for 45-col tables):
            TABLE: "table_name" (25000 rows)
            COLUMNS:
            "col1" TEXT, "col2" DOUBLE PRECISION, ...
        """
        # Try SchemaMetadata first (has human-editable descriptions)
        result = await session.execute(
            select(SchemaMetadata)
            .where(SchemaMetadata.dataset_id == dataset.id)
            .order_by(SchemaMetadata.column_name.nulls_first())
        )
        rows = result.scalars().all()

        if rows:
            table_name = None
            table_desc = ""
            columns = []
            for m in rows:
                if m.column_name is None:
                    table_name = m.table_name
                    table_desc = m.description or ""
                else:
                    if not table_name:
                        table_name = m.table_name
                    columns.append(f'"{m.column_name}" {m.data_type or "TEXT"}')

            table_name = table_name or dataset.table_name
            row_count = dataset.row_count or "?"
            header = f'TABLE: "{table_name}" ({row_count} rows)'
            if table_desc:
                header += f"\n{table_desc}"
            col_list = ", ".join(columns)

            parts = [header, f"COLUMNS:\n{col_list}"]

            # Add date range so LLM knows the data period
            date_range = await self._get_date_range(dataset)
            if date_range:
                parts.append(f"DATE RANGE: {date_range}")

            return "\n".join(parts)

        # Fallback: build from schema_info JSON on the dataset record
        return self._build_schema_context_from_schema_info(dataset)

    async def _get_date_range(self, dataset: StructuredDataset) -> str:
        """Query actual min/max dates from timestamp columns in the data."""
        schema_info = dataset.schema_info or {}
        ts_cols = [
            col for col, info in schema_info.get("columns", {}).items()
            if info.get("type") == "TIMESTAMP"
        ]
        if not ts_cols:
            return ""
        try:
            engine = get_structured_engine()
            col = ts_cols[0]  # Use the first timestamp column
            async with engine.connect() as conn:
                result = await conn.execute(
                    text(f'SELECT MIN("{col}"), MAX("{col}") FROM "{dataset.table_name}"')
                )
                row = result.fetchone()
                if row and row[0] and row[1]:
                    return f"Column \"{col}\" spans from {row[0]} to {row[1]}"
        except Exception:
            pass
        return ""

    @staticmethod
    def _build_schema_context_from_schema_info(dataset: StructuredDataset) -> str:
        """Fallback: build compact schema from the schema_info JSON on the dataset."""
        schema_info = dataset.schema_info or {}
        cols_info = schema_info.get("columns", {})
        if not cols_info:
            return f'TABLE: "{dataset.table_name}"\n(No column metadata available)'

        columns = []
        for col_name, info in cols_info.items():
            col_type = info.get("type", "TEXT")
            columns.append(f'"{col_name}" {col_type}')

        row_count = dataset.row_count or "?"
        col_list = ", ".join(columns)
        return f'TABLE: "{dataset.table_name}" ({row_count} rows)\nCOLUMNS:\n{col_list}'

    async def _get_glossary_context(
        self, session: AsyncSession, dataset: StructuredDataset, question: str
    ) -> str:
        """Find business glossary terms that appear in the user question."""
        result = await session.execute(
            select(BusinessGlossary).where(BusinessGlossary.dataset_id == dataset.id)
        )
        terms = result.scalars().all()
        if not terms:
            return ""

        q_lower = question.lower()
        matched = []
        for t in terms:
            # Check if the term itself appears
            if t.term.lower() in q_lower:
                matched.append((t.term, t.sql_expression))
                continue
            # Check synonyms
            if t.synonyms:
                for syn in t.synonyms.split(","):
                    if syn.strip().lower() in q_lower:
                        matched.append((t.term, t.sql_expression))
                        break

        if not matched:
            return ""

        lines = ["BUSINESS TERM DEFINITIONS (use these exact SQL expressions):"]
        for term, expr in matched:
            lines.append(f'  - "{term}" translates to: {expr}')
        return "\n".join(lines)

    async def _get_similar_examples(
        self, session: AsyncSession, dataset: StructuredDataset, question: str, k: int = 3
    ) -> str:
        """Retrieve the k most similar NL→SQL examples via pgvector."""
        embedding_service = get_embedding_service()
        emb = await embedding_service.generate_embedding(question, is_query=True)
        embedding_str = "[" + ",".join(str(x) for x in emb) + "]"

        result = await session.execute(
            text("""
                SELECT natural_language, sql_query
                FROM structured_query_examples
                WHERE dataset_id = :did
                ORDER BY embedding <=> CAST(:emb AS vector)
                LIMIT :k
            """),
            {"emb": embedding_str, "did": dataset.id, "k": k},
        )
        rows = result.fetchall()
        if not rows:
            return ""

        lines = ["SIMILAR EXAMPLE QUERIES (use these as patterns):"]
        for q, sql in rows:
            lines.append(f"Q: {q}\nSQL: {sql}\n")
        return "\n".join(lines)

    # ─── SQL Extraction & Safety ──────────────────────────────────────────

    @staticmethod
    def _extract_sql(raw: str) -> str:
        """Strip markdown fences, prefixes, and extract the first SELECT statement."""
        raw = raw.strip()
        # Remove markdown code fences
        if "```" in raw:
            parts = raw.split("```")
            if len(parts) >= 3:
                raw = parts[1]
                if raw.lower().startswith("sql"):
                    raw = raw[3:]
            raw = raw.strip()

        # Remove leading "SQL:" prefix the model sometimes echoes
        if raw.upper().startswith("SQL:"):
            raw = raw[4:].strip()

        # Remove any leading explanation lines before the SELECT
        lines = raw.split("\n")
        sql_lines = []
        found_select = False
        for line in lines:
            stripped = line.strip()
            if stripped.upper().startswith("SELECT"):
                found_select = True
            if found_select:
                sql_lines.append(line)
        if sql_lines:
            raw = "\n".join(sql_lines)

        # Take the first SELECT statement
        parsed = sqlparse.parse(raw)
        for stmt in parsed:
            s = str(stmt).strip()
            if s.upper().startswith("SELECT"):
                return s.rstrip(";")

        return raw.rstrip(";")

    @staticmethod
    def _is_safe(sql: str) -> tuple[bool, Optional[str]]:
        """Check SQL against keyword blacklist."""
        sql_upper = sql.upper()
        for kw in BLOCKED_KEYWORDS:
            if re.search(rf"\b{kw}\b", sql_upper):
                return False, f"Blocked keyword: {kw}"
        return True, None

    def validate_sql(self, sql: str, allowed_table: str) -> dict:
        """Full validation: emptiness, SELECT-only, blacklist, no multi-statement."""
        if not sql:
            return {"valid": False, "error": "Empty SQL"}

        if not sql.upper().strip().startswith("SELECT"):
            return {"valid": False, "error": "Only SELECT queries are allowed"}

        if ";" in sql:
            return {"valid": False, "error": "Multi-statement queries are not allowed"}

        safe, reason = self._is_safe(sql)
        if not safe:
            return {"valid": False, "error": reason}

        parsed = sqlparse.parse(sql)
        if not parsed:
            return {"valid": False, "error": "Could not parse SQL"}

        return {"valid": True, "error": None}

    async def _explain_check(self, sql: str) -> tuple[bool, Optional[str]]:
        """Validate SQL syntax by running EXPLAIN against the external Postgres.

        This catches column name typos, bad casts, and syntax errors before
        actual execution — with zero side effects.
        """
        engine = get_structured_engine()
        try:
            async with engine.connect() as conn:
                await conn.execute(text(f"EXPLAIN {sql}"))
                return True, None
        except Exception as e:
            return False, str(e)

    # ─── Generation with Self-Correction Loop ─────────────────────────────

    async def generate_sql(
        self,
        session: AsyncSession,
        dataset: StructuredDataset,
        question: str,
        provider: Optional[str] = None,
        max_retries: int = 3,
    ) -> dict:
        """Generate SQL from a natural language question with self-correction.

        Pipeline:
        1. Build rich context (schema + glossary + examples)
        2. Generate SQL via LLM
        3. Safety check + EXPLAIN validation
        4. On failure: feed error back for self-correction (up to max_retries)

        Returns:
            dict with keys: sql, valid, error, provider, model, attempts
        """
        llm_service = get_agentic_rag_llm_service()
        if not llm_service:
            raise RuntimeError("No LLM service available. Configure at least one LLM provider.")

        # 1. Build compact context
        schema_context = await self._build_schema_context(session, dataset)
        glossary_context = await self._get_glossary_context(session, dataset, question)
        try:
            examples_context = await self._get_similar_examples(session, dataset, question, k=3)
        except Exception as e:
            logger.warning(f"Failed to retrieve similar examples (continuing without): {e}")
            examples_context = ""

        # 2. Build system prompt (schema + rules) and user prompt (question only)
        system_prompt = SQL_SYSTEM_PROMPT.format(
            schema_context=schema_context,
            examples_context=examples_context,
            glossary_context=glossary_context,
        )
        user_prompt = SQL_USER_PROMPT.format(question=question)

        logger.info(
            f"SQL generation for dataset {dataset.id}: "
            f"system={len(system_prompt)} chars, user={len(user_prompt)} chars\n"
            f"Schema context:\n{schema_context}"
        )

        adapter = llm_service.get_adapter(provider)
        last_error = None
        sql = ""
        model_name = ""

        for attempt in range(max_retries):
            # Generate SQL — schema in system prompt, question in user prompt
            response = await adapter.generate_with_usage(
                prompt=user_prompt,
                system_prompt=system_prompt,
                max_tokens=512,
                temperature=0.0,
            )
            llm_service.total_input_tokens += response.input_tokens
            llm_service.total_output_tokens += response.output_tokens
            llm_service.call_count += 1
            model_name = response.model

            logger.info(f"LLM raw response (attempt {attempt + 1}): {response.content[:300]}")

            sql = self._extract_sql(response.content)

            # Safety check
            safe, reason = self._is_safe(sql)
            if not safe:
                return {
                    "sql": sql,
                    "valid": False,
                    "error": reason,
                    "provider": provider or llm_service.default_provider,
                    "model": model_name,
                    "attempts": attempt + 1,
                }

            # EXPLAIN check — validates syntax against real Postgres
            explain_ok, explain_err = await self._explain_check(sql)
            if explain_ok:
                return {
                    "sql": sql,
                    "valid": True,
                    "error": None,
                    "provider": provider or llm_service.default_provider,
                    "model": model_name,
                    "attempts": attempt + 1,
                }

            # Self-correction: feed the error + schema back to the LLM
            last_error = explain_err
            logger.info(
                f"SQL generation attempt {attempt + 1} failed for dataset {dataset.id}: {explain_err}"
            )
            system_prompt = SELF_CORRECTION_SYSTEM.format(schema_context=schema_context)
            user_prompt = SELF_CORRECTION_USER.format(
                failed_sql=sql,
                error=last_error,
                question=question,
            )

        # All retries exhausted
        return {
            "sql": sql,
            "valid": False,
            "error": f"Failed after {max_retries} attempts. Last error: {last_error}",
            "provider": provider or llm_service.default_provider,
            "model": model_name,
            "attempts": max_retries,
        }

    # ─── Execution ────────────────────────────────────────────────────────

    async def execute_query(
        self,
        sql: str,
        max_rows: int = 500,
        timeout_seconds: int = 30,
    ) -> dict:
        """Execute a validated SELECT query against the external Postgres.

        Returns:
            dict with keys: columns, rows, row_count, execution_time_ms, truncated
        """
        engine = get_structured_engine()

        # Append LIMIT if not present
        if "LIMIT" not in sql.upper():
            sql = f"{sql} LIMIT {max_rows}"

        start = time.monotonic()

        async with engine.connect() as conn:
            await conn.execute(text("SET TRANSACTION READ ONLY"))
            await conn.execute(text(f"SET statement_timeout = '{timeout_seconds}s'"))

            result = await conn.execute(text(sql))
            columns = list(result.keys())
            raw_rows = result.fetchall()

            execution_time_ms = int((time.monotonic() - start) * 1000)

            rows = []
            for row in raw_rows:
                d = {}
                for i, col in enumerate(columns):
                    v = row[i]
                    if isinstance(v, datetime):
                        d[col] = v.isoformat()
                    elif isinstance(v, (float, Decimal)):
                        v_float = float(v)
                        d[col] = None if (math.isnan(v_float) or math.isinf(v_float)) else round(v_float, 4)
                    elif v is not None and not isinstance(v, (str, int, bool)):
                        d[col] = str(v)
                    else:
                        d[col] = v
                rows.append(d)

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "execution_time_ms": execution_time_ms,
                "truncated": len(rows) >= max_rows,
            }

    # ─── Result Narration ─────────────────────────────────────────────────

    async def interpret_results(
        self,
        question: str,
        sql: str,
        results: dict,
        provider: Optional[str] = None,
    ) -> dict:
        """Send results back to the LLM for rich markdown summary + chart suggestion.

        Returns:
            dict with keys: interpretation (markdown str), suggested_chart (str)
        """
        llm_service = get_agentic_rag_llm_service()
        if not llm_service:
            return {
                "interpretation": "LLM service not available for result interpretation.",
                "suggested_chart": "none",
            }

        columns = results.get("columns", [])
        all_rows = results.get("rows", [])
        preview = all_rows[:15]
        total = len(all_rows)

        header = "  |  ".join(columns)
        divider = "-" * len(header)
        rows_text = "\n".join(
            "  |  ".join(str(row.get(c, "")) for c in columns)
            for row in preview
        )
        suffix = f"\n... and {total - 15} more rows" if total > 15 else ""

        prompt = NARRATION_PROMPT.format(
            question=question,
            sql=sql,
            row_count=total,
            col_count=len(columns),
            col_names=", ".join(columns),
            header=header,
            divider=divider,
            rows_text=rows_text or "(No rows returned)",
            suffix=suffix,
        )

        raw = await llm_service.generate(
            prompt=prompt,
            json_output=True,
            max_tokens=768,
            temperature=0.3,
            provider=provider,
        )

        # Parse JSON response, with fallback
        try:
            parsed = json.loads(raw)
            return {
                "interpretation": parsed.get("interpretation", raw),
                "suggested_chart": parsed.get("suggested_chart", "none"),
            }
        except (json.JSONDecodeError, TypeError):
            logger.warning(f"Failed to parse narration JSON, using raw text. Raw: {raw[:200]}")
            return {
                "interpretation": raw,
                "suggested_chart": "none",
            }

    # ─── Query Logging & Feedback ─────────────────────────────────────────

    async def log_query(
        self,
        session: AsyncSession,
        dataset_id: int,
        natural_language: str,
        generated_sql: str,
        was_executed: bool = False,
        execution_time_ms: Optional[int] = None,
        row_count: Optional[int] = None,
        error_message: Optional[str] = None,
        llm_provider: Optional[str] = None,
        llm_model: Optional[str] = None,
    ) -> StructuredQueryLog:
        """Log a query for history and analytics."""
        log = StructuredQueryLog(
            dataset_id=dataset_id,
            natural_language=natural_language,
            generated_sql=generated_sql,
            was_executed=was_executed,
            execution_time_ms=execution_time_ms,
            row_count=row_count,
            error_message=error_message,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
        session.add(log)
        return log

    async def submit_feedback(
        self,
        session: AsyncSession,
        query_log_id: int,
        feedback: str,
    ):
        """Submit feedback on a query. If positive, promote to a query example for future RAG."""
        result = await session.execute(
            select(StructuredQueryLog).where(StructuredQueryLog.id == query_log_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            return

        log.feedback = feedback

        if feedback == "good" and log.was_executed and not log.error_message:
            embedding_service = get_embedding_service()
            embedding = await embedding_service.generate_embedding(log.natural_language)
            example = StructuredQueryExample(
                dataset_id=log.dataset_id,
                natural_language=log.natural_language,
                sql_query=log.generated_sql,
                is_seed=False,
                embedding=embedding,
            )
            session.add(example)
