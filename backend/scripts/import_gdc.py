"""Import a few open-access TCGA-BRCA cases from the GDC into a ProtoLIMS study.

It works in two halves, so you can read exactly what will be imported before anything is
sent:

    uv run --directory backend python scripts/import_gdc.py fetch
    uv run --directory backend python scripts/import_gdc.py send --study RNASEQ
    uv run --directory backend python scripts/import_gdc.py send --study RNASEQ --apply

"fetch" reads the GDC's public API (no account needed) and saves an import request to a JSON
file. "send" sends that file to ProtoLIMS: as a dry run, unless given --apply.

Only open-access data is used, and only the patient details the demo needs.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from protolims_api.schemas.importing import ImportRequest

GDC_API = "https://api.gdc.cancer.gov"
PROJECT = "TCGA-BRCA"
WORKFLOW = "STAR - Counts"
ASSAY = "RNA-Seq gene counts"
# Kept beside the repository, never in it, so no data is committed by accident.
IMPORTS = Path(__file__).resolve().parents[3] / "protolims_resources" / "imports"
DEFAULT_FILE = IMPORTS / "gdc-tcga-brca.json"
DEFAULT_API = "http://127.0.0.1:8000/api/v1"
DAYS_PER_YEAR = 365.25

Record = dict[str, Any]


def post_json(url: str, body: Record) -> tuple[int, Any]:
    """Send a JSON request; return the status and the reply (JSON if possible, else text)."""
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
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


def linked_aliquots(hit: Record) -> list[tuple[Record, Record, Record]]:
    """The (case, sample, aliquot) chains a GDC file comes from."""
    wanted = {entity["entity_id"] for entity in hit.get("associated_entities", [])}
    found = []
    for case in hit.get("cases", []):
        for sample in case.get("samples", []):
            for portion in sample.get("portions", []):
                for analyte in portion.get("analytes", []):
                    for aliquot in analyte.get("aliquots", []):
                        if aliquot["aliquot_id"] in wanted:
                            found.append((case, sample, aliquot))
    return found


def build_request(cases: list[Record], files: list[Record]) -> Record:
    """Turn the GDC's cases and files into a ProtoLIMS import request."""
    samples: dict[str, Record] = {}
    aliquots: dict[str, Record] = {}
    data_files = []
    for hit in sorted(files, key=lambda hit: hit["file_name"]):
        linked = linked_aliquots(hit)
        for case, sample, aliquot in linked:
            sample_type = sample.get("sample_type") or ""
            characteristics = {
                "sample_type": sample.get("sample_type"),
                "tissue_type": sample.get("tissue_type"),
            }
            samples[sample["sample_id"]] = {
                "name": sample["submitter_id"],
                "external_id": sample["sample_id"],
                "subject": case["submitter_id"],
                "material_type": "blood" if "Blood" in sample_type else "tissue",
                "characteristics": {k: v for k, v in characteristics.items() if v is not None},
            }
            aliquots[aliquot["aliquot_id"]] = {
                "name": aliquot["submitter_id"],
                "external_id": aliquot["aliquot_id"],
                "parent": sample["submitter_id"],
                "material_type": "RNA",
            }
        data_files.append(
            {
                "name": hit["file_name"],
                "external_id": hit["file_id"],
                "uri": f"{GDC_API}/data/{hit['file_id']}",
                "level": "processed",
                "format": hit["data_format"],
                "assay": ASSAY,
                "size_bytes": hit.get("file_size"),
                "summary": {"workflow": WORKFLOW, "md5": hit.get("md5sum")},
                "samples": [{"sample": aliquot["submitter_id"]} for _, _, aliquot in linked],
            }
        )
    aliquot_names = sorted(aliquot["name"] for aliquot in aliquots.values())
    return {
        "source": f"GDC {PROJECT}, fetched {datetime.now(UTC).date().isoformat()}",
        "dry_run": True,
        "subjects": [subject(case) for case in cases],
        "samples": sorted(
            [*samples.values(), *aliquots.values()], key=lambda sample: sample["name"]
        ),
        "assays": [
            {
                "name": ASSAY,
                "measurement_type": "transcription profiling",
                "technology_type": "nucleotide sequencing",
                "parameters": {"workflow": WORKFLOW, "source": "GDC"},
                "samples": [{"sample": name} for name in aliquot_names],
            }
        ],
        "data_files": data_files,
    }


def fetch(count: int, out: Path) -> None:
    """Fetch the first cases (by GDC name) that have open RNA-seq gene counts, and save them."""
    cases = search_gdc(
        "cases",
        all_of(
            equals("project.project_id", PROJECT),
            equals("files.analysis.workflow_type", WORKFLOW),
        ),
        [
            "case_id",
            "submitter_id",
            "demographic.sex_at_birth",
            "diagnoses.age_at_diagnosis",
            "diagnoses.primary_diagnosis",
        ],
        count,
    )
    files = search_gdc(
        "files",
        all_of(
            one_of("cases.case_id", [case["case_id"] for case in cases]),
            equals("analysis.workflow_type", WORKFLOW),
            equals("access", "open"),
        ),
        [
            "file_id",
            "file_name",
            "file_size",
            "md5sum",
            "data_format",
            "associated_entities.entity_id",
            "cases.case_id",
            "cases.submitter_id",
            "cases.samples.sample_id",
            "cases.samples.submitter_id",
            "cases.samples.sample_type",
            "cases.samples.tissue_type",
            "cases.samples.portions.analytes.aliquots.aliquot_id",
            "cases.samples.portions.analytes.aliquots.submitter_id",
        ],
        1000,
    )
    request = build_request(cases, files)
    ImportRequest.model_validate(request)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(request, indent=2) + "\n")
    print(
        f"Saved {len(request['subjects'])} subjects, {len(request['samples'])} samples and "
        f"{len(request['data_files'])} data files to {out}"
    )


def send(path: Path, api: str, project: str, study: str, *, apply: bool) -> None:
    """Send a saved import request to ProtoLIMS: a dry run unless apply is true."""
    request = json.loads(path.read_text())
    request["dry_run"] = not apply
    ImportRequest.model_validate(request)
    status, reply = post_json(f"{api}/projects/{project}/studies/{study}/import", request)
    print(json.dumps(reply, indent=2))
    if status != 200:
        sys.exit(f"Nothing was imported (ProtoLIMS replied {status}).")
    if apply:
        print("Saved.")
    else:
        print("Dry run: nothing was saved. Add --apply to save.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    fetch_command = commands.add_parser("fetch", help="fetch from the GDC and save to a file")
    fetch_command.add_argument("--cases", type=int, default=10, help="how many (default 10)")
    fetch_command.add_argument("--out", type=Path, default=DEFAULT_FILE)
    send_command = commands.add_parser("send", help="send a saved file to ProtoLIMS")
    send_command.add_argument("--file", type=Path, default=DEFAULT_FILE)
    send_command.add_argument("--api", default=DEFAULT_API)
    send_command.add_argument("--project", default=PROJECT)
    send_command.add_argument("--study", required=True)
    send_command.add_argument("--apply", action="store_true", help="save (default: dry run)")
    args = parser.parse_args()
    if args.command == "fetch":
        fetch(args.cases, args.out)
    else:
        send(args.file, args.api, args.project, args.study, apply=args.apply)


if __name__ == "__main__":
    main()
