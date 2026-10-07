"""Convert DuckDB SQL to another database's dialect (deterministic, via sqlglot — no LLM involved).

Useful because sources are real databases: SQL that worked in the workbench can be taken back to
PostgreSQL / MySQL / BigQuery / ... as-is.
"""
from __future__ import annotations

import sqlglot

DIALECTS: dict[str, str] = {
    "postgres": "PostgreSQL", "mysql": "MySQL", "sqlite": "SQLite", "bigquery": "BigQuery",
    "snowflake": "Snowflake", "tsql": "SQL Server", "oracle": "Oracle", "clickhouse": "ClickHouse",
    "redshift": "Redshift", "spark": "Spark SQL", "trino": "Trino", "databricks": "Databricks",
}


def convert_sql(sql: str, to: str) -> str:
    if to not in DIALECTS:
        raise ValueError(f"unsupported dialect '{to}'. Choose one of: {', '.join(sorted(DIALECTS))}")
    text = (sql or "").strip().rstrip(";").strip()
    if not text:
        raise ValueError("nothing to convert")
    try:
        out = sqlglot.transpile(text, read="duckdb", write=to, pretty=True)
    except Exception as e:  # sqlglot raises several error types
        raise ValueError(f"could not convert this query: {str(e)[:200]}") from e
    return out[0] + ";"
