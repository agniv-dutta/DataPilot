"""Analyst agent: LLM tool-calling loop with grounded, structured answers."""

from __future__ import annotations

import json
import re
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any, Literal, cast

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError, SandboxError
from app.core.llm import LLMResponse, Message, ToolCall, complete
from app.core.logging import get_logger
from app.core.sandbox import ExecutionResult, run_pandas, run_sql
from app.models.schemas import (
    AnomalyReport,
    AnomalyRow,
    ChartSeries,
    ChartSpec,
    DataQualityReport,
    FinalAnswer,
    TableResult,
)
from app.services.quality import build_quality_report
from app.services.session_store import Dataset, Session

logger = get_logger(__name__)

ChartLiteral = Literal["bar", "line", "pie", "scatter", "histogram", "area"]

# ---------------------------------------------------------------- tools

TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_schema",
        "description": (
            "Return the schemas, dtypes, null percentages, and sample rows of all "
            "datasets in this session. Call this first if you do not know the "
            "column names. Dataframes in pandas code are named by table_name."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "run_sql",
        "description": (
            "Run a single read-only DuckDB SQL SELECT query against the registered "
            "session tables (registered as views, e.g. sales_2024). Returns columns, "
            "rows (capped), and a truncated flag. Use this for all numbers you cite."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "A single SELECT statement"}},
            "required": ["query"],
        },
    },
    {
        "name": "run_pandas",
        "description": (
            "Run restricted pandas code. Only `pd`, `np` and the session dataframes "
            "(named by table_name) are available. No imports. You MUST assign the "
            "output to a variable named `result`. Prefer run_sql for simple aggregations."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"code": {"type": "string"}},
            "required": ["code"],
        },
    },
    {
        "name": "create_chart",
        "description": (
            "Create a chart spec the frontend renders. Uses the most recent query "
            "result (or the table named in data_ref) as the data source. "
            "x = column for the x axis/labels, y = numeric column(s)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "pie", "scatter", "histogram", "area"],
                },
                "title": {"type": "string"},
                "x": {"type": "string"},
                "y": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "One or more numeric column names",
                },
                "series": {"type": "string", "description": "Optional legend label"},
                "data_ref": {
                    "type": "string",
                    "description": "'last_result' (default) or a table_name",
                },
            },
            "required": ["chart_type", "title", "x", "y"],
        },
    },
    {
        "name": "detect_anomalies",
        "description": (
            "Detect anomalous rows in a dataset. Returns flagged rows with a "
            "plain-language reason per row, e.g. 'Revenue 4.2σ above mean of 1,240'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset": {"type": "string", "description": "table_name"},
                "columns": {"type": "array", "items": {"type": "string"}},
                "method": {"type": "string", "enum": ["zscore", "iqr", "isolation_forest"]},
            },
            "required": ["dataset", "method"],
        },
    },
    {
        "name": "data_quality_report",
        "description": (
            "Full data-quality report for a dataset: nulls, duplicates, outliers, "
            "constant columns, type mismatches, and an overall score."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"dataset": {"type": "string"}},
            "required": ["dataset"],
        },
    },
]

SYSTEM_PROMPT = """You are a careful data analyst working inside a sandboxed analytics app.

Ground rules (never break these):
1. All numbers you state MUST come from a tool result (run_sql / run_pandas / detect_anomalies). Never invent, estimate, or recall numbers.
2. Start by calling get_schema if you do not know the column names.
3. Prefer run_sql for aggregations; use run_pandas only for logic SQL cannot express.
4. State assumptions explicitly (e.g. "revenue = sum(revenue)").
5. Keep SQL to one SELECT statement. Table names are the `table_name` of each dataset.
6. When a tool returns an error, read it, fix your query/code, and retry (at most twice).
7. If a query returns 'truncated: true', say the result was capped and refine with aggregation or LIMIT.

Final answer format — when you are done, reply with ONLY a JSON object (optionally wrapped in ```json fences) matching:
{
  "answer": "<markdown, concise, with the key numbers bolded>",
  "insights": ["<3-6 bullet insights grounded in the data>"],
  "sql": "<the main SQL you ran, or null>",
  "pandas_code": "<main pandas code, or null>",
  "reasoning": ["<short plain-language steps: how you got this>"],
  "follow_up_suggestions": ["<3 follow-up questions the user might ask>"]
}
Do not put charts/tables/anomalies in the JSON; those are captured from your tool calls automatically.
If you used no tools for a trivial question, still reply with the JSON."""


