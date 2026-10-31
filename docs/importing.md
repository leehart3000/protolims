# Importing records

How to bring a study's subjects, samples, assays and data files into ProtoLIMS
in one go, safely and repeatably. The full list of fields is on the API docs
page (`/api/docs`), under **import**.

## In short

- One request imports into **one study**, which must already exist. An import
  never creates projects or studies.
- **Do a dry run first.** `dry_run` must always be given. With `true`,
  everything is checked and the reply says what would happen, but nothing is
  saved.
- **All or nothing.** If anything is wrong, nothing is saved, and the reply
  lists every problem found.
- **Existing records are never changed.** An import only adds records and
  links. If a record already exists but differs from the import, it's left as
  it is, and the reply lists the differences for you to review and correct by
  hand.
- **Safe to repeat.** Running the same import twice changes nothing the second
  time.

## Where to send it

```text
POST /api/v1/projects/{project_code}/studies/{study_code}/import
```

Importing needs the **editor** role on the study (or admin, or site administrator),
as for changing it on the website. Imported records are recorded as created by
you.

For a one-off import, use **Try it out** on the API docs page while signed in.
For a real dataset, use an import script (below), with a personal API token.

## Personal API tokens

A script signs in as you with a personal API token, sent with each request as
`Authorization: Bearer plt_…`. It can do exactly what you can do, no more.

- **Make one** on your profile page (click your name, top right): say what it's
  for and how long it lasts (at most a year). It's shown **once**, so copy it
  straight away.
- **Each site has its own tokens.** A token made on staging works only on
  staging.
- **Keep it secret,** like a password: never in a file in the repository, an
  email or a chat. Put it straight into a password manager or Secret Manager
  (below).
- **Revoke it** on your profile page when it's no longer needed, or if it might
  have been seen by anyone else. Tokens can only be made and revoked on the
  website, never with a token.
- Your profile shows when each token was last used (to within an hour), and
  making and revoking tokens are in your list of changes.

## Importing from the GDC

`backend/scripts/import_gdc.py` imports open-access cases from a GDC project
(TCGA-BRCA unless `--project` says otherwise), with several kinds of data for
each. It works in steps, so you can read exactly what will be imported before
anything is sent.

**0. Survey** (optional): list a project's cases by primary site and disease
type, and its open-access files by data type and workflow, to see what's there:

```sh
uv run --directory backend python scripts/import_gdc.py survey --project TCGA-BRCA
```

**Only some cases:** a project such as CPTAC-3 covers several cancers.
`--primary-site` and `--disease-type` (on `survey` and `fetch`) take only the
cases with that value, as the survey spells it, for example
`--primary-site "Bronchus and lung"`. Both together take cases matching both.
The import's `source` names the choice.

**1. Fetch** from the GDC's public API (no account needed) and save the import
request to a file:

```sh
uv run --directory backend python scripts/import_gdc.py fetch --project TCGA-BRCA
```

- **Which kinds of data:** `--kinds` chooses among these, separated by commas
  (all four by default). Each becomes one assay in the study:

  | Kind | GDC data type | Assay | Made from |
  | --- | --- | --- | --- |
  | `rna` | Gene Expression Quantification | RNA-Seq gene counts | RNA aliquot |
  | `mirna` | miRNA Expression Quantification | miRNA-Seq expression | RNA aliquot |
  | `methylation` | Methylation Beta Value | DNA methylation beta values | DNA aliquot |
  | `protein` | Protein Expression Quantification | RPPA protein expression | portion (protein lysate) |

- **Which cases:** the first ones by GDC name that have open files of **every**
  chosen kind; `--cases 50` chooses how many (the default is 10). It prints how
  many files and cases each kind has.
- **Where it's saved:** `protolims_resources/imports/gdc-<project>.json` (such
  as `gdc-tcga-brca.json`), a folder **beside** the repository, never in it, so
  no data can be committed by accident. `--out FILE` saves somewhere else.
  Paths are relative to `backend`.
