"""P0-1: tool results must be bounded before they reach the LLM request.

Groq's free tier rejects any single request over 8,000 tokens with HTTP 413
(`rate_limit_exceeded/tokens`). Unbounded tool payloads therefore kill the agent
loop. These tests pin the three bounding layers: per-tool row cap, per-message
character cap, and the whole-request budget applied inside the agent loop.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pandas as pd
import pytest

from app.core.config import get_settings
from app.core.llm import LLMProvider, LLMResponse, Message, ToolCall, set_provider
from app.models.schemas import DatasetInfo, DatasetProfile
from app.services.agent import TOOL_RESULT_DROPPED, AnalystAgent
from app.services.session_store import Dataset, get_store


class RecordingProvider(LLMProvider):
    """Scripted provider that keeps the full message list of every request."""

    name = "recording"

    def __init__(self, responses: list[LLMResponse]) -> None:
        self.responses = list(responses)
        self.requests: list[list[dict]] = []

    @property
    def model(self) -> str:
        return "recording"

    def is_configured(self) -> bool:
        return True

    def chat(
        self,
        messages: list[Message],
        tools: list[dict] | None = None,
        system: str | None = None,
    ) -> LLMResponse:
        self.requests.append([m.to_dict() for m in messages])
        return self.responses.pop(0) if self.responses else LLMResponse(text="{}")


@pytest.fixture()
def recording() -> RecordingProvider:
    provider = RecordingProvider([])
    set_provider(provider)
    yield provider
    set_provider(None)


def _final() -> LLMResponse:
    return LLMResponse(text=json.dumps({"answer": "done", "insights": [], "reasoning": []}))


def _tool_call(name: str, args: dict) -> LLMResponse:
    return LLMResponse(stop_reason="tool_use", tool_calls=[ToolCall(id="t1", name=name, input=args)])


def _session_with_wide_table(rows: int = 5_000) -> object:
    session = get_store().create(name="budget")
    frame = pd.DataFrame(
        {
            "region": [f"region_{i % 8}" for i in range(rows)],
            "product": [f"product_{i % 25}" for i in range(rows)],
            # A wide text column so a 50-row slice still exceeds the per-message cap.
            "notes": ["n" * 220 for i in range(rows)],
            "revenue": [float(i) for i in range(rows)],
            "cost": [float(i) * 0.6 for i in range(rows)],
        }
    )
    session.connection.register("wide", frame)
    return session


def _session_with_many_anomalies(flagged: int = 60) -> object:
    session = get_store().create(name="anomalies")
    base = [100.0 + (i % 5) for i in range(300)]
    for i in range(0, flagged * 5, 5):
        base[i] = 5_000.0
    frame = pd.DataFrame({"region": [f"r{i % 4}" for i in range(len(base))], "revenue": base})
    info = DatasetInfo(
        file_id="s.csv",
        filename="s.csv",
        table_name="wide",
        size_bytes=10,
        uploaded_at=datetime.now(UTC),
        profile=DatasetProfile(row_count=len(frame), column_count=2, columns=[]),
    )
    session.datasets["s.csv"] = Dataset(info=info, dataframe=frame)
    session.connection.register("wide", frame)
    return session


def _tool_messages(request: list[dict]) -> list[dict]:
    return [m for m in request if m.get("role") == "tool"]


def _request_tokens(request: list[dict]) -> int:
    """Mirror the agent's estimator: JSON tool traffic is ~3 chars/token."""
    return sum(len(m.get("content") or "") // 3 + 4 for m in request)


def test_settings_expose_the_budget_knobs() -> None:
    settings = get_settings()
    assert settings.tool_result_budget_chars > 0
    assert settings.llm_result_rows > 0


def test_run_sql_result_is_bounded_before_it_reaches_the_llm(recording: RecordingProvider) -> None:
    settings = get_settings()
    recording.responses = [
        _tool_call("run_sql", {"query": "SELECT * FROM wide"}),
        _final(),
    ]
    session = _session_with_wide_table()
    agent = AnalystAgent(session)
    list(agent.run("show me everything"))

    assert len(recording.requests) == 2
    second = recording.requests[1]
    tool_msgs = _tool_messages(second)
    assert tool_msgs, "expected the tool result to be sent back to the model"
    content = tool_msgs[0].get("content") or ""
    assert len(content) <= settings.tool_result_budget_chars, (
        f"tool message is {len(content)} chars; cap is {settings.tool_result_budget_chars}"
    )
    assert _request_tokens(second) <= settings.memory_token_budget


def test_detect_anomalies_payload_is_clipped_but_ui_keeps_the_full_report(
    recording: RecordingProvider, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    # Keep the row cap under the char cap so this test isolates the row cap.
    monkeypatch.setattr(settings, "llm_result_rows", 10)
    flagged = 60
    recording.responses = [
        _tool_call("detect_anomalies", {"dataset": "wide", "method": "iqr"}),
        _final(),
    ]
    session = _session_with_many_anomalies(flagged)
    agent = AnalystAgent(session)
    events = list(agent.run("any outliers?"))

    anomaly_events = [e for e in events if e.type == "anomaly"]
    assert anomaly_events, "the UI must still receive the anomaly report"
    ui_report = anomaly_events[0].data["anomaly"]
    assert ui_report["flagged_count"] == flagged
    assert len(ui_report["rows"]) == flagged, "UI-facing report must not be clipped"

    tool_content = _tool_messages(recording.requests[1])[0].get("content") or ""
    assert len(tool_content) <= settings.tool_result_budget_chars
    payload = json.loads(tool_content)
    assert payload["flagged_count"] == flagged, "the true total must still be reported"
    assert len(payload["rows"]) == settings.llm_result_rows
    assert payload["truncated_for_context"] is True


def test_older_tool_results_shrink_while_the_newest_is_kept(
    recording: RecordingProvider,
) -> None:
    settings = get_settings()
    rounds = 4
    recording.responses = [
        *[_tool_call("run_sql", {"query": "SELECT * FROM wide"}) for _ in range(rounds)],
        _final(),
    ]
    session = _session_with_wide_table()
    agent = AnalystAgent(session)
    list(agent.run("wide dump"))

    assert len(recording.requests) == rounds + 1
    for request in recording.requests[1:]:
        ids = {
            tc["id"]
            for m in request
            if m.get("role") == "assistant"
            for tc in (m.get("tool_calls") or [])
        }
        tool_ids = {m.get("tool_call_id") for m in request if m.get("role") == "tool"}
        assert ids == tool_ids, "assistant tool_calls and tool results must stay paired"
        assert _request_tokens(request) <= settings.memory_token_budget

    last_request = recording.requests[-1]
    tool_msgs = _tool_messages(last_request)
    assert len(tool_msgs) == rounds, "tool messages must be clipped in place, never removed"
    contents = [m.get("content") or "" for m in tool_msgs]
    assert contents[-1] != TOOL_RESULT_DROPPED, "the newest tool result must stay intact"
    assert "snippet" in contents[-1], "the newest tool result keeps real (clipped) data"
    assert TOOL_RESULT_DROPPED in contents[:-1], (
        "older tool results become placeholders once the budget is exceeded"
    )


def test_clip_tool_content_marks_truncation() -> None:
    from app.services.agent import _clip_tool_content

    small = '{"rows": [1]}'
    assert _clip_tool_content(small, 100) == small

    big = "x" * 10_000
    clipped = _clip_tool_content(big, 1_000)
    payload = json.loads(clipped)
    assert payload["truncated_for_context"] is True
    assert 0 < len(payload["snippet"]) < 1_000
    assert len(clipped) <= 1_000
