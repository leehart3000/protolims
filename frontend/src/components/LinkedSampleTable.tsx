import { Link } from 'react-router'

import type { AssaySampleSort } from '../api/queries'
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
import { RowArrow } from './RowArrow'
import { SortHeader } from './SortHeader'

type AssaySample = components['schemas']['AssaySampleRead']

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(sample: AssaySample) {
  return [sample.label, sample.material_type, sampleStatusLabel(sample.status)]
    .filter(Boolean)
    .join(' · ')
}

// Samples linked to an assay or a data file, with each one's label there (e.g. a TMT channel).
export function LinkedSampleTable({
  samples,
  sort,
  onSort,
}: {
  samples: AssaySample[]
  sort: AssaySampleSort
  onSort: (sort: AssaySampleSort) => void
}) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label="Samples">
        <thead className={tableHead}>
          <tr>
            <SortHeader<AssaySampleSort>
              label="Name"
              ascending="name"
              descending="-name"
              sort={sort}
              onSort={onSort}
              className={tableHeader}
            />
            <SortHeader<AssaySampleSort>
              label="Label"
              ascending="label"
              descending="-label"
              sort={sort}
              onSort={onSort}
              className={`${tableHeader} hidden w-px sm:table-cell`}
            />
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Material
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Status
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {samples.map((sample) => (
            <tr key={sample.sample_id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/samples/${sample.sample_id}`} className={rowLink}>
                  {sample.sample_name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(sample)}</div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap font-mono sm:table-cell`}>
                {sample.label}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {sample.material_type}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {sampleStatusLabel(sample.status)}
              </td>
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
