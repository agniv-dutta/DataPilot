# DataPilot — Audit Report

**Date:** 2026-10-10 → 2026-10-11 · **Method:** every claim below was verified by running the code (live FastAPI
server on :8020, real `sample_data` CSVs, direct sandbox calls), not inferred from file names.
**Scope of this document:** summary only — probe transcripts are not reproduced.

## 1. Verdicts

| # | Area | Verdict | Evidence |
|---|------|---------|----------|
| A | Repo structure & conventions | **PASS** | `backend/{api,services,core}` layering holds (routes thin, no business logic); LLM only via `core/llm.py`; pydantic models for every request/response; frontend `src/{api,components,hooks}`; **zero** `: any` in TS |
| B | Six example questions | **PASS (after P0-1 fix)** | all 6 correct and grounded; #6 was deterministic-broken before the fix (§2, §5) |
| C | Upload & validation handling | **PASS** | unknown session 404; `.txt`→415; empty file 422; duplicate columns auto-renamed `a.1`; latin-1 accents decoded; `;` delimiter detected; 25.9MB→413 "limit is 25MB"; empty/missing chat message 422 with field details |
| D | Sandbox safety | **PASS** | all 20 SQL attack probes and all 16 pandas attack probes blocked; 10s timeouts fire; 10,000-row cap + `truncated` flag fire; legit SQL/pandas work |
| E | Packaging, CI, secrets | **IMPLEMENTED; runtime unverified** | Compose configuration validates (`docker compose config --quiet` exit 0); Docker Engine is unavailable on this machine, so image build and endpoint curls could not run; CI includes backend checks and frontend build; `.env` gitignored, no key material in git |
| F | UI & branding | **PASS** | forbidden colors clean — design pass §8 removed the last 6 code hits; 40+ components; routes `/`, `/styleguide`, workspace |
| G | Deliverables | **PASS** | README includes setup, complete env reference, API table, questions and placeholders; Makefile targets resolve (`help`…`clean`, incl. `up`/`eval`); samples are joinable and served from `frontend/public/samples`; `docs/architecture.md` present |

## 2. Example questions (section B)

All six run against `sample_data/{sales,customers,products}.csv` via `POST /chat/sync`.

| # | Question | Result |
|---|----------|--------|
| 1 | Which region generated the highest revenue? | North $40,463,607 — matches pandas ground truth (4.4s) |
| 2 | Show monthly sales trends. | Jan→Mar decline via `DATE_TRUNC`, correct figures |
| 3 | Which products are underperforming? | Gadget Mini (lowest revenue) + Gadget (lowest margin) |
| 4 | What are the top five customers? | C1031, C1028, C1018, C1012, C1072 — **exact match** to ground truth (63.9s under rate limit) |
| 5 | Generate SQL for this analysis. | SQL returned in answer body and `sql` field |
| 6 | Detect anomalies in the dataset. | **Was BROKEN** → **now PASS**: sales.csv answers "123 rows (6.2%) of the 2,000-row dataset flagged by z-score", `flagged_count=123` (matches pandas ground truth). Before the fix this question returned HTTP 200 with `"The agent produced no answer."` every time. See §5 |

## 3. Defects

### P0-1 — Tool results were unbounded → Groq HTTP 413 · **FIXED**

*Status: fixed; evidence in §5.*

- `memory_token_budget: int = 8000` (`config.py`) was enforced **only on prior conversation
  history** (`AnalystAgent._trim`). Tool results appended inside the agent loop were never
  bounded.
- Groq's free tier rejects **any single request over 8,000 tokens** with `HTTP 413
  rate_limit_exceeded/tokens` (message: `Limit 8000, Requested N`). This is a per-request
  ceiling — retrying cannot help.
- Concretely: `detect_anomalies` on the 2,000-row `sales.csv` flagged 56 rows and injected
  ~23KB of JSON into the next LLM request → 413 → the agent loop aborted with an `error`
  event → `/chat/sync` returned HTTP 200 and `"The agent produced no answer."`
  Reproduced deterministically (small `products.csv` worked; `sales.csv` failed every run).
- Latent worse case: `run_sql`/`run_pandas` injected up to **10,000 rows (~929KB)** verbatim.
- **Fix (three layers, all in the agent loop):**
  1. **Per-tool row cap** — `llm_result_rows: int = 50`: `_bounded_payload()` rewrites the
     LLM-facing copy of a `run_sql`/`run_pandas`/`detect_anomalies` result, keeping the true
     totals (`flagged_count`, `truncated`) visible.
  2. **Per-message character cap** — `tool_result_budget_chars: int = 6_000`:
     `_clip_tool_content()` wraps the overflow in a `truncated_for_context` envelope and
     shrinks until the *whole message* fits the cap.
  3. **Whole-request budget** — `_bound_tool_traffic()` runs before every `complete()` call
     and estimates JSON traffic at ~3 chars/token (a `len//4` estimate was what let the
     original request slip past 8,000). Older tool messages are replaced in place with
     `TOOL_RESULT_DROPPED`; the **newest** tool result is never touched, and no message is
     ever removed, because an assistant message carrying `tool_calls` must be followed by its
     tool message (Groq rejects a dangling `tool_calls`).
  - The UI-facing anomaly event still carries the full report; only the LLM copy is bounded.

