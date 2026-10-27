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

For a one-off import, use **Try it out** on the API docs page while signed in.
Import scripts are planned; they'll do a dry run unless given `--apply`.

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

- `source` says who or what is importing. It's recorded in the audit trail,
  and each new record's creator is shown as `import: <source>`.
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
