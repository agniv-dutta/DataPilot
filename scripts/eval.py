"""Run the README's six example prompts against a live DataPilot API."""

from __future__ import annotations

import os
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = [
    "Which region generated the highest revenue?",
    "Show the monthly revenue trend as a line chart.",
    "Top 5 customers by revenue.",
    "Detect anomalies in revenue.",
    "Join sales with customers and break revenue down by tier.",
    "Which products have the highest margin, and how do they perform?",
]


def main() -> None:
    base_url = os.environ.get("DATAPILOT_API_URL", "http://localhost:8000").rstrip("/")
    with httpx.Client(base_url=base_url, timeout=180) as client:
        response = client.post("/api/sessions", json={"name": "README evaluation"})
        response.raise_for_status()
        session_id = response.json()["session_id"]
        uploads = {
            "files": [
                ("files", (name, (ROOT / "sample_data" / name).open("rb"), "text/csv"))
                for name in ("sales.csv", "customers.csv", "products.csv")
            ]
        }
        response = client.post(f"/api/sessions/{session_id}/files", files=uploads["files"])
        response.raise_for_status()
        for index, question in enumerate(QUESTIONS, 1):
            response = client.post(
                f"/api/sessions/{session_id}/chat/sync", json={"message": question}
            )
            response.raise_for_status()
            answer = response.json()["final"]["answer"]
            print(f"{index}. {question}\n{answer}\n")


if __name__ == "__main__":
    main()
