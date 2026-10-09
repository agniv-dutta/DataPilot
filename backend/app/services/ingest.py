"""CSV validation, ingestion, and profiling."""

from __future__ import annotations

import io
import re
from datetime import UTC, datetime

import chardet
import pandas as pd

from app.core.config import Settings
from app.core.errors import (
    FileTooLargeError,
    NotFoundError,
    UnsupportedFileTypeError,
    ValidationFailure,
)
from app.models.schemas import (
    ColumnProfile,
    DatasetInfo,
    DatasetProfile,
)
from app.services.session_store import Dataset, Session


def sanitize_table_name(filename: str) -> str:
    """'Sales 2024.csv' -> 'sales_2024'. Always a valid identifier."""
    stem = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if stem.lower().endswith(".csv"):
        stem = stem[:-4]
    name = re.sub(r"[^0-9a-zA-Z]+", "_", stem).strip("_").lower()
    name = re.sub(r"_+", "_", name)
    if not name:
        name = "dataset"
    if name[0].isdigit():
        name = f"t_{name}"
    return name[:64]


def _unique_table_name(session: Session, base: str) -> str:
    if session.dataset_by_table(base) is None:
        return base
    i = 2
    while session.dataset_by_table(f"{base}_{i}") is not None:
        i += 1
    return f"{base}_{i}"


def validate_filename(filename: str) -> None:
    if not filename or not filename.lower().endswith(".csv"):
        raise UnsupportedFileTypeError(
            f"'{filename}' is not a .csv file. Only CSV uploads are supported."
        )


def validate_size(size_bytes: int, settings: Settings) -> None:
    if size_bytes == 0:
        raise ValidationFailure("File is empty.")
    if size_bytes > settings.max_upload_bytes:
        mb = settings.max_upload_bytes / (1024 * 1024)
        raise FileTooLargeError(f"File is {size_bytes / (1024 * 1024):.1f}MB; limit is {mb:.0f}MB.")


def detect_encoding(raw: bytes) -> str:
    """utf-8 first, chardet guess, latin-1 never fails."""
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass
    guess = chardet.detect(raw[:100_000]) or {}
    encoding = (guess.get("encoding") or "").lower()
    if encoding in {"utf-8", "utf-8-sig", "ascii"}:
        return "utf-8-sig" if encoding == "utf-8-sig" else "utf-8"
    if encoding:
        try:
            raw.decode(encoding)
            return encoding
        except (UnicodeDecodeError, LookupError):
            pass
    return "latin-1"


def read_csv_bytes(raw: bytes, filename: str) -> pd.DataFrame:
    """Decode, sniff delimiter, parse. Raises ValidationFailure on bad input."""
    if not raw.strip():
        raise ValidationFailure(f"'{filename}' contains no data.")
    encoding = detect_encoding(raw)
    text = raw.decode(encoding, errors="replace")
    if "\x00" in text:
        raise ValidationFailure(f"'{filename}' does not look like a text CSV file.")
    sample = text[:50_000]
    candidates = [",", ";", "\t", "|"]
    counts = {d: sample.count(d) for d in candidates}
    delimiter = max(counts, key=lambda d: (counts[d], d == ","))
    try:
        df = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            encoding="utf-8",  # already decoded
            on_bad_lines="warn",
        )
    except pd.errors.EmptyDataError as exc:
        raise ValidationFailure(f"'{filename}' has no parseable columns.") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValidationFailure(f"Could not parse '{filename}': {exc}") from exc

    if df.empty and len(df.columns) == 0:
        raise ValidationFailure(f"'{filename}' has no columns.")
    if df.shape[0] == 0:
        raise ValidationFailure(f"'{filename}' contains only a header row (no data).")
    df = _dedupe_columns(df)
    df = _parse_dates(df)
    return df


def _dedupe_columns(df: pd.DataFrame) -> pd.DataFrame:
    seen: dict[str, int] = {}
    renamed: list[str] = []
    for col in df.columns:
        base = str(col).strip() or "column"
        if base in seen:
            seen[base] += 1
            base = f"{base}_{seen[base]}"
        else:
            seen[base] = 1
        renamed.append(base)
    df.columns = renamed
    return df


_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y")


