# ProtoLIMS task runner. Run `just` on its own to list the recipes.

uvb := "uv run --directory backend"
web := "pnpm --dir frontend"

# List available recipes
default:
    @just --list

# Start local services (PostgreSQL) in the background
up:
    docker compose up -d

# Stop local services (data is kept)
down:
    docker compose stop

# Run the API locally with auto-reload
run:
    {{uvb}} uvicorn protolims_api.main:app --reload

# Fix lint issues with Ruff
lint:
    {{uvb}} ruff check --fix .

# Format code with Ruff
format:
    {{uvb}} ruff format .

# Type-check with Mypy
typecheck:
    {{uvb}} mypy src tests

# Run the tests; extra arguments go to pytest, e.g. `just test -k studies`
test *args:
    {{uvb}} pytest {{args}}

# Apply migrations to the local database
migrate:
    {{uvb}} alembic upgrade head

# Create a migration from model changes, e.g. `just makemigration "add storage tables"`
makemigration message:
    {{uvb}} alembic revision --autogenerate -m "{{message}}"
    {{uvb}} ruff check --fix migrations
    {{uvb}} ruff format migrations

# Install frontend packages
web-install:
    {{web}} install

# Run the frontend development server
web-dev:
    {{web}} dev

# Lint the frontend with ESLint
web-lint:
    {{web}} lint

# Format the frontend with Prettier
web-format:
    {{web}} format

# Type-check the frontend
web-typecheck:
    {{web}} typecheck

# Run the frontend tests; extra arguments go to Vitest
web-test *args:
    {{web}} test {{args}}

# Build the frontend for production
web-build:
    {{web}} build

# Run every check CI runs, without changing any files
check:
    uv --directory backend lock --check
    {{uvb}} ruff check .
    {{uvb}} ruff format --check .
    {{uvb}} mypy src tests
    {{uvb}} alembic check
    {{uvb}} pytest
    {{web}} install --frozen-lockfile
    {{web}} format:check
    {{web}} lint
    {{web}} typecheck
    {{web}} coverage

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
