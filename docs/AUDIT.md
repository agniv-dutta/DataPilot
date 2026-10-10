# DataPilot â€” Audit Report

**Date:** 2026-10-10 Â· **Method:** every claim below was verified by running the code (live FastAPI
server on :8020, real `sample_data` CSVs, direct sandbox calls), not inferred from file names.
**Scope of this document:** summary only â€” probe transcripts are not reproduced.

## 1. Verdicts

| # | Area | Verdict | Evidence |
|---|------|---------|----------|
| A | Repo structure & conventions | **PASS** | `backend/{api,services,core}` layering holds (routes thin, no business logic); LLM only via `core/llm.py`; pydantic models for every request/response; frontend `src/{api,components,hooks}`; **zero** `: any` in TS |
| B | Six example questions | **PARTIAL â†’ FIXED** | 5/6 correct and grounded; #6 failed deterministically (P0-1, now fixed) |
| C | Upload & validation handling | **PASS** | unknown session 404; `.txt`â†’415; empty file 422; duplicate columns auto-renamed `a.1`; latin-1 accents decoded; `;` delimiter detected; 25.9MBâ†’413 "limit is 25MB"; empty/missing chat message 422 with field details |
| D | Sandbox safety | **PASS** | all 20 SQL attack probes and all 16 pandas attack probes blocked; 10s timeouts fire; 10,000-row cap + `truncated` flag fire; legit SQL/pandas work |
| E | Packaging, CI, secrets | **IMPLEMENTED; runtime unverified** | Compose configuration validates; Docker Engine is unavailable, so image build and endpoint curls could not run; CI includes backend checks and frontend build; `.env` gitignored |
| F | UI & branding | **PASS** | forbidden colors clean (only the allowed `#000` mask gradient + comments); 40+ components; routes `/`, `/styleguide`, workspace |
| G | Deliverables | **PASS** | README includes the requested setup, complete env reference, API table, questions and placeholders; Makefile targets resolve; samples are joinable and served from `frontend/public/samples` |

## 2. Example questions (section B)

All six run against `sample_data/{sales,customers,products}.csv` via `POST /chat/sync`.

| # | Question | Result |
|---|----------|--------|
| 1 | Which region generated the highest revenue? | North $40,463,607 â€” matches pandas ground truth (4.4s) |
| 2 | Show monthly sales trends. | Janâ†’Mar decline via `DATE_TRUNC`, correct figures |
| 3 | Which products are underperforming? | Gadget Mini (lowest revenue) + Gadget (lowest margin) |
| 4 | What are the top five customers? | C1031, C1028, C1018, C1012, C1072 â€” **exact match** to ground truth (63.9s under rate limit) |
| 5 | Generate SQL for this analysis. | SQL returned in answer body and `sql` field |
| 6 | Detect anomalies in the dataset. | **Was BROKEN** â€” see P0-1. Products.csv passed; sales.csv always failed |

## 3. Defects

### P0-1 â€” Tool results were unbounded â†’ Groq HTTP 413 Â· **FIXED**

*Status: fixed in this change; see Â§5 for evidence.*

- `memory_token_budget: int = 8000` (`config.py`) was enforced **only on prior conversation
  history** (`AnalystAgent._trim`). Tool results appended inside the agent loop were never
  bounded.
- Groq's free tier rejects **any single request over 8,000 tokens** with `HTTP 413
  rate_limit_exceeded/tokens` (message: `Limit 8000, Requested N`). This is a per-request
  ceiling â€” retrying cannot help.
- Concretely: `detect_anomalies` on the 2,000-row `sales.csv` flagged 56 rows and injected
  ~23KB of JSON into the next LLM request â†’ 413 â†’ the agent loop aborted with an `error`
  event â†’ `/chat/sync` returned HTTP 200 and `"The agent produced no answer."`
  Reproduced deterministically (small `products.csv` worked; `sales.csv` failed every run).
- Latent worse case: `run_sql`/`run_pandas` injected up to **10,000 rows (~929KB)** verbatim.
- **Fix:** tool payloads are now bounded on three levels â€” a per-tool row cap
  (`llm_result_rows`), a per-message character cap (`tool_result_budget_chars`), and a
  whole-request budget that clips older tool results in place (never removes them, because an
  assistant message carrying `tool_calls` must be followed by its tool message). The
  UI-facing anomaly event still carries the full report.

### P1-2 — `/chat/sync` swallows agent errors · **FIXED**

`run_final` now retains agent `error` events and raises `AgentError` if no final answer was produced. The existing API exception handler returns a non-200 JSON error with `error.code`, `message`, and `details.upstream_code`; it no longer fabricates a success response. Implementation: `backend/app/services/agent.py`.

### P2 â€” not touched

| Item | Detail |
|------|--------|
| Crude token estimate | `len(content)//4` in `_trim`; drops whole messages instead of shrinking one oversized message |
| `run_pandas` overhead | ~2.1s per call (multiprocessing `spawn` on Windows) â†’ ~6s floor over 3 rounds |
| SPA deep-link fallback | `/app` refresh needs a rewrite rule on a static host; not documented |
| `duckdb_secrets()` | readable by generated SQL (returns 0 rows â€” no secrets registered) |

