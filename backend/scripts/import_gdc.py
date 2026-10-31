"""Import open-access cases from a GDC project (such as TCGA-BRCA) into a ProtoLIMS study.

It works in two halves, so you can read exactly what will be imported before anything is
sent:

    uv run --directory backend python scripts/import_gdc.py survey --project TCGA-BRCA
    uv run --directory backend python scripts/import_gdc.py fetch --project TCGA-BRCA
    uv run --directory backend python scripts/import_gdc.py send --study RNASEQ
    uv run --directory backend python scripts/import_gdc.py send --study RNASEQ --apply

"survey" lists the open-access files a GDC project has, by data type and workflow, to check
what "fetch" will find. "fetch" reads the GDC's public API (no account needed) and saves an
import request to a JSON file: the first cases (by GDC name) that have every chosen kind of
data (see ASSAY_TYPES), with their samples, the aliquots or portions each file was made
from, one assay per kind of data, and the files. "send" sends that file to ProtoLIMS: as a dry
run, unless given --apply.

"send" goes to your local ProtoLIMS unless given --target staging or --target production.
It sends your personal API token (made on your profile page), so the import is recorded as
you and needs the same permissions as on the website: editor of the study. Locally, the token
comes from the PROTOLIMS_API_TOKEN environment variable; for staging and production, from
Secret Manager, read with your own gcloud login, as is the Cloudflare Access service token
that gets past Access. See docs/importing.md.

Only open-access data is used, and only the patient details the demo needs.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from protolims_api.schemas.importing import ImportRequest

GDC_API = "https://api.gdc.cancer.gov"
PROJECT = "TCGA-BRCA"
# Kept beside the repository, never in it, so no data is committed by accident.
IMPORTS = Path(__file__).resolve().parents[3] / "protolims_resources" / "imports"
# Enough to find every open file of one kind in a project (TCGA-BRCA has about 1,100 cases).
MAX_FILES = 10_000


@dataclass(frozen=True)
class AssayType:
    """One kind of open-access GDC data, imported as one assay in the study."""

    # The GDC's data_type for the files.
    data_type: str
    # The assay's name and description in ProtoLIMS (the first, RNA-seq, is kept as it was
    # first imported, so importing again leaves it unchanged).
    assay: str
    measurement_type: str
    technology_type: str
    # What the files were made from: the material of the aliquot (or portion) they link to.
    material: str


ASSAY_TYPES = {
    "rna": AssayType(
        "Gene Expression Quantification",
        "RNA-Seq gene counts",
        "transcription profiling",
        "nucleotide sequencing",
        "RNA",
    ),
    "mirna": AssayType(
        "miRNA Expression Quantification",
        "miRNA-Seq expression",
        "miRNA profiling",
        "nucleotide sequencing",
        "RNA",
    ),
    "methylation": AssayType(
        "Methylation Beta Value",
        "DNA methylation beta values",
        "DNA methylation profiling",
        "DNA methylation microarray",
        "DNA",
    ),
    "protein": AssayType(
        "Protein Expression Quantification",
        "RPPA protein expression",
        "protein expression profiling",
        "reverse phase protein array",
        "protein lysate",
    ),
}


@dataclass(frozen=True)
class Target:
    """Somewhere "send" can send to."""

    api: str
    # The Secret Manager secret holding your API token for it (None: PROTOLIMS_API_TOKEN).
    token_secret: str | None
    # Whether it's behind Cloudflare Access, so needs the import service token too.
    behind_access: bool


TARGETS = {
    "local": Target("http://127.0.0.1:8000/api/v1", None, False),
    "staging": Target("https://staging.protolims.org/api/v1", "import-api-token-staging", True),
    # Behind Access until launch; the import service token gets past it only once production's
    # Access application allows it (Step 79).
    "production": Target("https://protolims.org/api/v1", "import-api-token-production", True),
}
TOKEN_VARIABLE = "PROTOLIMS_API_TOKEN"
GCP_PROJECT = "protolims"
DAYS_PER_YEAR = 365.25

Record = dict[str, Any]


class NoRedirects(urllib.request.HTTPRedirectHandler):
    """Treat a redirect as an error. Cloudflare Access redirects to its sign-in page when the
    token is wrong, and following it would hide that."""

    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


OPENER = urllib.request.build_opener(NoRedirects)


def post_json(url: str, body: Record, headers: dict[str, str] | None = None) -> tuple[int, Any]:
    """Send a JSON request; return the status and the reply (JSON if possible, else text)."""
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "protolims-import-gdc",
            **(headers or {}),
        },
        method="POST",
    )
    try:
        with OPENER.open(request, timeout=120) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        text = error.read().decode(errors="replace")
        try:
            return error.code, json.loads(text)
        except json.JSONDecodeError:
            return error.code, text


def equals(field: str, value: str) -> Record:
    return {"op": "=", "content": {"field": field, "value": value}}


def one_of(field: str, values: list[str]) -> Record:
    return {"op": "in", "content": {"field": field, "value": values}}


def all_of(*filters: Record) -> Record:
    return {"op": "and", "content": list(filters)}


def search_gdc(endpoint: str, filters: Record, fields: list[str], size: int) -> list[Record]:
    """Search one of the GDC's endpoints (e.g. "cases" or "files")."""
    body = {"filters": filters, "fields": ",".join(fields), "size": size, "format": "json"}
    if endpoint == "cases":
        body["sort"] = "submitter_id:asc"
    status, reply = post_json(f"{GDC_API}/{endpoint}", body)
    if status != 200:
        sys.exit(f"The GDC replied {status}: {reply}")
    hits: list[Record] = reply["data"]["hits"]
    return hits


