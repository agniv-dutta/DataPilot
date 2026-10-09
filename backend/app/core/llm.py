"""LLM provider abstraction. Anthropic default, OpenAI swappable.

All keys come from env; none are ever hardcoded or logged.
"""

from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

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


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    @property
    def model(self) -> str:
        return get_settings().anthropic_model

    def is_configured(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    def chat(
        self,
        messages: list[Message],
        tools: list[Json] | None = None,
        system: str | None = None,
    ) -> LLMResponse:
        import anthropic

        client = anthropic.Anthropic()
        system_text = system or ""
        api_messages = _to_anthropic_messages(messages)
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": get_settings().llm_max_tokens,
            "messages": api_messages,
        }
        if system_text:
            kwargs["system"] = system_text
        if tools:
            kwargs["tools"] = [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "input_schema": t["input_schema"],
                }
                for t in tools
            ]
        try:
            response = client.messages.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"Anthropic request failed: {exc}") from exc

        text = "".join(block.text for block in response.content if block.type == "text")
        tool_calls = [
            ToolCall(id=block.id, name=block.name, input=dict(block.input))
            for block in response.content
            if block.type == "tool_use"
        ]
        stop = getattr(response, "stop_reason", "end") or "end"
        return LLMResponse(
            text=text,
            tool_calls=tool_calls,
            stop_reason="tool_use" if tool_calls else stop,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


class OpenAIProvider(LLMProvider):
    name = "openai"

    @property
    def model(self) -> str:
        return get_settings().openai_model

    def is_configured(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))

    def chat(
        self,
        messages: list[Message],
        tools: list[Json] | None = None,
        system: str | None = None,
    ) -> LLMResponse:
        from openai import OpenAI

        client = OpenAI()
        api_messages: list[Json] = []
        if system:
            api_messages.append({"role": "system", "content": system})
        api_messages.extend(m.to_dict() for m in messages)
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": get_settings().llm_max_tokens,
        }
        if tools:
            kwargs["tools"] = [{"type": "function", "function": t} for t in tools]
        try:
            response = client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"OpenAI request failed: {exc}") from exc

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


def _to_anthropic_messages(messages: list[Message]) -> list[Json]:
    """Convert internal messages to Anthropic's format (tool_result blocks)."""
    out: list[Json] = []
    for msg in messages:
        if msg.role == "system":
            continue
        if msg.role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": msg.tool_call_id,
                "content": msg.content,
            }
            if out and out[-1]["role"] == "assistant":
                out[-1]["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
            continue
        if msg.role == "assistant":
            content: list[Json] = []
            if msg.content:
                content.append({"type": "text", "text": msg.content})
            for tc in msg.tool_calls:
                content.append(
                    {"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}
                )
            out.append({"role": "assistant", "content": content or msg.content})
            continue
        out.append({"role": "user", "content": msg.content})
    # Anthropic requires alternating turns starting with user; merge consecutive.
    merged: list[Json] = []
    for entry in out:
        if merged and merged[-1]["role"] == entry["role"]:
            prev = merged[-1]["content"]
            cur = entry["content"]
            if isinstance(prev, str) and isinstance(cur, str):
                merged[-1]["content"] = prev + "\n\n" + cur
            elif isinstance(prev, list) and isinstance(cur, list):
                merged[-1]["content"] = prev + cur
            elif isinstance(prev, list) and isinstance(cur, str):
                merged[-1]["content"] = prev + [{"type": "text", "text": cur}]
            elif isinstance(prev, str) and isinstance(cur, list):
                merged[-1]["content"] = [{"type": "text", "text": prev}] + cur
        else:
            merged.append(dict(entry))
    while merged and merged[0]["role"] != "user":
        merged.pop(0)
    return merged


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
        settings = get_settings()
        _provider = OpenAIProvider() if settings.llm_provider == "openai" else AnthropicProvider()
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
            "No LLM API key configured. Set ANTHROPIC_API_KEY (default provider) "
            "or OPENAI_API_KEY with LLM_PROVIDER=openai."
        )
    logger.info("llm call", extra={"event": f"{p.name}:{p.model}"})
    return p.chat(messages, tools=tools, system=system)


StreamCallback = Callable[[str, Json], None]
