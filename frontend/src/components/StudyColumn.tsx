import { tableCell, tableHeader } from '../styles'

// Which study each record is in, for the lists of records across all studies. From medium
// screens it's a column of its own; on narrower ones, a line under the record's name.

interface InStudy {
  project_code: string
  study_code: string
}

export function StudyHeader() {
  return (
    <th scope="col" className={`${tableHeader} hidden w-px md:table-cell`}>
      Study
    </th>
  )
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
