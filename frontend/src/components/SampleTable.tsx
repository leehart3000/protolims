import { Link } from 'react-router'

import type { SampleSort } from '../api/queries'
import type { components } from '../api/schema'
import { sampleStatusLabel } from '../labels'
import {
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'
import { SortHeader } from './SortHeader'
import { RowArrow } from './RowArrow'
import { StudyCell, StudyHeader, StudyLine } from './StudyColumn'

type Sample = components['schemas']['SampleRead']
type SampleColumn = Exclude<SampleSort, `-${string}`>

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(sample: Sample) {
  return [sample.material_type, sample.subject_name, sampleStatusLabel(sample.status)]
    .filter(Boolean)
    .join(' · ')
}

// Given a sort order and a way to change it, the column headings sort the table. With
// showStudy, each sample's study and project are shown too.
export function SampleTable({
  samples,
  label,
  sort,
  onSort,
  showStudy = false,
}: {
  samples: Sample[]
  label: string
  sort?: SampleSort
  onSort?: (sort: SampleSort) => void
  showStudy?: boolean
}) {
  function heading(label: string, column: SampleColumn, className: string) {
    if (sort === undefined || onSort === undefined) {
      return (
        <th scope="col" className={className}>
          {label}
        </th>
      )
    }
    return (
      <SortHeader<SampleSort>
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
      <table className={table} aria-label={label}>
        <thead className={tableHead}>
          <tr>
            {heading('Name', 'name', tableHeader)}
            {heading('Material', 'material_type', `${tableHeader} hidden w-px sm:table-cell`)}
            {heading('Subject', 'subject', `${tableHeader} hidden sm:table-cell`)}
            {heading('Status', 'status', `${tableHeader} hidden w-px sm:table-cell`)}
            {showStudy && <StudyHeader />}
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {samples.map((sample) => (
            <tr key={sample.id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/samples/${sample.id}`} className={rowLink}>
                  {sample.name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(sample)}</div>
                {showStudy && <StudyLine record={sample} />}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {sample.material_type}
              </td>
              <td className={`${tableCell} hidden text-muted sm:table-cell`}>
                {sample.subject_name}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {sampleStatusLabel(sample.status)}
              </td>
              {showStudy && <StudyCell record={sample} />}
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
