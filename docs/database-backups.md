# Database backups

How the production database is backed up, and how to restore it.

## What happens every night

The GitHub Actions workflow `database-backup.yml` runs at 02:17 UTC (and can be
run by hand from the Actions page). It:

1. Signs in to Google Cloud as `protolims-backup`, with no stored key.
2. Reads the connection string `production-database-url-backup` from Secret
   Manager. It connects as `protolims_backup_reader`, a database user that can
   only read.
3. Dumps the database with `pg_dump --format=custom` (Postgres 18).
4. Uploads it to `gs://protolims-production-db-backups` as
   `production-YYYYMMDD-HHMMSS.dump` (UTC).
5. Downloads the uploaded copy, restores it into a temporary Postgres in the
   runner, counts the rows in every table, and runs `alembic upgrade head` on it.

If any step fails, GitHub emails you. The row counts are in the "Read every
table" step's log.

## Where backups are kept

- Bucket: `gs://protolims-production-db-backups` (London, `europe-west2`).
- Each backup is deleted after 30 days. A deleted file can still be recovered
  for 7 days (soft delete).
- `protolims-backup` can add and read files, but not delete or replace them.

## Two ways to go back

| | Neon point-in-time restore | Restore from a nightly backup |
| --- | --- | --- |
| How far back | the last 6 hours (free plan) | the last 30 days, one copy a night |
| Loses | nothing before the chosen moment | everything since that night's backup |
| Use when | a mistake was made in the last few hours | anything older, or Neon itself is the problem |

For a recent mistake, use Neon's restore in the console (on the production
branch's backup and restore page). The rest of this guide covers restoring a
nightly backup.

## Restoring a nightly backup into production

Commands run on your Mac. They use Docker for the Postgres 18 tools, and gcloud
signed in as the project owner.

### 1. Choose and download a backup

```sh
gcloud storage ls -l gs://protolims-production-db-backups/
```

```sh
mkdir -p ~/protolims-restore
gcloud storage cp gs://protolims-production-db-backups/production-YYYYMMDD-HHMMSS.dump ~/protolims-restore/
```

Look at what it contains:

```sh
docker run --rm -v ~/protolims-restore:/work:ro postgres:18-alpine pg_restore --list /work/production-YYYYMMDD-HHMMSS.dump
```

### 2. Keep a copy of the database as it is now

In the Neon console, create a branch from the production branch, named for
example `before-restore-YYYYMMDD`. This is instant and free, and lets you go
back if the restore goes wrong. Delete the branch once you are happy.

### 3. Restore

This replaces every table in the backup with the backup's contents. It connects
as `protolims_owner` (the migrations' connection string), so the restored tables
keep the right owner and the backup user keeps its read access.

```sh
docker run --rm -v ~/protolims-restore:/work:ro postgres:18-alpine pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error --dbname="$(gcloud secrets versions access latest --secret=production-database-url-direct --project=protolims)" /work/production-YYYYMMDD-HHMMSS.dump
```

- `--single-transaction` means it either all works or nothing changes.
- `--clean --if-exists` removes each table before recreating it. A table that
  was added after the backup was taken is left alone; step 4 deals with it.

### 4. Bring the database up to the current code

If migrations were released after the backup was taken, run them:

```sh
gcloud run jobs execute migrate-production --region=europe-west2 --wait
```

This runs `alembic upgrade head` with the currently deployed version. It does
nothing if the database is already up to date.

### 5. Check

- Open `https://protolims.org` and look at a few projects and samples.
- Count rows:

```sh
docker run --rm postgres:18-alpine psql "$(gcloud secrets versions access latest --secret=production-database-url-backup --project=protolims)" -c "SELECT version_num FROM alembic_version" -c "SELECT count(*) FROM project" -c "SELECT count(*) FROM sample"
```

### 6. Tidy up

```sh
rm -r ~/protolims-restore
```

Delete the `before-restore-…` branch in the Neon console once you are sure.

## Restoring somewhere else

To restore into another Postgres 18 database (for example, to look at old data
without touching production), add `--no-privileges` and leave out `--clean`:
the other database will not have the production users.

```sh
docker run --rm -v ~/protolims-restore:/work:ro postgres:18-alpine pg_restore --no-owner --no-privileges --single-transaction --exit-on-error --dbname="postgresql://USER:PASSWORD@HOST/DATABASE" /work/production-YYYYMMDD-HHMMSS.dump
```

## If the nightly workflow stops

GitHub turns off scheduled workflows in a public repository after 60 days with
no commits. It emails a warning first. Turn it back on from the Actions page
(Database backup → Enable workflow).
