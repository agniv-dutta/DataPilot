"""Chat routes: SSE streaming and a non-streaming fallback."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from starlette.concurrency import iterate_in_threadpool

from app.api.files import get_session
from app.core.errors import ValidationFailure
from app.models.schemas import ChatRequest, ChatResponse
from app.services.agent import AgentEvent, AnalystAgent
from app.services.session_store import Session

router = APIRouter(prefix="/api", tags=["chat"])


def _sse_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }


def _events(session: Session, message: str) -> Iterator[str]:
    agent = AnalystAgent(session)
    yield AgentEvent("status", {"message": "Received message"}).to_sse()
    for event in agent.run(message):
        yield event.to_sse()


@router.post("/sessions/{session_id}/chat")
def chat_stream(
    body: ChatRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """SSE stream: event types status | tool_call | token | chart | anomaly | final | error."""
    if not body.message.strip():
        raise ValidationFailure("Message cannot be empty.")
    events = _events(session, body.message)
    return StreamingResponse(
        iterate_in_threadpool(events),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


@router.post("/sessions/{session_id}/chat/sync", response_model=ChatResponse)
def chat_sync(
    body: ChatRequest,
    session: Session = Depends(get_session),
) -> ChatResponse:
    """Non-streaming fallback for clients that cannot consume SSE."""
    if not body.message.strip():
        raise ValidationFailure("Message cannot be empty.")
    agent = AnalystAgent(session)
    final, tool_log, iterations = agent.run_final(body.message)
    return ChatResponse(
        session_id=session.session_id,
        final=final,
        iterations=iterations,
        tool_calls=tool_log,
    )
