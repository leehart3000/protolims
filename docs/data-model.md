# Data model

ProtoLIMS uses a generic multi-omics model based on the ISA framework
(Investigation / Study / Assay), so that data from different repositories and
omics types fit the same structure.

## Entities

| ProtoLIMS   | ISA           | TCGA (GDC)                           | PRIDE (SDRF)       | LINCS L1000        |
| ----------- | ------------- | ------------------------------------ | ------------------ | ------------------ |
| Project     | Investigation | Program                              | Dataset (PXD…)     | Dataset (GSE…)     |
| Study       | Study         | Project (e.g. TCGA-BRCA)             | Dataset            | Phase / sub-study  |
| Subject     | Source        | Case                                 | Source name        | Cell line          |
| Sample      | Sample, Extract | Sample, Portion, Analyte, Aliquot  | Sample             | Treated well       |
| Assay       | Assay         | Experiment / read group              | Assay / MS run     | Plate / batch      |
| Data file   | Data file     | File                                 | Raw file / channel | Level 1–5 files    |

## Diagram

```mermaid
erDiagram
    PROJECT ||--o{ STUDY : contains
    STUDY ||--o{ SUBJECT : enrols
    SUBJECT |o--o{ SAMPLE : provides
    SAMPLE |o--o{ SAMPLE : "derived into"
    STUDY ||--o{ ASSAY : includes
    ASSAY ||--o{ ASSAY_SAMPLE : measures
    SAMPLE ||--o{ ASSAY_SAMPLE : "measured in"
    STUDY ||--o{ DATA_FILE : holds
    ASSAY |o--o{ DATA_FILE : produces
    DATA_FILE ||--o{ DATA_FILE_SAMPLE : contains
    SAMPLE ||--o{ DATA_FILE_SAMPLE : "appears in"
    DATA_FILE ||--o{ DATA_FILE_INPUT : "derived from"

    PROJECT {
        uuid id PK
        text code UK
        text name
        text source_repository
        text licence
        text citation
    }
    STUDY {
        uuid id PK
        uuid project_id FK
        text code UK
        text title
        jsonb design_factors
    }
    SUBJECT {
        uuid id PK
        uuid study_id FK
        text external_id
        text subject_type
        text species
        jsonb attributes
    }
    SAMPLE {
        uuid id PK
        text accession UK
        text external_id
        uuid subject_id FK
        uuid parent_sample_id FK
        text material_type
        text status
        jsonb characteristics
        jsonb factor_values
    }
    ASSAY {
        uuid id PK
        uuid study_id FK
        text name
        text external_id
        text measurement_type
        text technology_type
        text platform
        jsonb parameters
    }
    ASSAY_SAMPLE {
        uuid assay_id PK, FK
        uuid sample_id PK, FK
        text label
    }
    DATA_FILE {
        uuid id PK
        uuid study_id FK
        uuid assay_id FK
        text name
        text external_id
        text level
        text format
        text uri UK
        bigint size_bytes
        text sha256
        jsonb summary
    }
    DATA_FILE_SAMPLE {
        uuid data_file_id PK, FK
        uuid sample_id PK, FK
        text label
    }
    DATA_FILE_INPUT {
        uuid data_file_id PK, FK
        uuid input_data_file_id PK, FK
    }
    AUDIT_EVENT {
        uuid id PK
        timestamptz occurred_at
        text actor
        text action
        text entity_type
        uuid entity_id
        jsonb changes
    }
```

All tables also have `created_at`, `updated_at` and `created_by`.
An append-only `audit_event` table records who changed what, and when.

## Design decisions

- **IDs:** UUIDv7 primary keys (PostgreSQL 18 `uuidv7()`), plus a
  human-readable `accession` on samples.
- **Cell lines** are Subjects with `subject_type = cell_line`; reference IDs
  (e.g. Cellosaurus) go in `attributes`.
- **Sample lineage:** one Sample table with `material_type` and a parent link
  covers multi-level chains (e.g. GDC sample → analyte → aliquot).
- **Metadata:** fixed columns for common fields; JSONB for type-specific
  `characteristics` (what a sample is) and `factor_values` (what was done to
  it), validated by Pydantic per type.
- **Data files** are stored in object storage, not the database. `uri` uses a
  scheme per backend (`r2://…`, `gs://…`), so storage can be R2, GCS or both.
- **Data files belong to a Study**; the Assay is optional, because analysis
  outputs may combine several assays.
- **Files can contain many samples** (e.g. TMT channels, matrix columns);
  `data_file_sample.label` records where each sample is within the file.
- **No hard deletes:** samples change `status` instead.
- **Audit trail:** recorded by the application (to revisit later).

## Demo data and licensing rules

- Use **open-access** data only; never controlled-access (e.g. dbGaP) data.
- Never attempt to re-identify individuals.
- Do not commit datasets to this repository; import scripts download from the
  official sources, and small processed subsets are kept in object storage.
- Every Project records its `licence` and `citation`, shown in the app.

Planned demo datasets: TCGA-BRCA RNA-seq (GDC, open access), CPTAC breast
cancer proteomics (PDC), a small LINCS L1000 subset (GEO), and optionally one
MetaboLights study.

## Deferred (not in the first week)

Storage locations (freezer/box/position), batches and plates, consent records,
protocols as a separate table, users and permissions beyond basic login.
