"""Safe execution layer for LLM-generated SQL and pandas code.

- SQL: single read-only SELECT/WITH validated with sqlglot, executed on DuckDB
  with a timeout and a row cap.
- Pandas: AST-validated code run in a separate process with a timeout and a
  restricted namespace (no imports, no dunders, no file/network access).
"""

from __future__ import annotations

import ast
import json
import multiprocessing as mp
import queue
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import pandas as pd
import sqlglot
from sqlglot import exp

from app.core.config import get_settings
from app.core.errors import SandboxError
from app.core.logging import get_logger
from app.services.session_store import Session

logger = get_logger(__name__)

# ---------------------------------------------------------------- SQL

_ALLOWED_SQL_ROOTS = {"SELECT", "UNION", "EXCEPT", "INTERSECT"}

_FORBIDDEN_SQL_FUNCTIONS = {
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "parquet_scan",
    "parquet_metadata",
    "sniff_csv",
    "glob",
    "sqlite_scan",
    "postgres_scan",
    "mysql_scan",
    "iceberg_scan",
    "delta_scan",
    "iceberg_snapshots",
    "shrike_scan",
    "read_json",
    "read_json_auto",
    "read_ndjson",
    "read_ndjson_auto",
    "read_text",
    "read_blob",
    "copy",
    "attach",
    "detach",
    "install",
    "load",
    "pragma",
    "set",
    "reset",
    "checkpoint",
    "sequence",
    "sqlite_query",
    "cursor",
    "shell",
    "system",
}

_FORBIDDEN_SQL_NODES = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Drop,
    exp.Create,
    exp.Alter,
    exp.Grant,
    exp.Merge,
    exp.TruncateTable,
    exp.Pragma,
)


def validate_sql(sql: str) -> str:
    """Return normalized SQL or raise SandboxError with a model-readable message."""
    stripped = sql.strip()
    if not stripped:
        raise SandboxError("SQL is empty. Provide a single SELECT statement.")

    try:
        statements = sqlglot.parse(stripped, dialect="duckdb")
    except Exception as exc:  # noqa: BLE001 - sqlglot raises many parse errors
        raise SandboxError(
            f"SQL could not be parsed: {exc}. Fix the syntax and try again."
        ) from exc

    statements = [s for s in statements if s is not None]
    if len(statements) == 0:
        raise SandboxError("SQL is empty. Provide a single SELECT statement.")
    if len(statements) > 1:
        raise SandboxError(
            "Multiple SQL statements are not allowed. Send exactly one SELECT "
            "statement (no semicolon-separated statements)."
        )

    stmt = statements[0]
    assert stmt is not None
    root = stmt.__class__.__name__.upper()
    if root not in _ALLOWED_SQL_ROOTS:
        raise SandboxError(
            f"Only read-only SELECT/WITH queries are allowed; got '{root}'. "
            "DDL/DML (CREATE, DROP, INSERT, UPDATE, DELETE), PRAGMA, INSTALL, "
            "LOAD, COPY and ATTACH are rejected."
        )

    for node in stmt.find_all(*_FORBIDDEN_SQL_NODES):
        raise SandboxError(
            f"Statement type '{node.__class__.__name__}' is not allowed. "
            "Only a single read-only SELECT is permitted."
        )

    for func in stmt.find_all(exp.Anonymous):
        name = (func.this or "").lower() if isinstance(func.this, str) else ""
        if name in _FORBIDDEN_SQL_FUNCTIONS:
            raise SandboxError(
                f"Function '{name}()' is not allowed: queries may only read the "
                "registered session tables, not files or external systems."
            )

    for called in stmt.find_all(exp.Func):
        name = (called.sql_name() or "").lower()
        if name in _FORBIDDEN_SQL_FUNCTIONS:
            raise SandboxError(f"Function '{name}()' is not allowed in queries.")

    for table in stmt.find_all(exp.Table):
        if isinstance(table.this, exp.Literal):
            raise SandboxError(
                "Reading files directly (e.g. SELECT * FROM 'file.csv') is not "
                "allowed. Query the registered session tables instead."
            )
        table_name = table.name.lower()
        if "." in table_name and any(
            table_name.endswith(ext)
            for ext in (".csv", ".parquet", ".json", ".tsv", ".xlsx", ".gz")
        ):
            raise SandboxError(f"File source '{table.name}' is not allowed.")

    if re.search(r"\b(call|loop|macro)\s*\(", stripped, flags=re.IGNORECASE):
        raise SandboxError("DuckDB macros/procedures are not allowed.")

    return stmt.sql(dialect="duckdb", pretty=False)


