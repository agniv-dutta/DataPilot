"""Session and dataset routes. No business logic here."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.config import Settings, get_settings
from app.models.schemas import (
    DatasetInfo,
    FileListResponse,
    InspectorSnapshot,
    SessionCreate,
    SessionOut,
)
from app.services import ingest
from app.services.session_store import InMemorySessionStore, Session, get_store

router = APIRouter(prefix="/api", tags=["files"])


def get_session(session_id: str, store: InMemorySessionStore = Depends(get_store)) -> Session:
    return store.get(session_id)


@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(
    body: SessionCreate | None = None,
    store: InMemorySessionStore = Depends(get_store),
) -> SessionOut:
    session = store.create(name=body.name if body else None)
    return SessionOut(
        session_id=session.session_id, created_at=session.created_at, name=session.name
    )


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session_info(session: Session = Depends(get_session)) -> SessionOut:
    return SessionOut(
        session_id=session.session_id, created_at=session.created_at, name=session.name
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    store: InMemorySessionStore = Depends(get_store),
) -> None:
    store.delete(session_id)


@router.post("/sessions/{session_id}/files", response_model=list[DatasetInfo], status_code=201)
async def upload_files(
    session: Session = Depends(get_session),
    files: list[UploadFile] = File(...),
    settings: Settings = Depends(get_settings),
) -> list[DatasetInfo]:
    results: list[DatasetInfo] = []
    for upload in files:
        raw = await upload.read()
        results.append(ingest.add_dataset(session, upload.filename or "upload.csv", raw, settings))
    return results


@router.get("/sessions/{session_id}/files", response_model=FileListResponse)
def list_files(session: Session = Depends(get_session)) -> FileListResponse:
    return FileListResponse(
        session_id=session.session_id,
        datasets=ingest.list_datasets(session),
    )


@router.get("/sessions/{session_id}/inspector", response_model=InspectorSnapshot)
def inspector(session: Session = Depends(get_session)) -> InspectorSnapshot:
    from app.models.schemas import ChartSpec
    from app.services.quality import build_quality_report

    quality = [
        build_quality_report(ds) for ds in session.datasets.values() if len(ds.dataframe) <= 200_000
    ]
    return InspectorSnapshot(
        session_id=session.session_id,
        quality=quality,
        query_history=[q for q in reversed(session.query_history[-50:])],
        pinned_charts=[ChartSpec.model_validate(c) for c in session.pinned_charts],
    )


@router.delete("/sessions/{session_id}/files/{file_id}", status_code=204)
def delete_file(file_id: str, session: Session = Depends(get_session)) -> None:
    ingest.remove_dataset(session, file_id)
