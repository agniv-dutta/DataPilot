# Project: AI Data Analyst

Users upload CSVs and chat with their data.

## Structure (monorepo)

- `/backend` FastAPI, Python 3.11, pandas, DuckDB, pydantic v2, pytest
- `/frontend` React 18 + Vite + TypeScript + Tailwind + Recharts
- `/sample_data`, `/scripts` (dev runner), `Makefile`, `README.md`

## Rules

- Backend and frontend are independent. Communicate only via REST + SSE.
- Backend layers: `api/` (routes) -> `services/` (logic) -> `core/` (config, llm, sandbox). No business logic in routes.
- All LLM calls go through `core/llm.py` behind a provider interface (Anthropic default, OpenAI swappable). Keys from env only.
- LLM-generated SQL/Pandas must NEVER run unsandboxed (read-only DuckDB, AST-validated pandas, timeouts, row limits).
- Type hints everywhere, pydantic models for every request/response, structured logging, custom exceptions mapped to clean HTTP errors.
- Write pytest tests for services. Keep functions small.
- Frontend: strict TS, no `any`, API calls in `/src/api`, components in `/src/components`, hooks in `/src/hooks`.

## Commands

- Backend tests: `cd backend && python -m pytest`
- Backend lint: `cd backend && ruff check . && mypy app`
- Frontend build: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`
- Full stack dev: `node scripts/dev.mjs` (backend :8000 + frontend :5173)

Run the tests and fix failures before moving on.
