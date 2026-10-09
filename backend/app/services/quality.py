"""Data-quality computation shared by the agent tool and the inspector API."""

from __future__ import annotations

import pandas as pd

from app.models.schemas import DataQualityReport
from app.services.session_store import Dataset


def build_quality_report(dataset: Dataset) -> DataQualityReport:
    """Score a dataset: nulls, duplicates, outliers, constant cols, type mismatches."""
    df = dataset.dataframe
    nulls = {str(c): round(float(df[c].isna().mean() * 100), 2) for c in df.columns}
    dupes = int(df.duplicated().sum())
    constant = [str(c) for c in df.columns if df[c].nunique(dropna=True) <= 1]
    outliers: dict[str, int] = {}
    type_mismatches: list[str] = []

    for col in df.columns:
        series = df[col]
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            valid = series.dropna()
            if len(valid) >= 10 and valid.std(ddof=0) > 0:
                z = (valid - valid.mean()) / valid.std(ddof=0)
                count = int((z.abs() > 3).sum())
                if count:
                    outliers[str(col)] = count
        elif series.dtype == object:
            numeric_like = pd.to_numeric(series, errors="coerce")
            non_null = int(series.notna().sum())
            if (
                non_null
                and numeric_like.notna().mean() > 0.9
                and numeric_like.isna().sum() < non_null
            ):
                type_mismatches.append(f"{col}: looks numeric but is stored as {series.dtype}")

    score = 100.0
    score -= sum(min(v, 50) * 0.4 for v in nulls.values()) / max(len(nulls), 1)
    score -= (dupes / max(len(df), 1)) * 30
    score -= len(constant) * 2
    score -= len(type_mismatches) * 2

    return DataQualityReport(
        dataset=dataset.info.table_name,
        row_count=len(df),
        column_count=len(df.columns),
        duplicate_rows=dupes,
        nulls=nulls,
        constant_columns=constant,
        outliers=outliers,
        type_mismatches=type_mismatches,
        score=round(max(score, 0.0), 1),
    )
