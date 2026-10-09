"""Shared fixtures."""

from __future__ import annotations

import os

os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "10000")
os.environ.setdefault("LLM_PROVIDER", "groq")

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.llm import MockProvider, set_provider
from app.main import app
from app.services.session_store import get_store


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def store():
    return get_store()


@pytest.fixture()
def session(store):
    return store.create(name="test")


SAMPLE_CSV = b"""region,product,date,units,revenue,cost
North,Widget,2024-01-05,10,1000.0,600.0
South,Widget,2024-01-06,5,500.0,300.0
North,Gadget,2024-01-07,,8000.0,4000.0
East,Gadget,2024-02-01,3,300.0,100.0
West,Widget,2024-02-02,7,700.0,420.0
"""

LATIN1_CSV = "café,price\ncafé latte,3.50\ncrème brûlée,6.00\n".encode("latin-1")

SEMICOLON_CSV = b"a;b;c\n1;2;3\n4;5;6\n"


@pytest.fixture()
def sample_csv() -> bytes:
    return SAMPLE_CSV


@pytest.fixture()
def mock_llm() -> MockProvider:
    provider = MockProvider()
    set_provider(provider)
    yield provider
    set_provider(None)


def make_client() -> TestClient:
    return TestClient(app)


def make_session_with_csv(
    client: TestClient, csv_bytes: bytes = SAMPLE_CSV, filename: str = "Sales 2024.csv"
) -> str:
    resp = client.post("/api/sessions", json={"name": "t"})
    assert resp.status_code == 201, resp.text
    session_id = resp.json()["session_id"]
    resp = client.post(
        f"/api/sessions/{session_id}/files",
        files=[("files", (filename, csv_bytes, "text/csv"))],
    )
    assert resp.status_code == 201, resp.text
    return session_id


def build_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "region": ["North", "South", "East", "West"],
            "revenue": [1000.0, 500.0, 300.0, 99999.0],
            "units": [10, 5, 3, 7],
        }
    )
