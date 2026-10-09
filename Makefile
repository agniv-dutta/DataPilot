.PHONY: help install test lint format backend frontend dev frontend-build sample clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend + frontend dependencies
	cd backend && python -m pip install -r requirements.txt
	cd frontend && npm install

test: ## Run backend tests
	cd backend && python -m pytest

lint: ## Lint backend (ruff, mypy) and frontend (eslint)
	cd backend && ruff check . && mypy app
	cd frontend && npm run lint

format: ## Format backend with ruff
	cd backend && ruff format .

backend: ## Run the backend dev server (http://localhost:8000)
	cd backend && python -m uvicorn app.main:app --reload --port 8000

frontend: ## Run the frontend dev server (http://localhost:5173)
	cd frontend && npm run dev

dev: ## Run backend + frontend together (http://localhost:5173)
	node scripts/dev.mjs

frontend-build: ## Production build of the frontend
	cd frontend && npm run build

sample: ## Regenerate the sample CSVs
	cd backend && python scripts/generate_sample_data.py

clean: ## Remove caches and build artifacts
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache
	rm -rf frontend/dist