- **What's kept:** each patient keeps only sex at birth, age at diagnosis in
  whole years, and the primary diagnosis. Each tissue sample has, as children,
  the aliquots (or portions) the files were made from; the GDC's analyte level
  is skipped. Each file records its workflow and MD5 checksum, and links to the
  GDC's download address; the data itself stays at the GDC.
- **Size:** it prints how many records and links the request holds. An import
  takes at most 5,000, which is roughly 150 to 200 cases with all four kinds.
  For more, fetch a few kinds at a time into separate files (`--kinds rna,mirna
  --out …`) and send each; cases and samples already imported are matched, not
  repeated.
- **Warnings:** if a file isn't linked to an aliquot or portion, it says so, and
  the file is imported without samples.

**2. Send** the file to ProtoLIMS. The study must already exist.

```sh
uv run --directory backend python scripts/import_gdc.py send --study RNASEQ
uv run --directory backend python scripts/import_gdc.py send --study RNASEQ --apply
```

- Without `--apply`, it's a dry run: nothing is saved.
- `--project CODE` is the ProtoLIMS project (TCGA-BRCA by default), and also
  chooses the default file, `gdc-<project>.json`.
- `--file FILE` sends a file other than the default.
- If ProtoLIMS refuses the token (401), you aren't an editor of the study
  (403), or the site is read-only (423, see `docs/read-only.md`), the script
  says so, and nothing is imported. A dry run works even while the site is
  read-only.

Where it sends to, and where your token comes from:

- `--target local` (the default) sends to `http://127.0.0.1:8000`. The token
  comes from the `PROTOLIMS_API_TOKEN` environment variable. Make a token on
  your local site, copy it, then, in the terminal you'll run the script from:

  ```sh
  export PROTOLIMS_API_TOKEN="$(pbpaste)"
  pbcopy < /dev/null
  ```

  It lasts until that terminal is closed.

- `--target staging` sends to `https://staging.protolims.org`. The token comes
  from Secret Manager, as `import-api-token-staging`, read with your own
  `gcloud` login, so it's never written to a file. Make a token on the staging
  site, copy it, then store it (the first time):

  ```sh
  pbpaste | gcloud secrets create import-api-token-staging --data-file=- --replication-policy=user-managed --locations=europe-west2 --project=protolims
  pbcopy < /dev/null
  ```

  or, to replace it with a new token later:

  ```sh
  pbpaste | gcloud secrets versions add import-api-token-staging --data-file=- --project=protolims
  pbcopy < /dev/null
  ```

  Staging is also behind Cloudflare Access, so the script reads the "ProtoLIMS
  imports" service token from Secret Manager too
  (`import-cf-access-client-id` and `import-cf-access-client-secret`).

- `--target production` sends to `https://protolims.org`, with the token in
  `import-api-token-production`, stored the same way. Until launch, production
  is behind Cloudflare Access, and the import service token isn't allowed
  there yet, so this stops with "Cloudflare Access turned the request away".

## What a request looks like

```json
{
  "source": "GDC TCGA-BRCA, 27 October 2026",
  "dry_run": true,
  "subjects": [
    {
      "name": "P-01",
      "external_id": "case-1",
      "subject_type": "patient",
      "species": "Homo sapiens"
    }
  ],
  "samples": [
    {"name": "T-01", "external_id": "sample-1", "subject": "P-01", "material_type": "tissue"},
    {"name": "T-01-RNA", "external_id": "aliquot-1", "parent": "T-01", "material_type": "RNA"}
  ],
  "assays": [
    {
      "name": "Run-1",
      "external_id": "run-1",
      "measurement_type": "transcription profiling",
      "technology_type": "nucleotide sequencing",
      "samples": [{"sample": "T-01-RNA", "label": "lane 1"}]
    }
  ],
  "data_files": [
    {
      "name": "reads.fastq",
      "external_id": "file-1",
      "uri": "https://example.org/reads.fastq",
      "level": "raw",
      "format": "FASTQ",
      "assay": "Run-1",
      "samples": [{"sample": "T-01-RNA", "label": "lane 1"}]
    },
    {
      "name": "counts.tsv",
      "uri": "https://example.org/counts.tsv",
      "level": "processed",
      "format": "TSV",
      "samples": [{"sample": "T-01-RNA", "label": "column 1"}],
      "inputs": ["https://example.org/reads.fastq"]
    }
  ]
}
```

