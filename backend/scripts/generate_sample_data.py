"""Generate demo datasets under /sample_data.

Run: python scripts/generate_sample_data.py
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

ROOT = Path(__file__).resolve().parents[2] / "sample_data"
ROOT.mkdir(parents=True, exist_ok=True)

REGIONS = ["North", "South", "East", "West"]
PRODUCTS = ["Widget", "Gadget", "Widget Pro", "Gadget Mini", "Enterprise Suite"]
CUSTOMER_IDS = [f"C{1000 + i}" for i in range(80)]


def make_sales(n: int = 2000) -> pd.DataFrame:
    dates = pd.date_range("2023-01-01", periods=n, freq="h")
    rows: list[dict] = []
    for i in range(n):
        region = random.choices(REGIONS, weights=[0.35, 0.25, 0.2, 0.2])[0]
        product = random.choices(PRODUCTS, weights=[0.4, 0.3, 0.15, 0.1, 0.05])[0]
        month = (i % 12) + 1
        seasonality = 1.0 + 0.35 * np.sin(2 * np.pi * (month - 3) / 12)
        base = {"North": 220, "South": 160, "East": 110, "West": 95}[region]
        units = max(1, int(np.random.normal(base * seasonality, base * 0.25)))
        revenue_per_unit = {
            "Widget": 100,
            "Gadget": 250,
            "Widget Pro": 400,
            "Gadget Mini": 180,
            "Enterprise Suite": 1500,
        }[product]
        revenue = units * revenue_per_unit * (0.95 + random.random() * 0.1)
        cost = revenue * (0.55 + random.random() * 0.15)
        customer_id = random.choice(CUSTOMER_IDS)
        row = {
            "date": dates[i],
            "region": region,
            "product": product,
            "customer_id": customer_id,
            "units": units,
            "unit_price": revenue_per_unit,
            "revenue": round(revenue, 2),
            "cost": round(cost, 2),
            "profit": round(revenue - cost, 2),
        }
        # Injected anomalies: 5 absurd revenue spikes.
        if i % 500 == 250:
            row["revenue"] = round(revenue * 12, 2)
            row["profit"] = round(row["revenue"] - cost, 2)
        # Injected missing values.
        if i % 97 == 0:
            row["customer_id"] = None
        if i % 113 == 0:
            row["units"] = None
        rows.append(row)
    df = pd.DataFrame(rows)
    return df


def make_customers(n: int = 80) -> pd.DataFrame:
    first = ["Alice", "Bob", "Carol", "Dan", "Eve", "Frank", "Grace", "Henry"]
    last = ["Smith", "Johnson", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor"]
    rows = []
    for _i, cid in enumerate(CUSTOMER_IDS):
        rows.append(
            {
                "customer_id": cid,
                "name": f"{random.choice(first)} {random.choice(last)}",
                "tier": random.choices(
                    ["bronze", "silver", "gold", "platinum"], weights=[0.4, 0.3, 0.2, 0.1]
                )[0],
                "region": random.choice(REGIONS),
                "acquired_at": pd.Timestamp(
                    random.choice(pd.date_range("2020-01-01", "2024-01-01"))
                ),
            }
        )
    return pd.DataFrame(rows)


def make_products() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "product": PRODUCTS,
            "category": ["Hardware", "Hardware", "Hardware", "Hardware", "Software"],
            "launch_year": [2018, 2020, 2022, 2021, 2019],
            "margin_pct": [45, 55, 60, 50, 72],
        }
    )


def main() -> None:
    sales = make_sales(2000)
    assert len(sales) == 2000
    (ROOT / "sales.csv").write_text(sales.to_csv(index=False), encoding="utf-8")
    (ROOT / "customers.csv").write_text(make_customers().to_csv(index=False), encoding="utf-8")
    (ROOT / "products.csv").write_text(make_products().to_csv(index=False), encoding="utf-8")
    print(f"Wrote sales.csv ({len(sales)} rows), customers.csv, products.csv to {ROOT}")


if __name__ == "__main__":
    main()
