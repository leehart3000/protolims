"""Import open proteomics from the Proteomic Data Commons (PDC) into a ProtoLIMS study.

It works in steps, like import_gdc.py, so you can read exactly what will be imported:

    uv run --directory backend python scripts/import_pdc.py survey --study PDC000153
    uv run --directory backend python scripts/import_pdc.py fetch --study PDC000153 --plexes 2
    uv run --directory backend python scripts/import_pdc.py send --study MULTIOMICS

"survey" tries each query an import needs on one study, and prints a little of each answer
(or the PDC's error). "fetch" takes the study's first few TMT plexes (by name), and saves an
import request: each plex as an assay, with the aliquots in its channels as samples (labelled
by channel), under their tissue samples and patients (matched by name to records already in
the study, such as those imported from the GDC), and the plex's files. Each file records the
file it was made from (mzML from raw spectra, peptide matches from mzML). It also saves the
patients' names, so import_gdc.py can fetch the same patients (--case-names). "send" sends the
request, as import_gdc.py does (dry run unless given --apply).

The PDC's API is public: no account is needed. Its files can only be downloaded with a
short-lived signed link, so each file's location is recorded as its study's page on the PDC
with its file ID, alongside its MD5 checksum and size.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from import_gdc import IMPORTS, TARGETS, send

from protolims_api.schemas.importing import ImportRequest

PDC_API = "https://pdc.cancer.gov/graphql"
# CPTAC lung adenocarcinoma, discovery cohort, global proteome (the survey confirms it).
STUDY = "PDC000153"


def graphql(query: str) -> tuple[dict[str, Any], list[Any]]:
    """Run a GraphQL query on the PDC's API; return its data and any errors."""
    request = urllib.request.Request(
        PDC_API,
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "protolims-import-pdc"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            reply: dict[str, Any] = json.load(response)
    except urllib.error.HTTPError as error:
        text = error.read().decode(errors="replace")
        try:
            reply = json.loads(text)
        except json.JSONDecodeError:
            return {}, [f"HTTP {error.code}: {text[:500]}"]
    return reply.get("data") or {}, reply.get("errors") or []


def show(title: str, query: str, summarise: Any) -> list[Any] | dict[str, Any] | None:
    """Run one query, and print its title, then a summary of its answer or its errors."""
    print(f"\n=== {title}")
    data, errors = graphql(query)
    for error in errors:
        message = error.get("message", error) if isinstance(error, dict) else error
        print(f"  Error: {message}")
    if not data:
        return None
    answer = next(iter(data.values()))
    summarise(answer)
    return answer  # type: ignore[no-any-return]


def first(rows: Any, count: int = 3) -> None:
    """Print the first few rows of a list (or the one record) as JSON."""
    rows = rows if isinstance(rows, list) else [rows]
    print(f"  {len(rows)} rows. The first {min(count, len(rows))}:")
    print("  " + json.dumps(rows[:count], indent=2).replace("\n", "\n  ")[:4000])


def survey(study: str) -> None:
    """Try each query an import would need on the study, and print what comes back."""
    show(
        "Study",
        f'{{ study(pdc_study_id: "{study}" acceptDUA: true) {{ study_id pdc_study_id '
        "study_submitter_id study_name disease_type primary_site analytical_fraction "
        "experiment_type cases_count aliquots_count "
        "filesCount { data_category file_type files_count } } }",
        lambda answer: first(answer, 1),
    )

    biospecimens = show(
        "Biospecimens (aliquots, samples and cases)",
        f'{{ biospecimenPerStudy(pdc_study_id: "{study}" acceptDUA: true) {{ aliquot_id '
        "aliquot_submitter_id sample_id sample_submitter_id case_id case_submitter_id "
        "sample_type disease_type primary_site taxon pool } }",
        first,
    )

    def count_files(rows: list[dict[str, Any]]) -> None:
        kinds = Counter((row.get("data_category"), row.get("file_type")) for row in rows)
        print(f"  {len(rows)} files, by data category and file type:")
        for (category, file_type), count in kinds.most_common():
            print(f"    {count:>6}  {category} / {file_type}")
        first(rows, 2)

    files = show(
        "Files",
        f'{{ filesPerStudy(pdc_study_id: "{study}" acceptDUA: true) {{ file_id file_name '
        "file_submitter_id file_type data_category file_format file_size md5sum "
        "file_location } }",
        count_files,
    )

    show(
        "Experimental design (which aliquot is in which TMT channel of each plex)",
        f'{{ studyExperimentalDesign(pdc_study_id: "{study}" acceptDUA: true) {{ '
        "study_run_metadata_submitter_id plex_dataset_name experiment_type "
        "number_of_fractions tmt_126 { aliquot_submitter_id } "
        "tmt_131 { aliquot_submitter_id } } }",
        lambda rows: first(rows, 2),
    )

    if isinstance(files, list) and files:
        file_id = files[0]["file_id"]
        show(
            f"One file's metadata, with its aliquots ({file_id})",
            f'{{ fileMetadata(file_id: "{file_id}" acceptDUA: true) {{ file_name file_size '
            "md5sum file_location file_submitter_id fraction_number experiment_type "
            "plex_or_dataset_name aliquots { aliquot_id aliquot_submitter_id sample_id "
            "sample_submitter_id } } }",
            first,
        )

    if isinstance(biospecimens, list) and biospecimens:
        case = biospecimens[0]["case_submitter_id"]
        show(
            f"One case, with its GDC case ID ({case})",
            f'{{ case(case_submitter_id: "{case}" acceptDUA: true) {{ case_id '
            "case_submitter_id gdc_case_id project_submitter_id disease_type } }",
            first,
        )


# TMT channels, as the PDC names them in a study's experimental design (TMT10 and TMT11).
CHANNELS = [
    "tmt_126",
    "tmt_127n",
    "tmt_127c",
    "tmt_128n",
    "tmt_128c",
    "tmt_129n",
    "tmt_129c",
    "tmt_130n",
    "tmt_130c",
    "tmt_131",
    "tmt_131c",
]

# The kinds of file a plex can have, by PDC data category and file type, and how each is
# recorded: its level, its format, and the kind of file it was made from (if any).
FILE_KINDS = {
    "raw": ("Raw Mass Spectra", "Proprietary", "raw", "RAW", None),
    "mzml": ("Processed Mass Spectra", "Open Standard", "processed", "mzML", "raw"),
    "psm": ("Peptide Spectral Matches", "Text", "processed", "PSM", "mzml"),
    "mzid": ("Peptide Spectral Matches", "Open Standard", "processed", "mzIdentML", "mzml"),
}


def data(query: str) -> Any:
    """The answer to a PDC query, or exit with its errors."""
    answer, errors = graphql(query)
    if errors or not answer:
        sys.exit(f"The PDC reported errors: {json.dumps(errors, indent=2)[:2000]}")
    return next(iter(answer.values()))


def fraction_key(name: str) -> str:
    """A file's fraction, from its name without extensions: the raw spectra, mzML and peptide
    matches of one fraction share it (e.g. "19CPTAC_LUAD_W_BI_20180730_KL_f08")."""
    return name.split(".")[0]


def plex_key(name: str) -> tuple[str, str] | None:
    """The plex number and date in a plex's or a file's name, e.g. ("19", "20180730") from
    "19CPTAC_LUAD_Proteome_BI_20180730" or "19CPTAC_LUAD_W_BI_20180730_KL_f08.raw"."""
    match = re.match(r"^(\d+)CPTAC.*?_(\d{8})", name)
    return (match.group(1), match.group(2)) if match else None


def file_uri(study: str, file_id: str) -> str:
    """Where a PDC file can be found: its study's page, naming the file."""
    return f"https://pdc.cancer.gov/pdc/study/{study}?file_id={file_id}"


def aliquot_sample(aliquot: dict[str, Any], pooled: bool) -> dict[str, Any]:
    """An aliquot the plex measured, as a ProtoLIMS sample (under its tissue sample, unless
    it's a pooled reference)."""
    characteristics = {
        "sample_type": aliquot.get("sample_type"),
        "pooled": True if pooled else None,
    }
    return {
        "name": aliquot["aliquot_submitter_id"],
        "external_id": aliquot["aliquot_id"],
        **({} if pooled else {"parent": aliquot["sample_submitter_id"]}),
        "material_type": "protein",
        "characteristics": {key: value for key, value in characteristics.items() if value},
    }


def fetch(study: str, plex_count: int, kinds: list[str], out: Path) -> None:
    """Fetch the study's first plexes (by name), their aliquots and files, and save them."""
    info = data(
        f'{{ study(pdc_study_id: "{study}" acceptDUA: true) {{ study_name '
        "experiment_type analytical_fraction } }"
    )
    info = info[0] if isinstance(info, list) else info
    print(f"{study}: {info['study_name']}")

    channels = " ".join(f"{channel} {{ aliquot_submitter_id }}" for channel in CHANNELS)
    design = data(
        f'{{ studyExperimentalDesign(pdc_study_id: "{study}" acceptDUA: true) {{ '
        f"plex_dataset_name experiment_type number_of_fractions {channels} }} }}"
    )
    plexes = sorted(design, key=lambda plex: plex["plex_dataset_name"])[:plex_count]
    names = ", ".join(plex["plex_dataset_name"] for plex in plexes)
    print(f"{len(design)} plexes; taking {names}")

    biospecimens = data(
        f'{{ biospecimenPerStudy(pdc_study_id: "{study}" acceptDUA: true) {{ aliquot_id '
        "aliquot_submitter_id sample_id sample_submitter_id case_submitter_id sample_type "
        "pool } }"
    )
    by_aliquot = {row["aliquot_submitter_id"]: row for row in biospecimens}

    subjects: dict[str, dict[str, Any]] = {}
    samples: dict[str, dict[str, Any]] = {}
    assays = []
    for plex in plexes:
        measured = []
        for channel in CHANNELS:
            for entry in plex.get(channel) or []:
                aliquot = by_aliquot.get(entry["aliquot_submitter_id"])
                if aliquot is None:
                    print(
                        f"Warning: {entry['aliquot_submitter_id']} isn't in the study's aliquots."
                    )
                    continue
                case = aliquot.get("case_submitter_id")
                # Reference pools (such as "Normal Only IR") aren't always marked as pools,
                # but they have the same name as their sample, and no real patient.
                pooled = (
                    aliquot.get("pool") == "Yes"
                    or not case
                    or aliquot["aliquot_submitter_id"] == aliquot.get("sample_submitter_id")
                )
                if not pooled:
                    # No external IDs, so they're matched by name: a patient or tissue sample
                    # already imported from the GDC is used, not repeated.
                    subjects[case] = {
                        "name": case,
                        "subject_type": "patient",
                        "species": "Homo sapiens",
                    }
                    samples[aliquot["sample_submitter_id"]] = {
                        "name": aliquot["sample_submitter_id"],
                        "subject": case,
                        "material_type": "tissue",
                    }
                samples[aliquot["aliquot_submitter_id"]] = aliquot_sample(aliquot, pooled)
                label = "TMT " + channel.removeprefix("tmt_").upper()
                measured.append({"sample": aliquot["aliquot_submitter_id"], "label": label})
        parameters = {
            "experiment_type": plex.get("experiment_type"),
            "fractions": plex.get("number_of_fractions"),
            "analytical_fraction": info.get("analytical_fraction"),
            "source": f"PDC {study}",
        }
        assays.append(
            {
                "name": plex["plex_dataset_name"],
                "measurement_type": "protein expression profiling",
                "technology_type": "mass spectrometry",
                "parameters": {key: value for key, value in parameters.items() if value},
                "samples": measured,
            }
        )

    files = data(
        f'{{ filesPerStudy(pdc_study_id: "{study}" acceptDUA: true) {{ file_id file_name '
        "file_type data_category file_size md5sum } }"
    )
    wanted = {plex_key(plex["plex_dataset_name"]): plex["plex_dataset_name"] for plex in plexes}
    chosen: list[tuple[str, str, dict[str, Any]]] = []
    for row in files:
        plex_name = wanted.get(plex_key(row["file_name"]))
        for kind in kinds:
            category, file_type = FILE_KINDS[kind][:2]
            if plex_name and (row["data_category"], row["file_type"]) == (category, file_type):
                chosen.append((kind, plex_name, row))

    # Each fraction's file of each kind, so a file can name the one it was made from.
    uris = {
        (kind, fraction_key(row["file_name"])): file_uri(study, row["file_id"])
        for kind, _, row in chosen
    }
    data_files = []
    for kind, plex_name, row in sorted(chosen, key=lambda item: item[2]["file_name"]):
        _, _, level, file_format, made_from = FILE_KINDS[kind]
        source = uris.get((made_from, fraction_key(row["file_name"])))
        data_files.append(
            {
                "name": row["file_name"],
                "external_id": row["file_id"],
                "uri": file_uri(study, row["file_id"]),
                "level": level,
                "format": file_format,
                "assay": plex_name,
                "size_bytes": int(row["file_size"]) if row.get("file_size") else None,
                "summary": {"md5": row.get("md5sum"), "pdc_data_category": row["data_category"]},
                "inputs": [source] if source else [],
            }
        )
    for plex in plexes:
        if not any(name == plex["plex_dataset_name"] for _, name, _ in chosen):
            print(f"Warning: no files found for {plex['plex_dataset_name']}.")

    request = {
        "source": f"PDC {study} ({info['study_name']}), fetched {datetime.now(UTC).date()}",
        "dry_run": True,
        "subjects": sorted(subjects.values(), key=lambda subject: subject["name"]),
        "samples": sorted(samples.values(), key=lambda sample: sample["name"]),
        "assays": assays,
        "data_files": data_files,
    }
    ImportRequest.model_validate(request)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(request, indent=2) + "\n")
    names_file = out.with_suffix(".cases.txt")
    names_file.write_text("".join(f"{name}\n" for name in sorted(subjects)))
    records = sum(len(request[key]) for key in ("subjects", "samples", "assays", "data_files"))
    links = sum(len(assay["samples"]) for assay in assays)
    links += sum(len(item["inputs"]) for item in data_files)
    print(
        f"Saved {len(subjects)} patients, {len(samples)} samples, {len(assays)} assays and "
        f"{len(data_files)} data files ({records + links} records and links; at most 5,000 "
        f"per import) to {out}, and the patients' names to {names_file}"
    )