@dataclass
class ExecutionResult:
    columns: list[str] = field(default_factory=list)
    rows: list[list[Any]] = field(default_factory=list)
    truncated: bool = False
    elapsed_ms: int = 0
    kind: str = "rows"

    def to_dict(self) -> dict[str, Any]:
        return {
            "columns": self.columns,
            "rows": self.rows,
            "truncated": self.truncated,
            "elapsed_ms": self.elapsed_ms,
            "kind": self.kind,
        }


def run_sql(session: Session, sql: str) -> ExecutionResult:
    """Validate and execute SQL on the session's read-only DuckDB connection."""
    normalized = validate_sql(sql)
    settings = get_settings()

    cached = _cache_get(session, normalized)
    if cached is not None:
        logger.info("sql cache hit", extra={"rows": len(cached.rows)})
        return cached

    result = _execute_sql(session, normalized)
    _cache_put(session, normalized, result, settings.max_query_cache)
    return result


def _cache_get(session: Session, key: str) -> ExecutionResult | None:
    with session.lock:
        entry = session.query_cache.get(key)
    return entry if isinstance(entry, ExecutionResult) else None


def _cache_put(session: Session, key: str, result: ExecutionResult, maxsize: int) -> None:
    with session.lock:
        cache = session.query_cache
        cache.pop(key, None)
        cache[key] = result
        while len(cache) > maxsize:
            cache.pop(next(iter(cache)))


def _execute_sql(session: Session, normalized: str) -> ExecutionResult:
    settings = get_settings()
    cap = settings.max_result_rows

    box: dict[str, Any] = {}
    done = threading.Event()

    def _work() -> None:
        try:
            start = time.perf_counter()
            cursor = session.connection.execute(normalized)
            fetched = cursor.fetchmany(cap + 1)
            elapsed = int((time.perf_counter() - start) * 1000)
            truncated = len(fetched) > cap
            rows = fetched[:cap]
            columns = [d[0] for d in (cursor.description or [])]
            box["result"] = ExecutionResult(
                columns=columns,
                rows=[[_json_cell(v) for v in row] for row in rows],
                truncated=truncated,
                elapsed_ms=elapsed,
            )
        except SandboxError as exc:
            box["error"] = exc
        except Exception as exc:  # noqa: BLE001
            box["error"] = SandboxError(
                f"Query failed: {exc}. Check table and column names using "
                "get_schema, then correct the SQL."
            )
        finally:
            done.set()

    worker = threading.Thread(target=_work, daemon=True, name="sql-sandbox")
    worker.start()
    if not done.wait(timeout=settings.sql_timeout_seconds):
        try:
            session.connection.interrupt()
        except Exception:  # noqa: BLE001
            pass
        done.wait(timeout=2.0)
        raise SandboxError(
            f"Query exceeded the {settings.sql_timeout_seconds:.0f}s timeout. "
            "Add a LIMIT, aggregate, or narrow the columns and try again."
        )

    if "error" in box:
        raise box["error"]
    result: ExecutionResult = box["result"]
    logger.info(
        "sql executed",
        extra={"rows": len(result.rows), "duration_ms": result.elapsed_ms},
    )
    return result


