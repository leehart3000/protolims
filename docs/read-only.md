# The read-only lock

When `PROTOLIMS_READ_ONLY` is `true`, nothing in ProtoLIMS can be changed, by
anyone, until it's turned off again. It's meant for protolims.org once it's
public: its data should only change when you choose to change it.

## What it does

While it's on:

- **Everything can still be read**, and people can sign in and out.
- **Every change is refused** with `423 Locked` and "This site is read-only at
  the moment, so nothing can be changed": records, roles, users, imports and
  making API tokens. That includes site administrators.
- **A few things still work**, because they don't change any data, or protect
  it: signing in and out, revoking your own API tokens (in case one has
  leaked), and an import's dry run.
- **The website shows a lock** marked "Read-only" in the header, and greys out
  every button that would change something, with the reason on hover.

It's a server setting rather than a button on the website, so only someone with
access to the Google Cloud project can lift it: a stolen website session or API
token can't.

## Checking it (read-only)

```sh
gcloud run services describe protolims-api-production --region=europe-west2 --project=protolims --format='yaml(spec.template.spec.containers[0].env)'
```

`PROTOLIMS_READ_ONLY` with `value: 'true'` means it's locked. If it isn't
listed, or is `'false'`, it's unlocked. On the website, the "Read-only" lock in
the header shows the same.

## Locking and unlocking

```sh
gcloud run services update protolims-api-production --region=europe-west2 --project=protolims --update-env-vars=PROTOLIMS_READ_ONLY=true
```

and, to unlock, the same with `PROTOLIMS_READ_ONLY=false`. Each makes a new
Cloud Run revision with the same image, in about a minute; nothing is rebuilt.
For staging, use `protolims-api-staging`.

Deploys use `--update-env-vars`, so they keep the lock as it is. Don't deploy
with `--set-env-vars`, which would replace every setting, and unlock the site.

## For an import

1. Unlock.
2. Import (dry run first, then `--apply`), and check the result.
3. Lock again, and check it's locked.