def default_file(study: str) -> Path:
    """Where a study's import request is saved, e.g. imports/pdc-pdc000153.json."""
    return IMPORTS / f"pdc-{study.lower()}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    survey_command = commands.add_parser("survey", help="try the PDC queries on one study")
    survey_command.add_argument("--study", default=STUDY, help=f"PDC study ID (default {STUDY})")
    fetch_command = commands.add_parser("fetch", help="fetch from the PDC and save to a file")
    fetch_command.add_argument("--study", default=STUDY, help=f"PDC study ID (default {STUDY})")
    fetch_command.add_argument("--plexes", type=int, default=2, help="how many (default 2)")
    fetch_command.add_argument(
        "--kinds",
        default="raw,mzml,psm",
        help="kinds of file, separated by commas (default raw,mzml,psm; also mzid)",
    )
    fetch_command.add_argument("--out", type=Path, help="default imports/pdc-<study>.json")
    send_command = commands.add_parser("send", help="send a saved file to ProtoLIMS")
    send_command.add_argument("--project", default="CPTAC-3", help="the ProtoLIMS project code")
    send_command.add_argument("--study", required=True, help="the ProtoLIMS study code")
    send_command.add_argument("--file", type=Path, help=f"default {default_file(STUDY).name}")
    send_command.add_argument("--target", choices=TARGETS, default="local")
    send_command.add_argument("--apply", action="store_true", help="save (default: dry run)")
    args = parser.parse_args()
    if args.command == "survey":
        survey(args.study)
    elif args.command == "fetch":
        kinds = [kind.strip() for kind in args.kinds.split(",") if kind.strip()]
        unknown = [kind for kind in kinds if kind not in FILE_KINDS]
        if unknown or not kinds:
            sys.exit(f"Unknown kinds: {', '.join(unknown)}. Known: {', '.join(FILE_KINDS)}")
        fetch(args.study, args.plexes, kinds, args.out or default_file(args.study))
    else:
        path = args.file or default_file(STUDY)
        send(path, args.target, args.project, args.study, apply=args.apply)


if __name__ == "__main__":
    main()