def _json_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, (int, float, bool, str)):
        return value
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    return str(value)


# ---------------------------------------------------------------- Pandas

_FORBIDDEN_NAMES = {
    "open",
    "exec",
    "eval",
    "__import__",
    "compile",
    "input",
    "breakpoint",
    "globals",
    "locals",
    "vars",
    "dir",
    "getattr",
    "setattr",
    "delattr",
    "hasattr",
    "type",
    "object",
    "super",
    "memoryview",
    "exit",
    "quit",
    "help",
    "copyright",
    "credits",
    "license",
    "os",
    "sys",
    "subprocess",
    "shutil",
    "socket",
    "requests",
    "urllib",
    "pathlib",
    "importlib",
    "ctypes",
    "multiprocessing",
    "threading",
    "io",
    "pickle",
    "marshal",
    "builtins",
}

_FORBIDDEN_MODULES = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "socket",
    "requests",
    "urllib",
    "pathlib",
    "importlib",
    "ctypes",
    "multiprocessing",
    "threading",
    "io",
    "pickle",
    "marshal",
    "builtins",
    "webbrowser",
    "http",
    "ftplib",
    "smtplib",
    "telnetlib",
    "resource",
    "signal",
    "platform",
    "psutil",
}

# Filesystem access via pandas/Python APIs is blocked at the AST level.
_FORBIDDEN_ATTRS = {
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "read_json",
    "read_jsonlines",
    "read_excel",
    "read_html",
    "read_pickle",
    "read_sql",
    "read_sql_query",
    "read_table",
    "read_fwf",
    "read_orc",
    "read_feather",
    "read_hdf",
    "read_clipboard",
    "to_csv",
    "to_pickle",
    "to_excel",
    "to_parquet",
    "to_hdf",
    "to_stata",
    "to_clipboard",
    "to_sql",
    "to_orc",
    "to_feather",
    "to_json",
}


class _PandasValidator(ast.NodeVisitor):
    """Reject anything that could escape the restricted namespace."""

    def __init__(self) -> None:
        self.errors: list[str] = []

    def _deny(self, msg: str) -> None:
        if msg not in self.errors:
            self.errors.append(msg)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            root = alias.name.split(".")[0]
            self._deny(f"import of '{root}' is not allowed (no imports permitted)")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        root = (node.module or "").split(".")[0]
        self._deny(f"import of '{root}' is not allowed (no imports permitted)")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("_"):
            self._deny(f"access to '{node.attr}' (dunder/private) is not allowed")
        elif node.attr in _FORBIDDEN_ATTRS:
            self._deny(f"access to '{node.attr}' is not allowed (no filesystem reads/writes)")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        name = node.id
        if (
            name in _FORBIDDEN_NAMES
            or name.split(".")[0] in _FORBIDDEN_MODULES
            or name.startswith("__")
        ):
            self._deny(f"'{name}' is not allowed")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Name) and func.id in {"getattr", "setattr", "delattr", "type"}:
            self._deny(f"call to '{func.id}()' is not allowed")
        if isinstance(func, ast.Attribute) and func.attr in {
            "__import__",
            "__class__",
            "__subclasses__",
            "__globals__",
            "__builtins__",
            "__code__",
            "__reduce__",
        }:
            self._deny(f"call to '{func.attr}()' is not allowed")
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        self.generic_visit(node)


def validate_pandas_code(code: str) -> ast.Module:
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise SandboxError(
            f"Python syntax error on line {exc.lineno}: {exc.msg}. Fix it and retry."
        ) from exc
    validator = _PandasValidator()
    validator.visit(tree)
    if validator.errors:
        raise SandboxError("Code rejected: " + "; ".join(validator.errors))
    if len(code) > 20_000:
        raise SandboxError("Code is too long (max 20,000 characters).")
    return tree


