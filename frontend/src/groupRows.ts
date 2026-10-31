// Rows grouped by a key, in the order each key first appears: e.g. a subject's rows of
// (assay, sample) as one group for each assay, holding the rows for each of its samples.
export function groupRows<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, [T, ...T[]]>()
  for (const row of rows) {
    const group = groups.get(key(row))
    if (group === undefined) {
      groups.set(key(row), [row])
    } else {
      group.push(row)
    }
  }
  return [...groups.values()]
}

// A subject's samples in one group, as on a phone, e.g. "C3L-00263-08 (TMT 126), C3L-00263-09".
export function sampleList(rows: { sample_name?: string; label: string | null }[]) {
  return rows
    .map((row) => (row.label ? `${row.sample_name ?? ''} (${row.label})` : (row.sample_name ?? '')))
    .join(', ')
}
