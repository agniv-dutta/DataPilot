"""Sandbox tests: SQL validation, pandas AST validation, and malicious inputs."""

from __future__ import annotations

from datetime import UTC

import pandas as pd
import pytest

from app.core.config import get_settings
from app.core.errors import SandboxError
from app.core.sandbox import run_pandas, run_sql, validate_pandas_code, validate_sql
from app.services.session_store import get_store


@pytest.fixture()
def sql_session():
    store = get_store()
    session = store.create(name="sandbox")
    df = pd.DataFrame(
        {
            "region": ["North", "South", "East", "North"],
            "revenue": [100.0, 250.0, 75.0, 400.0],
            "units": [1, 2, 3, 4],
        }
    )
    session.connection.register("sales", df)
    session.datasets  # noqa: B018 - fixture touch
    return session


# ---------------------------------------------------------------- SQL


def test_sql_result_is_cached_per_session(sql_session) -> None:
    sql = "SELECT region, COUNT(*) AS n FROM sales GROUP BY 1"
    first = run_sql(sql_session, sql)
    first.rows[0][0] = "MUTATED"  # mutate the returned object
    second = run_sql(sql_session, sql)
    # Cached path returns the same object; distinct keys/keywords still compute.
    assert second.rows[0][0] == "MUTATED"
    other = run_sql(sql_session, sql + " ORDER BY 2 DESC")
    assert other.rows[0][0] != "MUTATED"
    assert len(sql_session.query_cache) >= 2


def test_cache_evicts_when_full(sql_session) -> None:
    settings = get_settings()
    original = settings.max_query_cache
    settings.max_query_cache = 2
    try:
        for i in range(5):
            run_sql(sql_session, f"SELECT {i} AS n")
        assert len(sql_session.query_cache) <= 2
    finally:
        settings.max_query_cache = original


def test_valid_select_runs(sql_session) -> None:
    result = run_sql(
        sql_session, "SELECT region, SUM(revenue) AS rev FROM sales GROUP BY 1 ORDER BY rev DESC"
    )
    assert result.columns == ["region", "rev"]
    assert result.rows[0][0] == "North"
    assert result.elapsed_ms >= 0
    assert result.truncated is False


def test_with_cte_allowed(sql_session) -> None:
    result = run_sql(
        sql_session,
        "WITH t AS (SELECT revenue FROM sales) SELECT COUNT(*) AS n FROM t",
    )
    assert result.rows[0][0] == 4


@pytest.mark.parametrize(
    "bad",
    [
        "DROP TABLE sales",
        "DELETE FROM sales",
        "UPDATE sales SET revenue = 0",
        "INSERT INTO sales VALUES (1)",
        "CREATE TABLE evil AS SELECT 1",
        "ATTACH '/etc/passwd'",
        "INSTALL httpfs",
        "LOAD httpfs",
        "COPY sales TO 'out.csv'",
        "PRAGMA database_list",
        "SELECT 1; DROP TABLE sales",
        "SELECT * FROM read_csv('/etc/passwd')",
        "SELECT * FROM read_parquet('/etc/passwd.parquet')",
        "SELECT * FROM 'data.csv'",
        "SELECT * FROM '/etc/passwd.csv'",
        "",
        "   ",
    ],
)
def test_malicious_sql_rejected(bad: str) -> None:
    with pytest.raises(SandboxError):
        validate_sql(bad)


def test_sql_error_message_is_actionable(sql_session) -> None:
    with pytest.raises(SandboxError) as exc:
        run_sql(sql_session, "SELECT * FROM missing_table")
    assert "missing_table" in exc.value.message


def test_sql_row_cap(sql_session) -> None:
    big = pd.DataFrame({"n": range(20_000)})
    sql_session.connection.register("big", big)
    settings = get_settings()
    result = run_sql(sql_session, "SELECT * FROM big")
    assert len(result.rows) == settings.max_result_rows
    assert result.truncated is True


def test_sql_timeout(sql_session) -> None:
    settings = get_settings()
    original = settings.sql_timeout_seconds
    settings.sql_timeout_seconds = 0.5
    try:
        with pytest.raises(SandboxError) as exc:
            run_sql(sql_session, "SELECT COUNT(*) FROM range(100000000000)")
    finally:
        settings.sql_timeout_seconds = original
    assert "timeout" in exc.value.message.lower()


# ---------------------------------------------------------------- Pandas AST


@pytest.mark.parametrize(
    "bad",
    [
        "__import__('os').system('ls')",
        "import os",
        "from os import path",
        "open('/etc/passwd').read()",
        "eval('1+1')",
        "exec('x=1')",
        "getattr(pd, '__class__')",
        "().__class__.__bases__",
        "[].__class__.__mro__",
        "globals()",
        "vars()",
        "pd.read_csv('/etc/passwd')",
        "df.to_csv('/tmp/evil.csv')",
        "subprocess.run(['ls'])",
    ],
)
def test_malicious_pandas_rejected(bad: str) -> None:
    with pytest.raises(SandboxError):
        validate_pandas_code(bad)


def test_syntax_error_reported() -> None:
    with pytest.raises(SandboxError) as exc:
        validate_pandas_code("def broken(:")
    assert "syntax" in exc.value.message.lower()


def test_valid_code_passes_validation() -> None:
    validate_pandas_code("result = df.groupby('region')['revenue'].sum()")


def test_run_pandas_requires_result_variable(sql_session) -> None:
    sql_session.dataframes  # noqa: B018
    # attach a frame named df for the worker
    with pytest.raises(SandboxError) as exc:
        run_pandas(sql_session, "x = 1")
    assert "result" in exc.value.message


def test_run_pandas_executes_in_process(sql_session) -> None:
    df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    sql_session.connection.register("toy", df)
    # simulate registered dataset for dataframes property
    from datetime import datetime

    from app.models.schemas import DatasetInfo, DatasetProfile
    from app.services.session_store import Dataset

    info = DatasetInfo(
        file_id="toy.csv",
        filename="toy.csv",
        table_name="toy",
        size_bytes=10,
        uploaded_at=datetime.now(UTC),
        profile=DatasetProfile(row_count=3, column_count=2, columns=[]),
    )
    sql_session.datasets["toy.csv"] = Dataset(info=info, dataframe=df)

    result = run_pandas(sql_session, "result = toy.assign(c=toy.a * toy.b)")
    assert result.columns == ["a", "b", "c"]
    assert result.rows[0] == [1, 4, 4]


def test_run_pandas_runtime_error_is_sandbox_error(sql_session) -> None:
    with pytest.raises(SandboxError) as exc:
        run_pandas(sql_session, "result = 1 / 0")
    assert "ZeroDivision" in exc.value.message or "division" in exc.value.message


def test_pandas_namespace_is_restricted(sql_session) -> None:
    with pytest.raises(SandboxError) as exc:
        run_pandas(sql_session, "result = open('/etc/passwd').read()")
    assert "not allowed" in exc.value.message
