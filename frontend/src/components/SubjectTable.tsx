import { Link } from 'react-router'

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

type Subject = components['schemas']['SubjectRead']

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(subject: Subject) {
  return [subjectTypeLabel(subject.subject_type), subject.species].filter(Boolean).join(' · ')
}

export function SubjectTable({ subjects }: { subjects: Subject[] }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Type
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Species
            </th>
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
