"""LLM provider abstraction. Groq (OpenAI-compatible) with tool calling.

Models are served via Groq's OpenAI-compatible endpoint. All keys come from
env; none are ever hardcoded or logged.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.core.errors import LLMError
from app.core.logging import get_logger

logger = get_logger(__name__)

Json = dict[str, Any]


@dataclass
class ToolCall:
    id: str
    name: str
    input: Json


@dataclass
class LLMResponse:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = "end"
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class Message:
    role: str  # system | user | assistant | tool
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None
    name: str | None = None

    def to_dict(self) -> Json:
        data: Json = {"role": self.role}
        if self.role == "assistant" and (self.tool_calls or self.content):
            if self.content:
                data["content"] = self.content
            if self.tool_calls:
                data["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.input),
                        },
                    }
                    for tc in self.tool_calls
                ]
            if "content" not in data and self.tool_calls:
                data["content"] = None
        elif self.role == "tool":
            data["content"] = self.content
            data["tool_call_id"] = self.tool_call_id
            data["name"] = self.name
        else:
            data["content"] = self.content
        return data


class LLMProvider(ABC):
    """Minimal chat interface with tool calling."""

    name: str = "base"

    @abstractmethod
    def chat(
        self,
        messages: list[Message],
        tools: list[Json] | None = None,
        system: str | None = None,
    ) -> LLMResponse: ...

    @abstractmethod
    def is_configured(self) -> bool: ...

    @property
    @abstractmethod
    def model(self) -> str: ...


class GroqProvider(LLMProvider):
    """Groq cloud chat completions (OpenAI-compatible) with tool calling.

    Default model ``openai/gpt-oss-120b`` supports tool use and JSON mode.
    Other tool-calling models available on Groq include
    ``openai/gpt-oss-20b``, ``qwen/qwen3.8-27b`` and ``allam-2-7b``.
    """

    name = "groq"

    @property
    def model(self) -> str:
        return get_settings().groq_model

    def is_configured(self) -> bool:
        return bool(get_settings().groq_api_key.get_secret_value())

    def chat(
        self,
        messages: list[Message],
        tools: list[Json] | None = None,
        system: str | None = None,
    ) -> LLMResponse:
        from groq import Groq

        settings = get_settings()
        api_key = settings.groq_api_key.get_secret_value()
        client = Groq(api_key=api_key, base_url=settings.groq_base_url)
        api_messages: list[Json] = []
        if system:
            api_messages.append({"role": "system", "content": system})
        api_messages.extend(m.to_dict() for m in messages)
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": settings.llm_max_tokens,
        }
        if tools:
            kwargs["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema")
                        or t.get("parameters")
                        or {"type": "object", "properties": {}},
                    },
                }
                for t in tools
            ]
        try:
            response = client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            recovered = _recover_tool_use_failure(exc, tools or [])
            if recovered is not None:
                logger.warning(
                    "recovered invalid tool call",
                    extra={"event": f"{self.name}:tool_use_failed"},
                )
                return recovered
            raise LLMError(f"Groq request failed: {exc}") from exc

        choice = response.choices[0]
        message = choice.message
        tool_calls: list[ToolCall] = []
        for tc in message.tool_calls or []:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {"_raw": tc.function.arguments}
            tool_calls.append(ToolCall(id=tc.id, name=tc.function.name, input=args))
        usage = response.usage
        return LLMResponse(
            text=message.content or "",
            tool_calls=tool_calls,
            stop_reason="tool_use" if tool_calls else (choice.finish_reason or "stop"),
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
        )


def _allows_null(spec: object) -> bool:
    """True when a JSON-Schema property description admits a null value."""
    if not isinstance(spec, dict):
        return True
    declared = spec.get("type")
    if isinstance(declared, list):
        return "null" in declared
    return declared == "null"


def _sanitize_tool_args(args: Json, schema: Json | None) -> Json:
    """Drop nulls the tool's schema does not allow (models emit them anyway).

    Optional fields our handlers read with ``args.get(...)`` are simply omitted;
    nulls on fields that allow null are kept as-is.
    """
    properties = (schema or {}).get("properties") or {}
    cleaned: Json = {}
    for key, value in args.items():
        if value is None and not _allows_null(properties.get(key)):
            continue
        cleaned[key] = value
    return cleaned


def _recover_tool_use_failure(exc: Exception, tools: list[Json]) -> LLMResponse | None:
    """Recover from a Groq ``tool_use_failed`` 400.

    Groq validates the model's generated tool call against the schema we sent and
    rejects the whole request when it does not match. The attempted call is echoed
    back in ``error.failed_generation``, so we can usually salvage it:

    * a **known** tool with slightly invalid arguments (e.g. ``series: null`` on a
      non-nullable field) is repaired and returned as a real tool call;
    * an **invented** tool (e.g. ``json``) cannot run, but its payload is the final
      answer the model wanted to write anyway, so it is returned as text.
    """
    body = getattr(exc, "body", None)
    if not isinstance(body, dict):
        return None
    error = body.get("error")
    if not isinstance(error, dict) or error.get("code") != "tool_use_failed":
        return None
    failed = error.get("failed_generation")
    if isinstance(failed, str):
        try:
            failed = json.loads(failed)
        except json.JSONDecodeError:
            return None
    if not isinstance(failed, dict):
        return None
    name = failed.get("name")
    if not isinstance(name, str) or not name:
        return None

    payload = failed.get("arguments")
    if isinstance(payload, str):
        text = payload
        try:
            parsed: Json | None = json.loads(payload) if payload.strip() else {}
        except json.JSONDecodeError:
            parsed = None
    elif isinstance(payload, dict):
        parsed = payload
        text = json.dumps(payload, ensure_ascii=False)
    else:
        return None

    schemas = {t["name"]: (t.get("input_schema") or t.get("parameters")) for t in tools}
    if name in schemas:
        if not isinstance(parsed, dict):
            return None
        return LLMResponse(
            text="",
            tool_calls=[
                ToolCall(id=f"call_{uuid4().hex}", name=name, input=_sanitize_tool_args(parsed, schemas[name]))
            ],
            stop_reason="tool_use",
        )

    if not text.strip():
        return None
    return LLMResponse(text=text, stop_reason="end")


class MockProvider(LLMProvider):
    """Deterministic provider for tests: replays scripted responses."""

    name = "mock"

    def __init__(self, responses: list[LLMResponse] | None = None) -> None:
        self.responses = list(responses or [])
        self.calls: list[Json] = []

    @property
    def model(self) -> str:
        return "mock"

    def is_configured(self) -> bool:
        return True

    def chat(
        self,
        messages: list[Message],
        tools: list[Json] | None = None,
        system: str | None = None,
    ) -> LLMResponse:
        self.calls.append({"messages": len(messages), "tools": len(tools or []), "system": system})
        if not self.responses:
            return LLMResponse(text="I could not answer that.")
        return self.responses.pop(0)


_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = GroqProvider()
    return _provider


def set_provider(provider: LLMProvider | None) -> None:
    """Test hook."""
    global _provider
    _provider = provider


def complete(
    messages: list[Message],
    tools: list[Json] | None = None,
    system: str | None = None,
    provider: LLMProvider | None = None,
) -> LLMResponse:
    p = provider or get_provider()
    if not p.is_configured() and p.name != "mock":
        raise LLMError(
            "No LLM API key configured. Set GROQ_API_KEY to enable chat "
            "(get one at https://console.groq.com/keys)."
        )
    logger.info("llm call", extra={"event": f"{p.name}:{p.model}"})
    return p.chat(messages, tools=tools, system=system)


StreamCallback = Callable[[str, Json], None]
