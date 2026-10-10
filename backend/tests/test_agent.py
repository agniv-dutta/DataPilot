"""Agent tests with a mocked LLM, plus SSE and chat API behavior."""

from __future__ import annotations

import json
from datetime import UTC

import pandas as pd
from fastapi.testclient import TestClient

from app.core.llm import LLMResponse, MockProvider, ToolCall
from app.services.agent import AgentEvent, AnalystAgent
from app.services.session_store import get_store
from tests.conftest import make_session_with_csv


def _final_response() -> LLMResponse:
    payload = {
        "answer": "The **North** region generated the highest revenue: **$500.00**.",
        "insights": ["North leads with $500 revenue across 2 orders."],
        "sql": "SELECT region, SUM(revenue) AS revenue FROM sales_2024 GROUP BY 1 ORDER BY 2 DESC",
        "reasoning": ["Listed schema", "Aggregated revenue by region"],
        "follow_up_suggestions": ["Monthly revenue trend", "Detect anomalies"],
    }
    return LLMResponse(text=json.dumps(payload))


def _tool_then_final() -> list[LLMResponse]:
    return [
        LLMResponse(
            stop_reason="tool_use",
            tool_calls=[
                ToolCall(
                    id="t1",
                    name="run_sql",
                    input={
                        "query": "SELECT region, SUM(revenue) AS revenue FROM sales_2024 GROUP BY 1 ORDER BY 2 DESC"
                    },
                )
            ],
        ),
        _final_response(),
    ]


def test_agent_end_to_end_with_mock_llm(mock_llm: MockProvider) -> None:
    mock_llm.responses = _tool_then_final()
    session = get_store().create()
    session.connection.register(
        "sales_2024",
        pd.DataFrame({"region": ["North", "South"], "revenue": [500.0, 250.0]}),
    )
    agent = AnalystAgent(session)
    events = list(agent.run("Which region made the most money?"))
    types = [e.type for e in events]
    assert "tool_call" in types
    assert "final" in types
    final = next(e for e in events if e.type == "final").data["final"]
    assert "North" in final["answer"]
    assert final["sql"]
    assert len(mock_llm.calls) == 2


def test_agent_feeds_sandbox_error_back_for_retry(mock_llm: MockProvider) -> None:
    mock_llm.responses = [
        LLMResponse(
            tool_calls=[ToolCall(id="t1", name="run_sql", input={"query": "DROP TABLE sales_2024"})]
        ),
        LLMResponse(
            tool_calls=[
                ToolCall(
                    id="t2",
                    name="run_sql",
                    input={"query": "SELECT region FROM sales_2024 LIMIT 1"},
                )
            ]
        ),
        _final_response(),
    ]
    session = get_store().create()
    session.connection.register("sales_2024", pd.DataFrame({"region": ["North"], "revenue": [1.0]}))
    agent = AnalystAgent(session)
    events = list(agent.run("hello"))
    tool_msgs = [e for e in events if e.type == "tool_call"]
    assert len(tool_msgs) == 2
    # The second LLM call must have received the error text.
    statuses = [e.data.get("message", "") for e in events if e.type == "status"]
    assert any("failed" in s for s in statuses)
    assert any(e.type == "final" for e in events)


def test_agent_detect_anomalies_tool(mock_llm: MockProvider) -> None:
    mock_llm.responses = [
        LLMResponse(
            tool_calls=[
                ToolCall(
                    id="t1",
                    name="detect_anomalies",
                    input={"dataset": "sales_2024", "method": "zscore"},
                )
            ]
        ),
        _final_response(),
    ]
    session = get_store().create()
    revenues = [100.0 + i for i in range(30)] + [9000.0]
    df = pd.DataFrame({"region": [f"r{i % 5}" for i in range(len(revenues))], "revenue": revenues})
    from datetime import datetime

    from app.models.schemas import DatasetInfo, DatasetProfile
    from app.services.session_store import Dataset

    info = DatasetInfo(
        file_id="s.csv",
        filename="s.csv",
        table_name="sales_2024",
        size_bytes=10,
        uploaded_at=datetime.now(UTC),
        profile=DatasetProfile(row_count=len(df), column_count=2, columns=[]),
    )
    session.datasets["s.csv"] = Dataset(info=info, dataframe=df)
    session.connection.register("sales_2024", df)

    agent = AnalystAgent(session)
    events = list(agent.run("any anomalies?"))
    anomaly_events = [e for e in events if e.type == "anomaly"]
    assert anomaly_events
    report = anomaly_events[0].data["anomaly"]
    assert report["flagged_count"] >= 1
    assert "σ" in report["rows"][0]["reasons"][0] or "sigma" in report["rows"][0]["reasons"][0]


