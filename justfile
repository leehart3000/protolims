# ProtoLIMS task runner. Run `just` on its own to list the recipes.
# backend-* and web-* recipes do one half; lint, format, typecheck, test and check do both.

uvb := "uv run --directory backend"
web := "pnpm --dir frontend"

# List available recipes
default:
    @just --list

# --- Local services ---

# Start local services (PostgreSQL) in the background
up:
    docker compose up -d

# Stop local services (data is kept)
down:
    docker compose stop

# --- Both halves ---

# Fix lint issues in the backend and frontend
lint: backend-lint web-lint

# Format the backend and frontend
format: backend-format web-format

# Type-check the backend and frontend
typecheck: backend-typecheck web-typecheck

# Run the backend and frontend tests
test: backend-test web-test

# Run every check CI runs, for both backend and frontend
check: backend-check web-check

# --- Backend ---

# Run the API locally with auto-reload
backend-dev:
    {{uvb}} uvicorn protolims_api.main:app --reload

# Fix backend lint issues with Ruff
backend-lint:
    {{uvb}} ruff check --fix .

# Format the backend with Ruff
backend-format:
    {{uvb}} ruff format .

# Type-check the backend with Mypy
backend-typecheck:
    {{uvb}} mypy src tests

# Run the backend tests; extra arguments go to pytest, e.g. `just backend-test -k studies`
backend-test *args:
    {{uvb}} pytest {{args}}

# Run every backend check CI runs, without changing any files
backend-check:
    uv --directory backend lock --check
    {{uvb}} ruff check .
    {{uvb}} ruff format --check .
    {{uvb}} mypy src tests
    {{uvb}} alembic check
    {{uvb}} pytest

# Apply migrations to the local database
migrate:
    {{uvb}} alembic upgrade head

# Create a migration from model changes, e.g. `just makemigration "add storage tables"`
makemigration message:
    {{uvb}} alembic revision --autogenerate -m "{{message}}"
    {{uvb}} ruff check --fix migrations
    {{uvb}} ruff format migrations

# Create an empty migration for changes autogenerate can't detect (e.g. renames)
emptymigration message:
    {{uvb}} alembic revision -m "{{message}}"
    {{uvb}} ruff check --fix migrations
    {{uvb}} ruff format migrations

# --- Frontend ---

# Install frontend packages
web-install:
    {{web}} install

# Run the frontend development server
web-dev:
    {{web}} dev

# Fix frontend lint issues with ESLint
web-lint:
    {{web}} lint --fix

# Format the frontend with Prettier
web-format:
    {{web}} format

# Type-check the frontend
web-typecheck:
    {{web}} typecheck

# Run the frontend tests; extra arguments go to Vitest
web-test *args:
    {{web}} test {{args}}

# Run every frontend check CI runs, without changing any files
web-check:
    {{web}} install --frozen-lockfile
    {{web}} format:check
    {{web}} lint
    {{web}} typecheck
    {{web}} coverage

# Build the frontend for production
web-build:
    {{web}} build

# --- Both: API types, releases ---

# Regenerate frontend/openapi.json and the frontend's API types from the backend code
api-types:
    {{uvb}} python -c "import json; from protolims_api.main import app; print(json.dumps(app.openapi(), indent=2))" > frontend/openapi.json
    {{web}} exec openapi-typescript openapi.json -o src/api/schema.d.ts

# Promote whatever is running on staging to production, e.g. `just release v0.1.0`
release version:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! "{{version}}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Version must look like v1.2.3" >&2
        exit 1
    fi
    image="$(gcloud run services describe protolims-api-staging \
        --project=protolims --region=europe-west2 \
        --format='value(spec.template.spec.containers[0].image)')"
    sha="${image##*:}"
    git fetch origin --quiet
    echo "Tagging ${sha} (currently on staging) as {{version}}"
    git tag -a "{{version}}" "${sha}" -m "Release {{version}}"
    git push origin "{{version}}"
