import { tableCell } from '../styles'

// Which study each record is in, for the lists of records across all studies. From medium
// screens it's a column of its own (headed with studyHeader, from styles.ts, sorting by
// project and study code); on narrower ones, a line under the record's name.

interface InStudy {
  project_code: string
  study_code: string
}

export function StudyCell({ record }: { record: InStudy }) {
  return (
    <td className={`${tableCell} hidden font-mono whitespace-nowrap md:table-cell`}>
      {record.study_code}
      <div className="mt-1 text-xs text-muted">{record.project_code}</div>
    </td>
  )
}

export function StudyLine({ record }: { record: InStudy }) {
  return (
    <p className="mt-1 font-mono text-xs text-muted md:hidden">
      {record.study_code} · {record.project_code}
    </p>
  )
}