def subject(case: Record) -> Record:
    """A GDC case as a ProtoLIMS subject, with only the details the demo needs."""
    demographic = case.get("demographic") or {}
    diagnoses = case.get("diagnoses") or [{}]
    days = diagnoses[0].get("age_at_diagnosis")
    attributes = {
        "sex_at_birth": demographic.get("sex_at_birth"),
        # The GDC gives days; whole years are enough, and less identifying.
        "age_at_diagnosis_years": None if days is None else int(days // DAYS_PER_YEAR),
        "primary_diagnosis": diagnoses[0].get("primary_diagnosis"),
    }
    return {
        "name": case["submitter_id"],
        "external_id": case["case_id"],
        "subject_type": "patient",
        "species": "Homo sapiens",
        "attributes": {key: value for key, value in attributes.items() if value is not None},
    }


def linked_entities(hit: Record) -> list[tuple[Record, Record, Record]]:
    """The (case, sample, entity) chains a GDC file comes from, where the entity is the
    aliquot (or, for protein arrays, the portion) the file names as its source."""
    wanted = {entity["entity_id"] for entity in hit.get("associated_entities", [])}
    found = []
    for case in hit.get("cases", []):
        for sample in case.get("samples", []):
            for portion in sample.get("portions", []):
                if portion.get("portion_id") in wanted:
                    found.append((case, sample, {**portion, "id": portion["portion_id"]}))
                for analyte in portion.get("analytes", []):
                    for aliquot in analyte.get("aliquots", []):
                        if aliquot["aliquot_id"] in wanted:
                            found.append((case, sample, {**aliquot, "id": aliquot["aliquot_id"]}))
    return found


def tissue_sample(case: Record, sample: Record) -> Record:
    """A GDC sample (such as a tumour or normal tissue) as a ProtoLIMS sample."""
    sample_type = sample.get("sample_type") or ""
    characteristics = {
        "sample_type": sample.get("sample_type"),
        "tissue_type": sample.get("tissue_type"),
    }
    return {
        "name": sample["submitter_id"],
        "external_id": sample["sample_id"],
        "subject": case["submitter_id"],
        "material_type": "blood" if "Blood" in sample_type else "tissue",
        "characteristics": {k: v for k, v in characteristics.items() if v is not None},
    }


def build_request(project: str, cases: list[Record], files: dict[str, list[Record]]) -> Record:
    """Turn the GDC's cases and each kind's files into a ProtoLIMS import request."""
    samples: dict[str, Record] = {}
    derived: dict[str, Record] = {}
    data_files = []
    assays = []
    for kind, hits in files.items():
        assay_type = ASSAY_TYPES[kind]
        measured: set[str] = set()
        workflows: set[str] = set()
        unlinked = 0
        for hit in sorted(hits, key=lambda hit: hit["file_name"]):
            linked = linked_entities(hit)
            if not linked:
                unlinked += 1
            for case, sample, entity in linked:
                samples[sample["sample_id"]] = tissue_sample(case, sample)
                derived[entity["id"]] = {
                    "name": entity["submitter_id"],
                    "external_id": entity["id"],
                    "parent": sample["submitter_id"],
                    "material_type": assay_type.material,
                }
                measured.add(entity["submitter_id"])
            workflow = (hit.get("analysis") or {}).get("workflow_type")
            if workflow:
                workflows.add(workflow)
            data_files.append(
                {
                    "name": hit["file_name"],
                    "external_id": hit["file_id"],
                    "uri": f"{GDC_API}/data/{hit['file_id']}",
                    "level": "processed",
                    "format": hit["data_format"],
                    "assay": assay_type.assay,
                    "size_bytes": hit.get("file_size"),
                    "summary": {
                        key: value
                        for key, value in {"workflow": workflow, "md5": hit.get("md5sum")}.items()
                        if value
                    },
                    "samples": [{"sample": entity["submitter_id"]} for _, _, entity in linked],
                }
            )
        if unlinked:
            print(
                f"Warning: {unlinked} of the {kind} files aren't linked to an aliquot or portion, "
                "so they'll have no samples. Check the GDC's associated_entities for them."
            )
        parameters = {"workflow": ", ".join(sorted(workflows))} if workflows else {}
        assays.append(
            {
                "name": assay_type.assay,
                "measurement_type": assay_type.measurement_type,
                "technology_type": assay_type.technology_type,
                "parameters": {**parameters, "source": "GDC"},
                "samples": [{"sample": name} for name in sorted(measured)],
            }
        )
    return {
        "source": f"GDC {project}, fetched {datetime.now(UTC).date().isoformat()}",
        "dry_run": True,
        "subjects": [subject(case) for case in cases],
        "samples": sorted(
            [*samples.values(), *derived.values()], key=lambda sample: sample["name"]
        ),
        "assays": assays,
        "data_files": data_files,
    }


def open_files(
    project: str, data_type: str, fields: list[str], cases: list[str] | None = None
) -> list[Record]:
    """The project's open-access files of one data type (only those of the given cases)."""
    filters = [
        equals("cases.project.project_id", project),
        equals("data_type", data_type),
        equals("access", "open"),
    ]
    if cases is not None:
        filters.append(one_of("cases.case_id", cases))
    return search_gdc("files", all_of(*filters), fields, MAX_FILES)


def survey(project: str) -> None:
    """Print how many open-access files the project has, by data type and workflow."""
    body = {
        "filters": all_of(equals("cases.project.project_id", project), equals("access", "open")),
        "facets": "data_type,analysis.workflow_type",
        "size": 0,
        "format": "json",
    }
    status, reply = post_json(f"{GDC_API}/files", body)
    if status != 200:
        sys.exit(f"The GDC replied {status}: {reply}")
    total = reply["data"]["pagination"]["total"]
    print(f"{project}: {total} open-access files")
    for facet, buckets in reply["data"]["aggregations"].items():
        print(f"\nBy {facet}:")
        for bucket in buckets["buckets"]:
            print(f"  {bucket['doc_count']:>6}  {bucket['key']}")
    known = {assay_type.data_type: kind for kind, assay_type in ASSAY_TYPES.items()}
    print("\n--kinds this script can fetch: " + ", ".join(f"{k} ({v})" for v, k in known.items()))


FILE_FIELDS = [
    "file_id",
    "file_name",
    "file_size",
    "md5sum",
    "data_format",
    "analysis.workflow_type",
    "associated_entities.entity_id",
    "cases.case_id",
    "cases.submitter_id",
    "cases.samples.sample_id",
    "cases.samples.submitter_id",
    "cases.samples.sample_type",
    "cases.samples.tissue_type",
    "cases.samples.portions.portion_id",
    "cases.samples.portions.submitter_id",
    "cases.samples.portions.analytes.aliquots.aliquot_id",
    "cases.samples.portions.analytes.aliquots.submitter_id",
]


def fetch(project: str, kinds: list[str], count: int, out: Path) -> None:
    """Fetch the first cases (by GDC name) that have open files of every chosen kind, with
    those files, and save them as an import request."""
    # Which cases have each kind of data, from the files' own links to cases.
    having: list[set[str]] = []
    for kind in kinds:
        hits = open_files(project, ASSAY_TYPES[kind].data_type, ["cases.case_id"])
        case_ids = {case["case_id"] for hit in hits for case in hit.get("cases", [])}
        print(f"{kind}: {len(hits)} open files, from {len(case_ids)} cases")
        having.append(case_ids)
    in_all = set.intersection(*having) if having else set()
    if not in_all:
        sys.exit(f"No case in {project} has open files of every kind: {', '.join(kinds)}")

    cases = search_gdc(
        "cases",
        one_of("case_id", sorted(in_all)),
        [
            "case_id",
            "submitter_id",
            "demographic.sex_at_birth",
            "diagnoses.age_at_diagnosis",
            "diagnoses.primary_diagnosis",
        ],
        len(in_all),
    )
    cases = sorted(cases, key=lambda case: case["submitter_id"])[:count]
    chosen = [case["case_id"] for case in cases]
    files = {
        kind: open_files(project, ASSAY_TYPES[kind].data_type, FILE_FIELDS, chosen)
        for kind in kinds
    }
    request = build_request(project, cases, files)
    ImportRequest.model_validate(request)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(request, indent=2) + "\n")
    records = sum(len(request[key]) for key in ("subjects", "samples", "assays", "data_files"))
    links = sum(len(item["samples"]) for item in [*request["assays"], *request["data_files"]])
    print(
        f"Saved {len(request['subjects'])} subjects, {len(request['samples'])} samples, "
        f"{len(request['assays'])} assays and {len(request['data_files'])} data files "
        f"({records + links} records and links; at most 5,000 per import) to {out}"
    )


