// A subject's samples in one assay or data file, each on its own line, with its label there
// (such as a TMT channel), if it has one.
export function SubjectSampleList({
  rows,
}: {
  rows: { sample_id?: string; sample_name?: string; label: string | null }[]
}) {
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.sample_id}>
          {row.sample_name}
          {row.label && <span className="ml-2 font-mono text-muted">{row.label}</span>}
        </li>
      ))}
    </ul>
  )
}
