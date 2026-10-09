.PHONY: help install test lint format up down logs build sample clean frontend-build frontend-lint

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

frontend-build: ## Production build of the frontend
	cd frontend && npm run build

sample: ## Regenerate the sample CSVs
	cd backend && python scripts/generate_sample_data.py

build: ## Build docker images
	docker compose build

up: ## Run the full stack (http://localhost:3000)
	docker compose up --build

down: ## Stop the stack
	docker compose down

logs: ## Tail stack logs
	docker compose logs -f

clean: ## Remove caches and build artifacts
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache
	rm -rf frontend/dist
