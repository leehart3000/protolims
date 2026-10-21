# ProtoLIMS task runner. Run `just` on its own to list the recipes.

uvb := "uv run --directory backend"

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

# Run every check CI runs, without changing any files
check:
    uv --directory backend lock --check
    {{uvb}} ruff check .
    {{uvb}} ruff format --check .
    {{uvb}} mypy src tests
    {{uvb}} alembic check
    {{uvb}} pytest
