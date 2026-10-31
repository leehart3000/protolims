// The lists of each kind of record across all studies, and where they are when filtered to a
// project (and study), as in /assays?project=CPTAC-3&study=LUAD-DISCOVERY.

export type RecordKind = 'subjects' | 'samples' | 'assays' | 'data-files'

// What each list is called, as in a breadcrumb.
export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  subjects: 'Subjects',
  samples: 'Samples',
  assays: 'Assays',
  'data-files': 'Data files',
}

// The breadcrumb for a record's kind, after its study's, leading to the list of that study's
// records of this kind, as in "Assays" (to /assays?project=CPTAC-3&study=LUAD-DISCOVERY).
export function kindCrumb(kind: RecordKind, projectCode: string, studyCode: string) {
  const query = new URLSearchParams({ project: projectCode, study: studyCode })
  return { label: RECORD_KIND_LABELS[kind], to: `/${kind}?${query.toString()}` }
}
