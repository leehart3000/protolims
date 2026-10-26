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
    STUDY ||--o{ SAMPLE : holds
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
        text code UK "unique across ProtoLIMS"
        text name
        text source_repository
        text licence
        text citation
    }
    STUDY {
        uuid id PK
        uuid project_id FK
        text code "unique within its project"
        text title
        jsonb design_factors
    }
    SUBJECT {
        uuid id PK
        uuid study_id FK
        text name "unique within its study"
        text external_id "ID in the source repository"
        text subject_type
        text species
        jsonb attributes
    }
    SAMPLE {
        uuid id PK
        uuid study_id FK
        text name "unique within its study"
        text external_id "ID in the source repository"
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
        text name "unique within its study"
        text external_id
        text measurement_type
        text technology_type
        text platform
        timestamptz performed_at
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

- **IDs:** UUIDv7 primary keys (PostgreSQL 18 `uuidv7()`). The UUID is a
  record's permanent identity and is what links use; people work with codes and
  names.
- **Projects are independent.** Project codes are unique across ProtoLIMS.
  Everything else is scoped to its parent: study codes are unique within their
  project, and subject, sample and assay names are unique within their study.
  So different projects can each have a `PILOT` study, and different studies
  can each have a sample called `S1`. Studies are addressed through their
  project, e.g. `/projects/TCGA-BRCA/studies/RNASEQ`.
- **Addresses:** projects and studies, of which there are few and whose codes
  are chosen deliberately, are addressed by code (e.g.
  `/projects/TCGA-BRCA/studies/RNASEQ`). Subjects, samples and assays, which
  are numerous and whose names are imported and may be corrected, are addressed
  by their permanent ID (e.g. `/subjects/{id}`, `/assays/{id}`), so links never
  break when a name changes. Pages show names and breadcrumbs, never the ID.
  Creating and listing them still happens under their study.
- **Reserved codes:** project and study codes can't be `new` or `edit` (in any
  capitalisation), as they would clash with page addresses. If more reserved
  words are ever needed, consider GitLab-style `/-/` addresses instead.
- **No assumed identity across studies.** Two samples (or subjects) with the
  same name in different studies are separate records; ProtoLIMS assumes neither
  that they are the same nor that they are different. Connections between
  studies are made only by explicit, recorded links (planned): for example,
  "sample `S1` in study A is the same material as `TCGA-A1-A0SB-01A` in study
  B", with who made the link and on what basis (e.g. matched on a chosen
  column). A matching tool may suggest links, but nothing is linked until a
  person confirms it.
- **Single installation, single organisation:** ProtoLIMS is not designed for
  independent groups sharing one installation; projects provide separation
  within one organisation.
- **Cell lines** are Subjects with `subject_type = cell_line`; reference IDs
  (e.g. Cellosaurus) go in `attributes`.
- **Sample lineage:** one Sample table with `material_type` and a parent link
  covers multi-level chains (e.g. GDC sample → analyte → aliquot).
- **Metadata:** fixed columns for common fields; JSONB for type-specific
  `characteristics` (what a sample is) and `factor_values` (what was done to
  it), validated by Pydantic per type.
- **Assays and their samples:** an assay's samples must be in the same study.
  `assay_sample.label` records where each sample is within the assay (e.g. a
  TMT channel). Linking is `PUT /assays/{id}/samples/{sample_id}`, which is
  safe to repeat (imports rely on this); removing a link is a `DELETE`. Both
  are recorded in the audit trail. Linking by hand in the website waits for the
  search-as-you-type picker.
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
protocols as a separate table, users and permissions beyond basic login,
explicit cross-study links for samples and subjects, and the matching tool that
suggests them.
