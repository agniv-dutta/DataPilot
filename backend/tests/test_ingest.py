"""CSV validation and ingestion edge cases."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.errors import FileTooLargeError, UnsupportedFileTypeError, ValidationFailure
from app.services.ingest import (
    detect_encoding,
    profile_dataframe,
    read_csv_bytes,
    sanitize_table_name,
)
from tests.conftest import LATIN1_CSV, SAMPLE_CSV, SEMICOLON_CSV


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Sales 2024.csv", "sales_2024"),
        ("my file (final).csv", "my_file_final"),
        ("Ünïcode.csv", "n_code"),  # non-ascii stripped
        ("123.csv", "t_123"),
        ("...csv", "dataset"),
        ("a//b/path/Report.CSV", "report"),
    ],
)
def test_sanitize_table_name(filename: str, expected: str) -> None:
    assert sanitize_table_name(filename) == expected


def test_reject_non_csv(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    resp = client.post(
        f"/api/sessions/{sid}/files",
        files=[("files", ("evil.exe", b"MZ\x90\x00", "application/octet-stream"))],
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "unsupported_file_type"


def test_reject_empty_file(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    resp = client.post(
        f"/api/sessions/{sid}/files",
        files=[("files", ("empty.csv", b"", "text/csv"))],
    )
    assert resp.status_code == 422
    assert "empty" in resp.json()["error"]["message"].lower()


def test_reject_oversized_file(client: TestClient) -> None:
    settings = get_settings()
    big = b"x" * (settings.max_upload_bytes + 1)
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    resp = client.post(
        f"/api/sessions/{sid}/files",
        files=[("files", ("big.csv", big, "text/csv"))],
    )
    assert resp.status_code == 413


def test_upload_and_profile(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    resp = client.post(
        f"/api/sessions/{sid}/files",
        files=[("files", ("Sales 2024.csv", SAMPLE_CSV, "text/csv"))],
    )
    assert resp.status_code == 201
    datasets = resp.json()
    assert len(datasets) == 1
    ds = datasets[0]
    assert ds["table_name"] == "sales_2024"
    assert ds["profile"]["row_count"] == 5
    assert ds["profile"]["column_count"] == 6
    names = [c["name"] for c in ds["profile"]["columns"]]
    assert names == ["region", "product", "date", "units", "revenue", "cost"]
    date_col = next(c for c in ds["profile"]["columns"] if c["name"] == "date")
    assert "datetime" in date_col["dtype"]
    units_col = next(c for c in ds["profile"]["columns"] if c["name"] == "units")
    assert units_col["null_pct"] > 0
    assert ds["profile"]["sample_rows"]


def test_multiple_files_and_join(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    products = b"product,category\nWidget,Hardware\nGadget,Hardware\n"
    resp = client.post(
        f"/api/sessions/{sid}/files",
        files=[
            ("files", ("sales.csv", SAMPLE_CSV, "text/csv")),
            ("files", ("products.csv", products, "text/csv")),
        ],
    )
    assert resp.status_code == 201
    assert len(resp.json()) == 2

    from app.core.sandbox import run_sql
    from app.services.session_store import get_store

    session = get_store().get(sid)
    result = run_sql(
        session,
        "SELECT s.region, SUM(s.revenue) AS revenue FROM sales s "
        "JOIN products p ON s.product = p.product GROUP BY 1 ORDER BY 2 DESC",
    )
    assert result.columns == ["region", "revenue"]
    assert len(result.rows) == 4


def test_delete_file(client: TestClient) -> None:
    sid = client.post("/api/sessions", json={}).json()["session_id"]
    ds = client.post(
        f"/api/sessions/{sid}/files",
        files=[("files", ("a.csv", SAMPLE_CSV, "text/csv"))],
    ).json()[0]
    resp = client.delete(f"/api/sessions/{sid}/files/{ds['file_id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/sessions/{sid}/files").json()["datasets"] == []


def test_unknown_session_404(client: TestClient) -> None:
    resp = client.get("/api/sessions/nope/files")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_latin1_encoding_detected() -> None:
    df = read_csv_bytes(LATIN1_CSV, "cafes.csv")
    assert df.iloc[0, 0] == "café latte"


def test_encoding_detection() -> None:
    assert detect_encoding("héllo".encode()) == "utf-8"
    latin1 = "héllo".encode("latin-1")
    enc = detect_encoding(latin1)
    assert enc != "utf-8"
    assert latin1.decode(enc) == "héllo"


def test_semicolon_delimiter_sniffed() -> None:
    df = read_csv_bytes(SEMICOLON_CSV, "sc.csv")
    assert list(df.columns) == ["a", "b", "c"]
    assert df.shape == (2, 3)


def test_duplicate_columns_deduped() -> None:
    df = read_csv_bytes(b"a,a ,a\n1,2,3\n", "dup.csv")
    assert len(list(df.columns)) == len(set(map(str, df.columns)))
    assert df.shape == (1, 3)


def test_parse_dates_automatic() -> None:
    df = read_csv_bytes(b"when\n2024-01-01\n2024-06-15\n", "dates.csv")
    assert str(df["when"].dtype).startswith("datetime64")


def test_garbage_file_rejected() -> None:
    with pytest.raises(ValidationFailure):
        read_csv_bytes(b"\x00\x01\x02 not a csv at all \x00", "garbage.csv")


def test_profile_reports_quality_issues() -> None:
    import pandas as pd

    df = pd.DataFrame(
        {
            "a": [1.0, None, None, None],
            "b": [1, 1, 1, 1],
            "c": ["x", "y", "x", "y"],
        }
    )
    profile = profile_dataframe(df, get_settings())
    assert profile.quality_score < 100
    joined = " ".join(profile.quality_issues)
    assert "missing" in joined
    assert "constant" in joined


def test_size_validator_helpers() -> None:
    settings = get_settings()
    with pytest.raises(ValidationFailure):
        from app.services.ingest import validate_size

        validate_size(0, settings)
    with pytest.raises(FileTooLargeError):
        from app.services.ingest import validate_size

        validate_size(settings.max_upload_bytes + 1, settings)
    with pytest.raises(UnsupportedFileTypeError):
        from app.services.ingest import validate_filename

        validate_filename("data.xlsx")
