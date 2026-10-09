"""Pydantic v2 models for every request and response."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- datasets


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    null_pct: float = Field(description="Percentage of nulls, 0-100")
    unique_count: int
    min: Any | None = None
    max: Any | None = None
    mean: float | None = None
    top_values: list[dict[str, Any]] = Field(default_factory=list)


class DatasetProfile(BaseModel):
    row_count: int
    column_count: int
    columns: list[ColumnProfile]
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)
    quality_score: float = Field(default=100.0, ge=0, le=100)
    quality_issues: list[str] = Field(default_factory=list)


class DatasetInfo(BaseModel):
    file_id: str
    filename: str
    table_name: str
    size_bytes: int
    uploaded_at: datetime
    profile: DatasetProfile


class SessionCreate(BaseModel):
    name: str | None = None


class SessionOut(BaseModel):
    session_id: str
    created_at: datetime
    name: str | None = None


class FileListResponse(BaseModel):
    session_id: str
    datasets: list[DatasetInfo]


# ---------------------------------------------------------------- charts


ChartType = Literal["bar", "line", "pie", "scatter", "histogram", "area"]


class ChartSeries(BaseModel):
    name: str
    data: list[Any]


class ChartSpec(BaseModel):
    """Spec the frontend renders with Recharts. Not an image."""

    chart_type: ChartType
    title: str
    x: str
    series: list[ChartSeries]
    x_type: Literal["linear", "category", "time"] = "category"
    y_label: str | None = None
    data: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Row-oriented data backing the chart (for tooltips/tables)",
    )


# ---------------------------------------------------------------- chat / agent


class AnomalyRow(BaseModel):
    row_index: int
    reasons: list[str]
    values: dict[str, Any]


class AnomalyReport(BaseModel):
    dataset: str
    method: str
    columns: list[str]
    flagged_count: int
    total_count: int
    rows: list[AnomalyRow]


class DataQualityReport(BaseModel):
    dataset: str
    row_count: int
    column_count: int
    duplicate_rows: int
    nulls: dict[str, float]
    constant_columns: list[str]
    outliers: dict[str, int]
    type_mismatches: list[str]
    score: float


class TableResult(BaseModel):
    title: str
    columns: list[str]
    rows: list[list[Any]]
    truncated: bool = False


class FinalAnswer(BaseModel):
    answer: str = Field(description="Markdown answer")
    insights: list[str] = Field(default_factory=list)
    sql: str | None = None
    pandas_code: str | None = None
    charts: list[ChartSpec] = Field(default_factory=list)
    tables: list[TableResult] = Field(default_factory=list)
    anomalies: list[AnomalyReport] = Field(default_factory=list)
    reasoning: list[str] = Field(default_factory=list)
    follow_up_suggestions: list[str] = Field(default_factory=list)


class ChatRole(str, Enum):
    user = "user"
    assistant = "assistant"
    tool = "tool"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    session_id: str
    final: FinalAnswer
    iterations: int
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------- ops


class HealthResponse(BaseModel):
    status: str
    version: str
    llm_provider: str
    llm_configured: bool


# ---------------------------------------------------------------- inspector


class QueryHistoryEntry(BaseModel):
    sql: str
    rows: int
    elapsed_ms: int
    at: float


class InspectorSnapshot(BaseModel):
    session_id: str
    quality: list[DataQualityReport]
    query_history: list[QueryHistoryEntry]
    pinned_charts: list[ChartSpec]