### P1-2 — `/chat/sync` swallows agent errors · **FIXED (outside this change)**

Not touched by the P0 work. Implemented separately: `run_final` now retains agent `error`
events and raises `AgentError` if no final answer was produced, so the API returns a non-200
JSON error with `error.code`, `message`, and `details.upstream_code` instead of a success
response. Regression test: `tests/test_agent.py::test_chat_sync_surfaces_agent_error`.

### P2 — not touched

| Item | Detail |
|------|--------|
| Crude token estimate in `_trim` | `len(content)//4`; drops whole messages instead of shrinking one oversized message (the new tool-traffic estimator in `_bound_tool_traffic` uses `//3`) |
| `run_pandas` overhead | ~2.1s per call (multiprocessing `spawn` on Windows) → ~6s floor over 3 rounds |
| SPA deep-link fallback | `/app` refresh needs a rewrite rule on a static host; not documented |
| `duckdb_secrets()` | readable by generated SQL (returns 0 rows — no secrets registered) |

### P3 — not touched

| Item | Detail |
|------|--------|
| README env table | **FIXED separately** — documents the complete backend settings table |
| Landing page | **FIXED in §8** — now all 9 content sections, lazy-loaded |

## 4. Sandbox safety (section D) — PASS

**SQL blocked (all `SandboxError`):** `DROP`, `DELETE`, `INSERT`, `UPDATE`, `CREATE`,
`ALTER`, multi-statement, `COPY … TO`, `ATTACH`, `INSTALL`, `LOAD`, `PRAGMA`, `SET`,
`read_csv_auto`, `read_text`. **Timed out at 10s:** unbounded `range()` scan. **Capped:**
200,000-row query → 10,000 rows + `truncated: true`. **Allowed:** plain `SELECT`, window
functions, aggregates.

**Pandas blocked (AST, "Code rejected"):** `import os`, `__import__`, `os.system`,
`subprocess`, `open` (read/write), `eval`, `exec`, `__class__`, `__globals__`, `__dict__`,
`os.environ`, external `pd.read_csv`, `urllib`. **Timed out at 10s:** `while True: pass`.
**Allowed:** `groupby`, boolean filters, `pd.merge` (~2.1s each).

## 5. Evidence for the P0-1 fix

**Tests (written first, red → green)** — `backend/tests/test_context_budget.py`, 5 tests:

| Test | Proves |
|------|--------|
| `test_settings_expose_the_budget_knobs` | `tool_result_budget_chars` / `llm_result_rows` exist |
| `test_run_sql_result_is_bounded_before_it_reaches_the_llm` | a 5,000-row `SELECT *` arrives at the model ≤ 6,000 chars and the request ≤ `memory_token_budget` |
| `test_detect_anomalies_payload_is_clipped_but_ui_keeps_the_full_report` | LLM copy row-capped with `truncated_for_context`; UI event still carries all 60 flagged rows and `flagged_count` |
| `test_older_tool_results_shrink_while_the_newest_is_kept` | 4 rounds → older tool messages become `TOOL_RESULT_DROPPED`, newest keeps real data, every `tool_call_id` keeps its paired tool message, budget respected |
| `test_clip_tool_content_marks_truncation` | clip is marked and the *whole* message fits the cap (not just the snippet) |

Before the fix all 5 failed (`AttributeError: 'Settings' object has no attribute
'tool_result_budget_chars'`, `ImportError: cannot import name '_clip_tool_content'`).
After: **5 passed in 0.93s**.

**Live re-run of the exact failing scenario** (fresh server on :8020, `POST /chat/sync`,
`"Detect anomalies in the dataset."`):