def _set_memory_limit(mb: int) -> None:
    try:
        import resource

        resource.setrlimit(  # type: ignore[attr-defined]
            resource.RLIMIT_AS,  # type: ignore[attr-defined]
            (mb * 1024 * 1024, mb * 1024 * 1024),
        )
    except Exception:  # noqa: BLE001 - not available on Windows
        pass


def _serialize_result(value: Any) -> dict[str, Any]:
    if isinstance(value, pd.DataFrame):
        df = value
    elif isinstance(value, pd.Series):
        df = value.to_frame()
    elif isinstance(value, (int, float, bool, str)) or value is None:
        df = pd.DataFrame({"value": [value]})
    elif isinstance(value, dict):
        df = pd.DataFrame([value])
    elif isinstance(value, (list, tuple)):
        df = pd.DataFrame(list(value))
    else:
        df = pd.DataFrame({"value": [str(value)]})

    cap = get_settings().max_result_rows
    truncated = len(df) > cap
    df = df.head(cap)
    df = df.reset_index(drop=True)
    payload = json.loads(df.to_json(orient="split", date_format="iso"))
    return {
        "columns": [str(c) for c in payload["columns"]],
        "rows": payload["data"],
        "truncated": truncated,
        "kind": "rows",
    }


def _pandas_worker(
    code: str,
    dataframes: dict[str, pd.DataFrame],
    conn: Any,
    memory_mb: int,
) -> None:
    try:
        _set_memory_limit(memory_mb)
        namespace: dict[str, Any] = {"pd": pd}
        try:
            import numpy as np

            namespace["np"] = np
        except ImportError:
            pass
        namespace.update(dataframes)
        exec(compile(code, "<llm>", "exec"), namespace)  # noqa: S102 - AST-validated
        if "result" not in namespace:
            conn.send(
                {
                    "error": "Your code must assign the final output to a variable "
                    "named `result` (e.g. `result = df.groupby('a').sum()`)."
                }
            )
            return
        conn.send({"result": _serialize_result(namespace["result"])})
    except Exception as exc:  # noqa: BLE001
        conn.send({"error": f"{type(exc).__name__}: {exc}"})
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def run_pandas(session: Session, code: str) -> ExecutionResult:
    """AST-validate then execute code in a separate process."""
    validate_pandas_code(code)
    settings = get_settings()

    # Never ship huge frames to the child; cap what the code can see.
    dataframes = {
        name: df.head(settings.max_rows_profiled).copy() for name, df in session.dataframes.items()
    }

    ctx = mp.get_context("spawn")
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    proc = ctx.Process(
        target=_pandas_worker,
        args=(code, dataframes, child_conn, 512),
        daemon=True,
    )
    start = time.perf_counter()
    proc.start()
    child_conn.close()

    payload: dict[str, Any] | None = None
    try:
        if parent_conn.poll(settings.pandas_timeout_seconds):
            payload = parent_conn.recv()
    except (EOFError, OSError):
        payload = None
    finally:
        if proc.is_alive():
            proc.terminate()
            proc.join(timeout=2.0)
        else:
            proc.join(timeout=1.0)
        parent_conn.close()

    elapsed = int((time.perf_counter() - start) * 1000)

    if payload is None:
        raise SandboxError(
            f"Code exceeded the {settings.pandas_timeout_seconds:.0f}s timeout or "
            "crashed the process. Simplify the computation, add a LIMIT on rows, "
            "and retry."
        )
    if "error" in payload:
        raise SandboxError(f"Execution failed: {payload['error']}. Fix the code and retry.")

    result = ExecutionResult(**payload["result"], elapsed_ms=elapsed)
    logger.info(
        "pandas executed",
        extra={"rows": len(result.rows), "duration_ms": elapsed},
    )
    return result


def drain_queue(q: queue.Queue[Any]) -> None:  # pragma: no cover - helper
    while not q.empty():
        try:
            q.get_nowait()
        except queue.Empty:
            break