# ---------------------------------------------------------------- events


@dataclass
class AgentEvent:
    type: str  # status | tool_call | token | chart | table | anomaly | final | error
    data: dict[str, Any] = field(default_factory=dict)

    def to_sse(self) -> str:
        return f"event: {self.type}\ndata: {json.dumps(self.data, default=str)}\n\n"


# ---------------------------------------------------------------- agent


class AnalystAgent:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.settings = get_settings()
        self.last_result: ExecutionResult | None = None
        self.last_sql: str | None = None
        self.last_pandas: str | None = None
        self.tool_log: list[dict[str, Any]] = []
        self._charts: list[ChartSpec] = []
        self._tables: list[TableResult] = []
        self._anomalies: list[AnomalyReport] = []

    # ---- conversation memory -------------------------------------------

    def _messages(self, user_message: str) -> list[Message]:
        messages: list[Message] = []
        for item in self.session.history:
            messages.append(Message(role=item["role"], content=item["content"]))
        messages.append(Message(role="user", content=user_message))
        return self._trim(messages)

    def _trim(self, messages: list[Message]) -> list[Message]:
        """Drop oldest non-system messages when over the token budget."""

        def tokens(msgs: list[Message]) -> int:
            return sum(len(m.content) // 4 + 4 for m in msgs)

        budget = self.settings.memory_token_budget
        while len(messages) > 3 and tokens(messages) > budget:
            removed = messages.pop(0)
            logger.info("memory trimmed", extra={"event": removed.role})
        return messages

    def _remember(self, user_message: str, final: FinalAnswer) -> None:
        self.session.history.append({"role": "user", "content": user_message})
        self.session.history.append({"role": "assistant", "content": final.answer})

    # ---- tool dispatch -------------------------------------------------

    def _tool_get_schema(self) -> dict[str, Any]:
        datasets = []
        for ds in self.session.datasets.values():
            info = ds.info
            datasets.append(
                {
                    "table_name": info.table_name,
                    "filename": info.filename,
                    "rows": info.profile.row_count,
                    "columns": [
                        {
                            "name": c.name,
                            "dtype": c.dtype,
                            "null_pct": c.null_pct,
                            "unique": c.unique_count,
                        }
                        for c in info.profile.columns
                    ],
                    "sample_rows": info.profile.sample_rows[:3],
                }
            )
        return {"datasets": datasets}

    def _tool_run_sql(self, query: str) -> tuple[str, ExecutionResult]:
        started = time.perf_counter()
        result = run_sql(self.session, query)
        self.last_result = result
        self.last_sql = query
        self.last_pandas = None
        self.session.query_history.append(
            {
                "sql": query,
                "rows": len(result.rows),
                "elapsed_ms": result.elapsed_ms,
                "at": time.time(),
            }
        )
        self._log_tool("run_sql", started, len(result.rows))
        payload = result.to_dict()
        payload["note"] = "All numbers you cite must come from these rows."
        return json.dumps(payload, default=str), result

    def _tool_run_pandas(self, code: str) -> tuple[str, ExecutionResult]:
        started = time.perf_counter()
        result = run_pandas(self.session, code)
        self.last_result = result
        self.last_sql = None
        self.last_pandas = code
        self._log_tool("run_pandas", started, len(result.rows))
        return json.dumps(result.to_dict(), default=str), result

    def _resolve_chart_source(self, data_ref: str | None) -> tuple[list[str], list[list[Any]]]:
        if data_ref and data_ref not in ("last_result", "", None):
            dataset = self.session.dataset_by_table(data_ref)
            if dataset is None:
                raise SandboxError(
                    f"data_ref '{data_ref}' is not a known table. Use 'last_result' "
                    "or one of the registered table names."
                )
            df = dataset.dataframe.head(1000)
            return [str(c) for c in df.columns], df.values.tolist()
        if self.last_result is None:
            raise SandboxError(
                "No query result available for charting. Run run_sql first, then "
                "call create_chart with the result columns."
            )
        return self.last_result.columns, self.last_result.rows

    def _tool_create_chart(self, args: dict[str, Any]) -> ChartSpec:
        columns, rows = self._resolve_chart_source(args.get("data_ref"))
        x = args.get("x") or columns[0]
        y_cols = args.get("y") or []
        if isinstance(y_cols, str):
            y_cols = [y_cols]
        if x not in columns:
            raise SandboxError(f"Column '{x}' not found in result. Available: {', '.join(columns)}")
        y_cols = [c for c in y_cols if c in columns] or [c for c in columns if c != x][:1]
        if not y_cols:
            raise SandboxError("No numeric y column provided or found.")

        chart_type = args.get("chart_type", "bar")
        frame = pd.DataFrame(rows, columns=columns)

        if chart_type == "histogram":
            series_name = y_cols[0]
            hist_values = pd.to_numeric(frame[series_name], errors="coerce").dropna()
            if hist_values.empty:
                raise SandboxError(f"Column '{series_name}' has no numeric values.")
            counts, edges = np.histogram(
                hist_values, bins=min(20, max(5, hist_values.nunique() // 2))
            )
            labels = [f"{edges[i]:.4g}–{edges[i + 1]:.4g}" for i in range(len(counts))]
            return ChartSpec(
                chart_type="histogram",
                title=args.get("title", f"Distribution of {series_name}"),
                x="range",
                series=[ChartSeries(name=series_name, data=counts.tolist())],
                x_type="category",
                data=[
                    {"range": lab, series_name: int(c)}
                    for lab, c in zip(labels, counts, strict=False)
                ],
            )

        if chart_type == "pie":
            label_col, value_col = x, y_cols[0]
            pie_labels = [_cell(v) for v in frame[label_col].tolist()]
            pie_values = _numbers(frame[value_col])
            return ChartSpec(
                chart_type="pie",
                title=args.get("title", "Pie chart"),
                x=label_col,
                series=[ChartSeries(name=value_col, data=pie_values)],
                data=[
                    {"name": lab, "value": val}
                    for lab, val in zip(pie_labels, pie_values, strict=False)
                ],
            )

        numeric_cols = {col: _numbers(frame[col]) for col in y_cols}
        series = [
            ChartSeries(
                name=(args.get("series") if len(y_cols) == 1 else None) or col,
                data=numeric_cols[col],
            )
            for col in y_cols
        ]
        x_values = [_cell(v) for v in frame[x].tolist()]
        x_type: Literal["linear", "category", "time"] = (
            "linear" if all(isinstance(v, (int, float)) for v in x_values) else "category"
        )
        data = [{x: _cell(val)} for val in x_values]
        for row_i, row in enumerate(data):
            for col in y_cols:
                row[col] = numeric_cols[col][row_i]
        return ChartSpec(
            chart_type=cast(ChartLiteral, chart_type),
            title=args.get("title", "Chart"),
            x=x,
            series=series,
            x_type=x_type,
            data=data,
        )

    def _tool_detect_anomalies(self, args: dict[str, Any]) -> AnomalyReport:
        dataset = self._dataset(args.get("dataset", ""))
        method = args.get("method", "zscore")
        df = dataset.dataframe
        columns = list(args.get("columns") or [str(c) for c in df.columns])
        columns = [c for c in columns if c in df.columns]
        numeric = [
            c
            for c in columns
            if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])
        ]
        if not numeric:
            raise SandboxError(
                f"No numeric columns to analyze in '{dataset.info.table_name}'. "
                f"Available columns: {', '.join(map(str, df.columns))}"
            )

        flags: dict[int, list[str]] = {}
        if method == "iqr":
            for col in numeric:
                series = df[col].dropna()
                if series.empty:
                    continue
                q1, q3 = series.quantile(0.25), series.quantile(0.75)
                iqr = q3 - q1
                if iqr == 0:
                    continue
                low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                for idx in df.index[(df[col] < low) | (df[col] > high)]:
                    value = df.at[idx, col]
                    side = "above" if value > high else "below"
                    bound = high if value > high else low
                    flags.setdefault(int(cast(int, df.index.get_loc(idx))), []).append(
                        f"{col} {side} the IQR fence ({_fmt(value)} vs {_fmt(bound)})"
                    )
        elif method == "isolation_forest":
            from sklearn.ensemble import IsolationForest

            frame = df[numeric].dropna()
            if len(frame) < 10:
                raise SandboxError("Need at least 10 complete rows for isolation_forest.")
            model = IsolationForest(n_estimators=100, contamination=0.05, random_state=0)
            preds = model.fit_predict(frame)
            scores = model.score_samples(frame)
            for pos, (idx, pred) in enumerate(zip(frame.index, preds, strict=False)):
                if pred == -1:
                    row_idx = int(cast(int, df.index.get_loc(idx)))
                    contribution = np.abs(model.decision_function(frame.iloc[[pos]])[0])
                    top_col = numeric[int(np.argmax(contribution))]
                    flags.setdefault(row_idx, []).append(
                        f"Isolation forest flagged this row as an outlier "
                        f"(score {scores[pos]:.3f}, most unusual column: {top_col})"
                    )
        else:  # zscore
            for col in numeric:
                series = df[col].dropna()
                if len(series) < 3 or series.std(ddof=0) == 0:
                    continue
                mean, std = series.mean(), series.std(ddof=0)
                z = (df[col] - mean) / std
                for idx in df.index[z.abs() > 3]:
                    value = df.at[idx, col]
                    flags.setdefault(int(cast(int, df.index.get_loc(idx))), []).append(
                        f"{col} {z.at[idx]:.1f}σ {('above' if z.at[idx] > 0 else 'below')} "
                        f"mean of {_fmt(mean)}"
                    )

        rows: list[AnomalyRow] = []
        for row_idx in sorted(flags)[:100]:
            values = {str(c): _cell(df.iloc[row_idx][c]) for c in list(df.columns)[:12]}
            rows.append(AnomalyRow(row_index=row_idx, reasons=flags[row_idx], values=values))

        return AnomalyReport(
            dataset=dataset.info.table_name,
            method=method,
            columns=numeric,
            flagged_count=len(flags),
            total_count=len(df),
            rows=rows,
        )

    def _tool_data_quality(self, args: dict[str, Any]) -> DataQualityReport:
        dataset = self._dataset(args.get("dataset", ""))
        return build_quality_report(dataset)

    def _dataset(self, table: str) -> Dataset:
        ds = self.session.dataset_by_table(table) if table else None
        if ds is None:
            names = ", ".join(d.info.table_name for d in self.session.datasets.values())
            raise NotFoundError(
                f"Dataset '{table}' not found. Registered tables: {names or '(none)'}"
            )
        return ds

    def _log_tool(self, tool: str, started: float, rows: int | None = None) -> None:
        entry = {
            "tool": tool,
            "duration_ms": int((time.perf_counter() - started) * 1000),
            "rows": rows,
        }
        self.tool_log.append(entry)
        logger.info(
            "tool call",
            extra={"tool": tool, "duration_ms": entry["duration_ms"], "rows": rows},
        )

    # ---- main loop -----------------------------------------------------

    def run(self, user_message: str) -> Iterator[AgentEvent]:
        """Agent loop: max `agent_max_iterations` tool rounds, then final JSON."""
        messages = self._messages(user_message)
        rounds = 0
        charts: list[ChartSpec] = []
        tables: list[TableResult] = []
        anomalies: list[AnomalyReport] = []
        self._charts, self._tables, self._anomalies = charts, tables, anomalies

        while rounds < self.settings.agent_max_iterations:
            rounds += 1
            yield AgentEvent("status", {"message": "Thinking…"})
            try:
                response: LLMResponse = complete(messages, tools=TOOLS, system=SYSTEM_PROMPT)
            except AppError as exc:
                yield AgentEvent("error", {"message": exc.message, "code": exc.code})
                return
            except Exception as exc:  # noqa: BLE001
                yield AgentEvent("error", {"message": f"LLM error: {exc}", "code": "llm_error"})
                return

            if not response.tool_calls:
                final = self._parse_final(response.text)
                self._remember(user_message, final)
                yield AgentEvent("final", {"final": final.model_dump(), "iterations": rounds})
                return

            messages.append(
                Message(role="assistant", content=response.text, tool_calls=response.tool_calls)
            )
            for call in response.tool_calls:
                yield AgentEvent(
                    "tool_call",
                    {"name": call.name, "args": _safe_args(call), "iteration": rounds},
                )
                content, follow_up = self._dispatch(call, charts, tables, anomalies)
                if follow_up is not None:
                    yield follow_up
                messages.append(
                    Message(
                        role="tool",
                        content=content,
                        tool_call_id=call.id,
                        name=call.name,
                    )
                )

        # Iteration budget exhausted: ask for the final answer without tools.
        messages.append(
            Message(
                role="user",
                content=(
                    "You have used all tool iterations. Reply NOW with the final "
                    "JSON answer based only on the tool results you already have. "
                    "If you have no data, say so honestly."
                ),
            )
        )
        try:
            response = complete(messages, tools=None, system=SYSTEM_PROMPT)
            final = self._parse_final(response.text)
        except Exception as exc:  # noqa: BLE001
            yield AgentEvent(
                "error", {"message": f"Failed to finalize: {exc}", "code": "agent_error"}
            )
            return
        self._remember(user_message, final)
        yield AgentEvent("final", {"final": final.model_dump(), "iterations": rounds})

    def _dispatch(
        self,
        call: ToolCall,
        charts: list[ChartSpec],
        tables: list[TableResult],
        anomalies: list[AnomalyReport],
    ) -> tuple[str, AgentEvent | None]:
        started = time.perf_counter()
        try:
            if call.name == "get_schema":
                payload = self._tool_get_schema()
                self._log_tool("get_schema", started, len(payload["datasets"]))
                return json.dumps(payload, default=str), None

            if call.name == "run_sql":
                query = str(call.input.get("query", ""))
                content, result = self._tool_run_sql(query)
                tables.append(
                    TableResult(
                        title=f"SQL result ({len(result.rows)} rows)",
                        columns=result.columns,
                        rows=result.rows[:50],
                        truncated=result.truncated,
                    )
                )
                return content, AgentEvent(
                    "status",
                    {"message": f"SQL returned {len(result.rows)} rows in {result.elapsed_ms}ms"},
                )

            if call.name == "run_pandas":
                content, result = self._tool_run_pandas(call.input.get("code", ""))
                tables.append(
                    TableResult(
                        title="Pandas result",
                        columns=result.columns,
                        rows=result.rows[:50],
                        truncated=result.truncated,
                    )
                )
                return content, None

            if call.name == "create_chart":
                spec = self._tool_create_chart(call.input)
                charts.append(spec)
                pinned = [c for c in self.session.pinned_charts if c.get("title") != spec.title]
                pinned.append(spec.model_dump())
                self.session.pinned_charts = pinned[-8:]
                self._log_tool("create_chart", started, len(spec.data))
                return json.dumps({"chart": spec.model_dump()}, default=str), AgentEvent(
                    "chart", {"chart": spec.model_dump()}
                )

            if call.name == "detect_anomalies":
                anomaly_report = self._tool_detect_anomalies(call.input)
                anomalies.append(anomaly_report)
                self._log_tool("detect_anomalies", started, anomaly_report.flagged_count)
                return json.dumps(anomaly_report.model_dump(), default=str), AgentEvent(
                    "anomaly", {"anomaly": anomaly_report.model_dump()}
                )

            if call.name == "data_quality_report":
                quality = self._tool_data_quality(call.input)
                self._log_tool("data_quality_report", started, quality.row_count)
                return json.dumps(quality.model_dump(), default=str), None

            return json.dumps(
                {
                    "error": f"Unknown tool '{call.name}'. Available: run_sql, run_pandas, get_schema, create_chart, detect_anomalies, data_quality_report"
                }
            ), None
        except SandboxError as exc:
            # Feed the error back so the model self-corrects.
            self._log_tool(call.name, started, 0)
            logger.info("tool sandbox error", extra={"tool": call.name, "event": exc.message})
            return json.dumps({"error": exc.message, "hint": exc.retry_hint}), AgentEvent(
                "status", {"message": f"{call.name} failed — retrying with a fix"}
            )
        except AppError as exc:
            self._log_tool(call.name, started, 0)
            return json.dumps({"error": exc.message}), AgentEvent(
                "status", {"message": f"{call.name}: {exc.message}"}
            )
        except Exception as exc:  # noqa: BLE001
            self._log_tool(call.name, started, 0)
            return json.dumps({"error": f"{type(exc).__name__}: {exc}"}), AgentEvent(
                "status", {"message": f"{call.name} failed"}
            )

    # ---- final answer parsing ------------------------------------------

    def _parse_final(self, text: str) -> FinalAnswer:
        candidate = text.strip()
        fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", candidate, re.DOTALL)
        if fence:
            candidate = fence.group(1)
        else:
            brace = re.search(r"\{.*\}", candidate, re.DOTALL)
            if brace:
                candidate = brace.group(0)
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                base = self._assembled()
                merged = {**base, **{k: v for k, v in data.items() if v is not None}}
                return FinalAnswer.model_validate(merged)
        except (json.JSONDecodeError, ValueError):
            pass
        base = self._assembled()
        base["answer"] = text or "No answer was produced."
        return FinalAnswer.model_validate(base)

    def _assembled(self) -> dict[str, Any]:
        """Parts captured automatically from tool calls."""
        return {
            "answer": "",
            "insights": [],
            "sql": self.last_sql,
            "pandas_code": self.last_pandas,
            "charts": [c.model_dump() for c in getattr(self, "_charts", [])],
            "tables": [t.model_dump() for t in getattr(self, "_tables", [])],
            "anomalies": [a.model_dump() for a in getattr(self, "_anomalies", [])],
            "reasoning": [],
            "follow_up_suggestions": [],
        }

    def run_final(self, user_message: str) -> tuple[FinalAnswer, list[dict[str, Any]], int]:
        """Non-streaming fallback: collect events into one response."""
        final: FinalAnswer | None = None
        iterations = 0
        for event in self.run(user_message):
            if event.type == "final":
                final = FinalAnswer.model_validate(event.data["final"])
                iterations = event.data.get("iterations", 0)
        if final is None:
            final = FinalAnswer(answer="The agent produced no answer.")
        return final, self.tool_log, iterations


def _safe_args(call: ToolCall) -> dict[str, Any]:
    args = dict(call.input)
    code = args.get("code")
    if isinstance(code, str) and len(code) > 600:
        args["code"] = code[:600] + "…"
    return args


def _cell(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
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
    return str(value)


def _numbers(series: pd.Series) -> list[Any]:
    coerced = pd.to_numeric(series, errors="coerce")
    return [None if pd.isna(v) else float(v) for v in coerced.tolist()]


def _fmt(value: Any) -> str:
    try:
        f = float(value)
        return f"{f:,.2f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return str(value)
