"""In-memory session store.

Interface-based so the backend could later swap in Redis/SQLite without
touching routes or services.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

import duckdb
import pandas as pd

from app.core.errors import NotFoundError
from app.models.schemas import DatasetInfo


@dataclass
class Dataset:
    info: DatasetInfo
    dataframe: pd.DataFrame


@dataclass
class Session:
    session_id: str
    created_at: datetime
    name: str | None = None
    datasets: dict[str, Dataset] = field(default_factory=dict)
    connection: duckdb.DuckDBPyConnection = field(
        default_factory=lambda: duckdb.connect(database=":memory:")
    )
    history: list[dict[str, Any]] = field(default_factory=list)
    query_cache: dict[str, Any] = field(default_factory=dict)
    pinned_charts: list[dict[str, Any]] = field(default_factory=list)
    query_history: list[dict[str, Any]] = field(default_factory=list)
    lock: threading.RLock = field(default_factory=threading.RLock)

    @property
    def dataframes(self) -> dict[str, pd.DataFrame]:
        return {ds.info.table_name: ds.dataframe for ds in self.datasets.values()}

    def get_dataset(self, file_id: str) -> Dataset:
        ds = self.datasets.get(file_id)
        if ds is None:
            raise NotFoundError(f"Dataset '{file_id}' not found in this session")
        return ds

    def dataset_by_table(self, table_name: str) -> Dataset | None:
        for ds in self.datasets.values():
            if ds.info.table_name == table_name:
                return ds
        return None


class SessionStoreInterface(Protocol):
    def create(self, name: str | None = None) -> Session: ...

    def get(self, session_id: str) -> Session: ...

    def delete(self, session_id: str) -> None: ...

    def all_ids(self) -> list[str]: ...


class InMemorySessionStore:
    """Thread-safe in-memory implementation."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self, name: str | None = None) -> Session:
        import uuid

        session_id = uuid.uuid4().hex
        session = Session(
            session_id=session_id,
            created_at=datetime.now(UTC),
            name=name,
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Session:
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise NotFoundError(f"Session '{session_id}' not found")
        return session

    def delete(self, session_id: str) -> None:
        with self._lock:
            session = self._sessions.pop(session_id, None)
        if session is None:
            raise NotFoundError(f"Session '{session_id}' not found")
        try:
            session.connection.close()
        except Exception:  # noqa: BLE001 - best effort cleanup
            pass

    def all_ids(self) -> list[str]:
        with self._lock:
            return list(self._sessions)


_store: InMemorySessionStore | None = None


def get_store() -> InMemorySessionStore:
    global _store
    if _store is None:
        _store = InMemorySessionStore()
    return _store
