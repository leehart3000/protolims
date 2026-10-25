import { Link } from 'react-router'

import type { SubjectSort } from '../api/queries'
import type { components } from '../api/schema'
import { subjectTypeLabel } from '../labels'
import {
  rowChevron,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'
import { SortHeader } from './SortHeader'

type Subject = components['schemas']['SubjectRead']
type SubjectColumn = Exclude<SubjectSort, `-${string}`>

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(subject: Subject) {
  return [subjectTypeLabel(subject.subject_type), subject.species].filter(Boolean).join(' · ')
}

export function SubjectTable({
  subjects,
  sort,
  onSort,
}: {
  subjects: Subject[]
  sort: SubjectSort
  onSort: (sort: SubjectSort) => void
}) {
  function heading(label: string, column: SubjectColumn, className: string) {
    return (
      <SortHeader<SubjectSort>
        label={label}
        ascending={column}
        descending={`-${column}` as const}
        sort={sort}
        onSort={onSort}
        className={className}
      />
    )
  }

  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label="Subjects">
        <thead className={tableHead}>
          <tr>
            {heading('Name', 'name', tableHeader)}
            {heading('Type', 'subject_type', `${tableHeader} hidden w-px sm:table-cell`)}
            {heading('Species', 'species', `${tableHeader} hidden sm:table-cell`)}
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {subjects.map((subject) => (
            <tr key={subject.id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/subjects/${subject.id}`} className={rowLink}>
                  {subject.name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(subject)}</div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {subjectTypeLabel(subject.subject_type)}
              </td>
              <td className={`${tableCell} hidden text-muted italic sm:table-cell`}>
                {subject.species}
              </td>
              <td className={`${tableCell} ${rowChevron}`} aria-hidden="true">
                ›
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