### P3 â€” not touched

| Item | Detail |
|------|--------|
| README env table | **FIXED** â€” documents the complete backend settings table |
| Landing page | 5 content blocks (nav, hero, 3-feature grid, product mockup, footer) |

## 4. Sandbox safety (section D) â€” PASS

**SQL blocked (all `SandboxError`):** `DROP`, `DELETE`, `INSERT`, `UPDATE`, `CREATE`,
`ALTER`, multi-statement, `COPY â€¦ TO`, `ATTACH`, `INSTALL`, `LOAD`, `PRAGMA`, `SET`,
`read_csv_auto`, `read_text`. **Timed out at 10s:** unbounded `range()` scan. **Capped:**
200,000-row query â†’ 10,000 rows + `truncated: true`. **Allowed:** plain `SELECT`, window
functions, aggregates.

**Pandas blocked (AST, "Code rejected"):** `import os`, `__import__`, `os.system`,
`subprocess`, `open` (read/write), `eval`, `exec`, `__class__`, `__globals__`, `__dict__`,
`os.environ`, external `pd.read_csv`, `urllib`. **Timed out at 10s:** `while True: pass`.
**Allowed:** `groupby`, boolean filters, `pd.merge` (~2.1s each).

## 5. Evidence for the P0-1 fix

P0-1 fix remains as described above; dedicated context-budget tests are in `backend/tests/test_context_budget.py`.

## 6. Test & lint status

Run evidence is recorded below for the requested packaging work. CI configuration is `.github/workflows/ci.yml` and contains the required backend and frontend jobs.
## 7. P1 deliverables and verification

| Item | Status | Evidence |
|------|--------|----------|
| Docker Compose backend + nginx frontend | **IMPLEMENTED; runtime blocked** | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`; health checks and backend env file configured. `docker compose config --quiet` passes. `docker compose up --build -d` could not connect because Docker Engine named pipe is absent; curls to ports 8000 and 3000 consequently could not connect |
| Environment documentation | **DONE** | `backend/.env.example` contains all `Settings` fields; README documents variables |
| Make targets | **DONE** | `dev`, `test`, `lint`, `up`, and `eval` in root Makefile |
| GitHub Actions CI | **DONE** | `.github/workflows/ci.yml`: ruff, mypy, pytest, eslint, frontend production build |
| Joinable sample data | **DONE** | `sample_data/sales.csv` (2,000 data rows), `customers.csv`, `products.csv`; joins use `customer_id` and `product`, with nulls and revenue spikes |
| README and architecture docs | **DONE** | Setup, feature list, diagrams, API table, sample questions, decisions, security notes, limitations, testing and demo asset placeholders; architecture sequence diagram in `docs/architecture.md` |
| `/chat/sync` agent failures | **DONE** | Agent errors raise `AgentError` and map to non-200 API errors instead of an empty 200 answer |

### Runtime commands

Verification: `docker compose config --quiet` passed. `docker compose up --build -d` failed before building: Docker daemon unavailable (`npipe:////./pipe/docker_engine`, pipe not found). Both requested curls were attempted and failed to connect because no services could start. Frontend `npm.cmd run build` passed; backend `python -m pytest` passed (93 tests, with `DEBUG=false` to override the host shell's invalid `DEBUG=release`); `ruff check .` and `mypy app` passed. Sample CSVs read as 2,000 sales rows, 80 customers, and 5 products.