def test_chat_sync_endpoint(client: TestClient, mock_llm: MockProvider) -> None:
    mock_llm.responses = _tool_then_final()
    sid = make_session_with_csv(client)
    resp = client.post(
        f"/api/sessions/{sid}/chat/sync", json={"message": "Which region has the highest revenue?"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "North" in body["final"]["answer"]
    assert body["iterations"] >= 1
    assert body["tool_calls"]


def test_chat_sync_surfaces_agent_error(client: TestClient, monkeypatch) -> None:
    def failed_run(_self, _message):
        yield AgentEvent("error", {"message": "provider unavailable", "code": "llm_error"})

    monkeypatch.setattr(AnalystAgent, "run", failed_run)
    sid = make_session_with_csv(client)
    response = client.post(f"/api/sessions/{sid}/chat/sync", json={"message": "Analyze this"})

    assert response.status_code == 500
    body = response.json()["error"]
    assert body["code"] == "agent_error"
    assert body["message"] == "provider unavailable"
    assert body["details"]["upstream_code"] == "llm_error"


def test_chat_stream_sse(client: TestClient, mock_llm: MockProvider) -> None:
    mock_llm.responses = _tool_then_final()
    sid = make_session_with_csv(client)
    with client.stream(
        "POST", f"/api/sessions/{sid}/chat", json={"message": "top region?"}
    ) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        raw = "".join(resp.iter_text())
    assert "event: tool_call" in raw
    assert "event: final" in raw
    assert "event: status" in raw
    final_line = [line for line in raw.splitlines() if line.startswith("data:")][-1]
    payload = json.loads(final_line.removeprefix("data:"))
    assert "final" in payload


def test_chat_rejects_empty_message(client: TestClient) -> None:
    sid = make_session_with_csv(client)
    resp = client.post(f"/api/sessions/{sid}/chat/sync", json={"message": "   "})
    assert resp.status_code == 422


def test_follow_up_uses_history(client: TestClient, mock_llm: MockProvider) -> None:
    mock_llm.responses = _tool_then_final() + _tool_then_final()
    sid = make_session_with_csv(client)
    for q in ("Which region is highest?", "now break that down by product"):
        resp = client.post(f"/api/sessions/{sid}/chat/sync", json={"message": q})
        assert resp.status_code == 200
    session = get_store().get(sid)
    roles = [m["role"] for m in session.history]
    assert roles == ["user", "assistant", "user", "assistant"]


def test_chart_tool_builds_spec(mock_llm: MockProvider) -> None:
    mock_llm.responses = [
        LLMResponse(
            tool_calls=[
                ToolCall(
                    id="c1",
                    name="run_sql",
                    input={
                        "query": "SELECT region, SUM(revenue) AS revenue FROM sales_2024 GROUP BY 1"
                    },
                )
            ]
        ),
        LLMResponse(
            tool_calls=[
                ToolCall(
                    id="c2",
                    name="create_chart",
                    input={
                        "chart_type": "bar",
                        "title": "Revenue by region",
                        "x": "region",
                        "y": ["revenue"],
                    },
                )
            ]
        ),
        _final_response(),
    ]
    session = get_store().create()
    session.connection.register(
        "sales_2024",
        pd.DataFrame({"region": ["North", "South"], "revenue": [500.0, 250.0]}),
    )
    agent = AnalystAgent(session)
    events = list(agent.run("chart please"))
    charts = [e for e in events if e.type == "chart"]
    assert len(charts) == 1
    spec = charts[0].data["chart"]
    assert spec["chart_type"] == "bar"
    assert spec["x"] == "region"
    assert sorted(spec["series"][0]["data"]) == [250.0, 500.0]
    final = next(e for e in events if e.type == "final").data["final"]
    assert final["charts"]


def test_iteration_budget_exhausted(mock_llm: MockProvider) -> None:
    # Never stops calling tools; agent must force a final answer.
    mock_llm.responses = [
        LLMResponse(tool_calls=[ToolCall(id=f"t{i}", name="get_schema", input={})])
        for i in range(10)
    ]
    session = get_store().create()
    session.connection.register("t", pd.DataFrame({"a": [1]}))
    agent = AnalystAgent(session)
    events = list(agent.run("hi"))
    final_events = [e for e in events if e.type == "final"]
    assert final_events
    assert len([e for e in events if e.type == "tool_call"]) <= 6