- `source` says where the data came from. Each new record is created by you
  (the person whose token or session sent it), and the `source` is kept in
  each new record's audit trail entry.
- **References use names**, not IDs: a sample's `subject` and `parent`, and the
  `samples` of an assay or file. A file's `assay` is a name too, but its
  `inputs` (the files it was made from) are **locations**, because file names
  often repeat.
- A reference can point to a record in the same request or one already in the
  study, and records can be listed in any order.
- Times must include a time zone, for example `"2026-10-01T09:00:00Z"`.
- At most **5,000 records and links** per request. Send bigger studies in
  batches, for example subjects and samples first, then assays and files.

## How records are matched

Each record is matched to one already in the study:

1. by its **external ID** (its ID in the source), if it has one;
2. otherwise by its **name**, or for a data file, by its **location** (`uri`).

A match that could be wrong is refused, not guessed:

- the external ID belongs to one record, but the name (or location) belongs to
  another;
- the name (or location) is used by a record with a different external ID;
- two records in the import match the same existing record.

Always send external IDs when the source has them. They keep matching right
even if a name is corrected later.

## Links

An assay's samples, a file's samples and a file's inputs are all handled the
same way:

- a missing link is **added**, even to an existing assay or file;
- an existing link with a different label is **reported**, not changed;
- links the import doesn't mention are **left alone**. An import never removes
  anything.

A sample can't be derived from itself, and nor can a file, directly or through
others. This is checked across existing and imported records together.

## What the reply looks like

For the request above, into an empty study:

```json
{
  "dry_run": true,
  "saved": false,
  "subjects": {"created": 1, "unchanged": 0, "different": 0},
  "samples": {"created": 2, "unchanged": 0, "different": 0},
  "assays": {"created": 1, "unchanged": 0, "different": 0},
  "assay_samples": {"created": 1, "unchanged": 0, "different": 0},
  "data_files": {"created": 2, "unchanged": 0, "different": 0},
  "data_file_samples": {"created": 2, "unchanged": 0, "different": 0},
  "data_file_inputs": {"created": 1, "unchanged": 0, "different": 0},
  "differences": []
}
```

`saved: false` confirms that nothing was saved. Run it again with
`"dry_run": false` to save it; the counts will be the same, with
`"saved": true`.

If the source later says the counts file is a CSV, importing again reports it
but doesn't change it:

```json
"data_files": {"created": 0, "unchanged": 1, "different": 1},
"differences": [
  {
    "kind": "data file",
    "name": "https://example.org/counts.tsv",
    "id": "…",
    "fields": {"format": {"recorded": "TSV", "import": "CSV"}}
  }
]
```

Only the fields the import sends are compared. A field left out of the import
is never reported as different.

## When something is wrong

Nothing is saved, and the reply (status 422) lists every problem:

```json
{
  "detail": {
    "message": "Nothing was imported, because of these problems.",
    "problems": [
      "sample 'T-01-RNA': there's no sample called 'T-1' in the study or the import",
      "data file 'https://example.org/counts.tsv': there's no data file at 'https://example.org/read.fastq' in the study or the import"
    ]
  }
}
```

Fix the problems and do another dry run. A request with a missing or wrongly
typed field (such as no `dry_run`) is refused in the same way, with FastAPI's
usual description of the problem.

## Good habits

- Dry run, read the reply, then save.
- Keep the request you sent, for example in the import script's output folder,
  so you know exactly what was imported.
- Review any `differences`. If ProtoLIMS is wrong, correct it on the website. If
  the source is wrong, leave ProtoLIMS as it is.
- Use open-access data only (see `docs/data-model.md`).
