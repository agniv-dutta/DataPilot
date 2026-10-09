"""Tests for the Groq provider layer (no network: local parsing only)."""

from __future__ import annotations

import json

from app.core.llm import LLMResponse, _recover_tool_use_failure, _sanitize_tool_args

CREATE_CHART = {
    "name": "create_chart",
    "input_schema": {
        "type": "object",
        "properties": {
            "chart_type": {"type": "string", "enum": ["bar", "line"]},
            "title": {"type": "string"},
            "x": {"type": "string"},
            "y": {"type": "array", "items": {"type": "string"}},
            "series": {"type": ["string", "null"]},
        },
        "required": ["chart_type", "title", "x", "y"],
    },
}

STRICT_SERIES = {
    "name": "create_chart",
    "input_schema": {
        "type": "object",
        "properties": {"series": {"type": "string"}, "title": {"type": "string"}},
        "required": ["title"],
    },
}


class _FakeGroqError(Exception):
    def __init__(self, body: object) -> None:
        super().__init__("boom")
        self.body = body


def _body(failed: object, code: str = "tool_use_failed") -> dict:
    return {"error": {"code": code, "failed_generation": failed}}


def _failed(name: str, arguments: object) -> dict:
    return _body(json.dumps({"name": name, "arguments": arguments}))


FINAL_ARGS = {
    "answer": "**No revenue column found**",
    "insights": ["No numeric sales metric exists in the schema."],
    "sql": None,
}


def test_invented_tool_becomes_final_answer_text() -> None:
    out = _recover_tool_use_failure(_FakeGroqError(_failed("json", FINAL_ARGS)), tools=[])
    assert isinstance(out, LLMResponse)
    assert out.tool_calls == []
    assert out.stop_reason == "end"
    assert json.loads(out.text) == FINAL_ARGS


def test_known_tool_is_repaired_and_returned_as_tool_call() -> None:
    strict_chart = {
        "name": "create_chart",
        "input_schema": {
            "type": "object",
            "properties": {
                "chart_type": {"type": "string", "enum": ["bar", "line"]},
                "title": {"type": "string"},
                "x": {"type": "string"},
                "y": {"type": "array", "items": {"type": "string"}},
                "series": {"type": "string"},
            },
            "required": ["chart_type", "title", "x", "y"],
        },
    }
    args = {"chart_type": "bar", "title": "T", "x": "product", "y": ["margin_pct"], "series": None}
    out = _recover_tool_use_failure(
        _FakeGroqError(_failed("create_chart", args)), tools=[strict_chart]
    )
    assert isinstance(out, LLMResponse)
    assert len(out.tool_calls) == 1
    call = out.tool_calls[0]
    assert call.name == "create_chart"
    assert call.id.startswith("call_")
    assert call.input == {
        "chart_type": "bar",
        "title": "T",
        "x": "product",
        "y": ["margin_pct"],
    }
    assert out.stop_reason == "tool_use"


def test_repair_keeps_nulls_the_schema_allows() -> None:
    args = {"title": "T", "series": None}
    out = _recover_tool_use_failure(
        _FakeGroqError(_failed("create_chart", args)), tools=[CREATE_CHART]
    )
    assert out is not None
    assert out.tool_calls[0].input["series"] is None


def test_known_tool_with_unparsable_arguments_is_not_recovered() -> None:
    out = _recover_tool_use_failure(
        _FakeGroqError(_body('{"name": "create_chart", "arguments": "{oops"}')),
        tools=[CREATE_CHART],
    )
    assert out is None


def test_other_error_codes_are_ignored() -> None:
    body = {"error": {"code": "rate_limit_exceeded", "message": "slow down"}}
    assert _recover_tool_use_failure(_FakeGroqError(body), tools=[]) is None


def test_garbage_bodies_are_ignored() -> None:
    assert _recover_tool_use_failure(_FakeGroqError(None), tools=[]) is None
    assert _recover_tool_use_failure(Exception("no body"), tools=[]) is None
    assert _recover_tool_use_failure(_FakeGroqError(_body("{not json")), tools=[]) is None
    assert _recover_tool_use_failure(_FakeGroqError(_body(["json"])), tools=[]) is None
    assert _recover_tool_use_failure(_FakeGroqError(_body({"name": "json"})), tools=[]) is None


def test_sanitize_drops_nulls_and_keeps_valid_values() -> None:
    schema = STRICT_SERIES["input_schema"]
    assert _sanitize_tool_args({"series": None, "title": "T"}, schema) == {"title": "T"}
    assert _sanitize_tool_args({"series": "margin", "title": "T"}, schema) == {
        "series": "margin",
        "title": "T",
    }
    # unknown keys are passed through untouched
    assert _sanitize_tool_args({"surprise": 1}, schema) == {"surprise": 1}