| Dataset | Before | After |
|---------|--------|-------|
| `products.csv` (5 rows) | 200, real answer | 200, real answer (`iterations=4`) |
| `sales.csv` (2,000 rows) | 200, `"The agent produced no answer."`, `iterations=0`, server log `HTTP/1.1 413 Payload Too Large` | **200, real answer, `iterations=3`**: "123 rows (6.2%) of the 2,000-row sales dataset were flagged as anomalous by a z-score analysis", `flagged_count=123` — matches pandas ground truth |

## 6. Test & lint status

| Check | Result |
|-------|--------|
| Backend tests | **93 passed, 0 failed, 0 errors, 0 skipped** (12.8s; JUnit `tests="93" failures="0"`) |
| Coverage | **81%** total (was 79% before the new tests) |
| `ruff check .` | All checks passed |
| `mypy app` | Success: no issues found in 19 source files |
| Frontend | `npm run build` and `npm run lint` pass |
| CI | `.github/workflows/ci.yml` — backend job (ruff, mypy, pytest) + frontend job (eslint, build) |

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

## 8. Design pass — Iris & Ember directive (2026-10-11)

Six-item priority list, executed in order. Frontend served by vite :5173, FastAPI :8000;
screenshots at 1440×900 and 390×844 in light and dark, kept under `%TEMP%\opencode\shots\item1..6`
(harnesses: `shot.mjs`, `drive.mjs`, `act.mjs`, `seed.mjs`, `grep_colors.py`).

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Forbidden colors removed | **DONE** | Before: 6 code hits (`index.css` pure `#fff`/`#000`, `tokens.css` teal/cyan/gold references). After: 0 via `grep_colors.py --ref HEAD`; remaining matches are comments only. `leaf` reserved for checkmarks; anomaly=ember, error=berry |
| 2 | App bugs | **DONE** | Auto session with retry/auto-create (`useSession.ts`: validate stored id, keep on network outage, replace on 4xx); composer idle placeholder/hints + Stop while streaming (`InputBox.tsx`); Inspector loading skeleton, empty, and error states (`Inspector.tsx`); TopBar bottom hairline removed |
| 3 | Landing 9-section spec + code-split | **DONE** | `pages/Landing.tsx` implements all 9 sections; `App.tsx` lazy-loads `Landing`/`Styleguide` behind `Suspense` (build shows split chunks). Screenshots reviewed light+dark, 1440+390 — no unpolish |
| 4 | Component library gaps + `/styleguide` | **DONE** | Added Toast section (incl. Error+Retry), Avatars & icons grid, SuggestionChips, Datasets card/upload/preview, live `ChartRenderer` demo, and a single-part `FinalAnswerView` demo. Theme-flip fix: fixed `--code-bg-rgb/--code-fg-rgb/--scrim-rgb` tokens so code slabs, tooltips, and scrims stop inverting in dark mode |
| 5 | Message UI | **DONE** | Tabs render only when the final answer has ≥2 parts (`FinalAnswerView`; single SQL part renders bare — styleguide demo + in-app runs); chart toolbar with data-table toggle, CSV and PNG export, `y_label` subtitle (`ChartRenderer.tsx`); sortable (`aria-sort`), paginated tables with export (`ResultTable.tsx`); anomaly cards show the flagged value against its expected range with basis badge (`AnomalyDetail` in `schemas.py`, populated by `_tool_detect_anomalies`, `RangeStrip` in `AnomalyList.tsx`); follow-up chips after every answer. Unpolish found by screenshot review and fixed: auto-follow pin (programmatic scroll used to unpin via its own scroll events — now `scrollend`-gated, "↓ Latest" no longer overlaps chips), float formatting (`40463607.39000004` → `40,463,607.39`), clipped y-axis ticks (now compact `15M/30M`) |
| 6 | States | **DONE** | Layout-matching skeletons (Inspector cards, sidebar dataset cards); error toasts with Retry actions (stream errors, dataset list, remove, sample load, upload) via `useToast` action support; `BackendDown` full-screen card ("Can't reach the backend", Retry, uvicorn hint) while the workspace stays mounted; themed 404 page ("This cell is empty") for any route outside `/`, `/app`, `/styleguide` |

Regression evidence after the pass: frontend `npm run build` + `npm run lint` clean; backend
`python -m pytest` 93 passed, `ruff check .` and `mypy app` clean (anomaly-details change covered
by extended `test_agent.py` assertions on `details` column/basis/value band).