def _parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Auto-convert object columns that look like dates (only if most values parse)."""
    for col in df.columns:
        if df[col].dtype != object:
            continue
        sample = df[col].dropna().astype(str).head(50)
        if sample.empty:
            continue
        for fmt in _DATE_FORMATS:
            try:
                parsed = pd.to_datetime(sample, format=fmt, errors="raise")
            except (ValueError, TypeError):
                continue
            if parsed.notna().mean() > 0.9:
                try:
                    df[col] = pd.to_datetime(df[col], format=fmt, errors="coerce")
                except (ValueError, TypeError):
                    pass
                break
        else:
            try:
                parsed = pd.to_datetime(sample, errors="raise", format="mixed")
                if parsed.notna().mean() > 0.9:
                    df[col] = pd.to_datetime(df[col], errors="coerce", format="mixed")
            except (ValueError, TypeError):
                continue
    return df


def profile_dataframe(df: pd.DataFrame, settings: Settings) -> DatasetProfile:
    rows, cols = df.shape
    columns: list[ColumnProfile] = []
    issues: list[str] = []
    null_penalty = 0.0

    for col in df.columns:
        series = df[col]
        null_pct = float(series.isna().mean() * 100) if rows else 0.0
        null_penalty += null_pct / max(cols, 1)
        unique = int(series.nunique(dropna=True))
        prof = ColumnProfile(
            name=str(col),
            dtype=str(series.dtype),
            null_pct=round(null_pct, 2),
            unique_count=unique,
        )
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            valid = series.dropna()
            if not valid.empty:
                prof.min = _jsonable(valid.min())
                prof.max = _jsonable(valid.max())
                mean = valid.mean()
                prof.mean = float(mean) if pd.notna(mean) else None
        elif pd.api.types.is_datetime64_any_dtype(series):
            valid = series.dropna()
            if not valid.empty:
                prof.min = str(valid.min())
                prof.max = str(valid.max())
        if unique <= 50 and rows:
            tops = series.value_counts(dropna=True).head(10)
            prof.top_values = [{"value": _jsonable(v), "count": int(c)} for v, c in tops.items()]
        if null_pct > 50:
            issues.append(f"{col}: {null_pct:.0f}% missing")
        if unique == 1 and rows > 1:
            issues.append(f"{col}: constant column")
        columns.append(prof)

    if df.duplicated().any():
        issues.append(f"{int(df.duplicated().sum())} duplicate rows")

    sample = df.head(settings.sample_rows)
    score = max(0.0, round(100.0 - null_penalty, 1))
    return DatasetProfile(
        row_count=rows,
        column_count=cols,
        columns=columns,
        sample_rows=[
            {str(k): _jsonable(v) for k, v in row.items()} for row in sample.to_dict("records")
        ],
        quality_score=score,
        quality_issues=issues,
    )


def _jsonable(value: object) -> object:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, (int, float, bool, str)):
        return value
    try:
        if bool(pd.isna(value)):  # type: ignore[call-overload]
            return None
    except (TypeError, ValueError):
        pass
    return str(value)


def _register_table(session: Session, table_name: str, df: pd.DataFrame) -> None:
    with session.lock:
        session.connection.register(table_name, df)


def _unregister_table(session: Session, table_name: str) -> None:
    with session.lock:
        try:
            session.connection.unregister(table_name)
        except Exception:  # noqa: BLE001
            pass


def add_dataset(
    session: Session,
    filename: str,
    raw: bytes,
    settings: Settings,
) -> DatasetInfo:
    """Validate, parse, profile, and register a CSV as a DuckDB table."""
    validate_filename(filename)
    validate_size(len(raw), settings)
    if len(session.datasets) >= settings.max_files_per_session:
        raise ValidationFailure(f"Session file limit reached ({settings.max_files_per_session}).")

    df = read_csv_bytes(raw, filename)
    if df.shape[1] == 0:
        raise ValidationFailure(f"'{filename}' has no columns.")

    profile = profile_dataframe(df, settings)
    base = sanitize_table_name(filename)
    table_name = _unique_table_name(session, base)
    file_id = (
        filename if filename not in session.datasets else f"{filename}#{len(session.datasets)}"
    )
    info = DatasetInfo(
        file_id=file_id,
        filename=filename,
        table_name=table_name,
        size_bytes=len(raw),
        uploaded_at=datetime.now(UTC),
        profile=profile,
    )
    dataset = Dataset(info=info, dataframe=df)
    with session.lock:
        session.datasets[file_id] = dataset
    _register_table(session, table_name, df)
    return info


def remove_dataset(session: Session, file_id: str) -> None:
    dataset = session.datasets.get(file_id)
    if dataset is None:
        raise NotFoundError(f"Dataset '{file_id}' not found")
    _unregister_table(session, dataset.info.table_name)
    with session.lock:
        session.datasets.pop(file_id, None)


def list_datasets(session: Session) -> list[DatasetInfo]:
    return [ds.info for ds in session.datasets.values()]