def secret(name: str) -> str:
    """Read a secret from Secret Manager, using your own gcloud login."""
    result = subprocess.run(
        [
            "gcloud",
            "secrets",
            "versions",
            "access",
            "latest",
            f"--secret={name}",
            f"--project={GCP_PROJECT}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(f"Could not read the secret {name}: {result.stderr.strip()}")
    return result.stdout.strip()


def access_headers() -> dict[str, str]:
    """The Cloudflare Access service token for imports, as request headers."""
    return {
        "CF-Access-Client-Id": secret("import-cf-access-client-id"),
        "CF-Access-Client-Secret": secret("import-cf-access-client-secret"),
    }


def api_token(target: Target) -> str:
    """Your personal API token for the target."""
    if target.token_secret is not None:
        return secret(target.token_secret)
    token = os.environ.get(TOKEN_VARIABLE, "").strip()
    if not token:
        sys.exit(
            f"No API token: make one on your profile page, then set {TOKEN_VARIABLE} to it "
            "(see docs/importing.md)."
        )
    return token


# What to say when ProtoLIMS turns the request away, by status.
REFUSALS = {
    401: "ProtoLIMS didn't accept your API token: it may have expired or been revoked. Make a "
    "new one on your profile page, and store it again (see docs/importing.md).",
    403: "Your API token works, but you can't import into this study: you need to be an "
    "editor of it.",
    423: "This site is read-only at the moment, so only a dry run is possible (see "
    "docs/read-only.md).",
}


def send(path: Path, target_name: str, project: str, study: str, *, apply: bool) -> None:
    """Send a saved import request to ProtoLIMS: a dry run unless apply is true."""
    request = json.loads(path.read_text())
    request["dry_run"] = not apply
    ImportRequest.model_validate(request)
    target = TARGETS[target_name]
    print(
        f"Sending {path.name} to {target_name} ({target.api}), "
        f"{'to save' if apply else 'as a dry run'}."
    )
    headers = {"Authorization": f"Bearer {api_token(target)}"}
    if target.behind_access:
        headers |= access_headers()
    url = f"{target.api}/projects/{project}/studies/{study}/import"
    status, reply = post_json(url, request, headers)
    if status in (301, 302, 303, 307, 308):
        sys.exit(
            "Cloudflare Access turned the request away. Is the service token right, and is it "
            "allowed on this site?"
        )
    print(json.dumps(reply, indent=2))
    if status in REFUSALS:
        sys.exit(REFUSALS[status])
    if status != 200:
        sys.exit(f"Nothing was imported (ProtoLIMS replied {status}).")
    if apply:
        print("Saved.")
    else:
        print("Dry run: nothing was saved. Add --apply to save.")


def default_file(project: str) -> Path:
    """Where a project's import request is saved, e.g. imports/gdc-tcga-brca.json."""
    return IMPORTS / f"gdc-{project.lower()}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    survey_command = commands.add_parser("survey", help="list a GDC project's open files")
    survey_command.add_argument("--project", default=PROJECT, help=f"default {PROJECT}")
    fetch_command = commands.add_parser("fetch", help="fetch from the GDC and save to a file")
    fetch_command.add_argument("--project", default=PROJECT, help=f"default {PROJECT}")
    fetch_command.add_argument(
        "--kinds",
        default=",".join(ASSAY_TYPES),
        help=f"kinds of data, separated by commas (default {','.join(ASSAY_TYPES)})",
    )
    fetch_command.add_argument("--cases", type=int, default=10, help="how many (default 10)")
    fetch_command.add_argument("--out", type=Path, help="default imports/gdc-<project>.json")
    send_command = commands.add_parser("send", help="send a saved file to ProtoLIMS")
    send_command.add_argument("--project", default=PROJECT, help="the ProtoLIMS project code")
    send_command.add_argument("--study", required=True)
    send_command.add_argument("--file", type=Path, help="default imports/gdc-<project>.json")
    send_command.add_argument("--target", choices=TARGETS, default="local")
    send_command.add_argument("--apply", action="store_true", help="save (default: dry run)")
    args = parser.parse_args()
    if args.command == "survey":
        survey(args.project)
    elif args.command == "fetch":
        kinds = [kind.strip() for kind in args.kinds.split(",") if kind.strip()]
        unknown = [kind for kind in kinds if kind not in ASSAY_TYPES]
        if unknown or not kinds:
            sys.exit(f"Unknown kinds: {', '.join(unknown)}. Known: {', '.join(ASSAY_TYPES)}")
        fetch(args.project, kinds, args.cases, args.out or default_file(args.project))
    else:
        path = args.file or default_file(args.project)
        send(path, args.target, args.project, args.study, apply=args.apply)


if __name__ == "__main__":
    main()
