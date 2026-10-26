import { Link } from 'react-router'

import type { AssaySort } from '../api/queries'
import type { components } from '../api/schema'
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

type Assay = components['schemas']['AssayRead']
type AssayColumn = Exclude<AssaySort, `-${string}`>

function sampleCount(count: number) {
  return count === 1 ? '1 sample' : `${String(count)} samples`
}

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(assay: Assay) {
  return [
    assay.measurement_type,
    assay.technology_type,
    assay.platform,
    sampleCount(assay.sample_count),
  ]
    .filter(Boolean)
    .join(' · ')
}

export function AssayTable({
  assays,
  sort,
  onSort,
}: {
  assays: Assay[]
  sort: AssaySort
  onSort: (sort: AssaySort) => void
}) {
  function heading(label: string, column: AssayColumn, className: string) {
    return (
      <SortHeader<AssaySort>
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
      <table className={table} aria-label="Assays">
        <thead className={tableHead}>
          <tr>
            {heading('Name', 'name', tableHeader)}
            {heading('Measurement', 'measurement_type', `${tableHeader} hidden sm:table-cell`)}
            {heading('Technology', 'technology_type', `${tableHeader} hidden sm:table-cell`)}
            {heading('Platform', 'platform', `${tableHeader} hidden sm:table-cell`)}
            <th scope="col" className={`${tableHeader} hidden w-px text-right sm:table-cell`}>
              Samples
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {assays.map((assay) => (
            <tr key={assay.id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/assays/${assay.id}`} className={rowLink}>
                  {assay.name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(assay)}</div>
              </td>
              <td className={`${tableCell} hidden sm:table-cell`}>{assay.measurement_type}</td>
              <td className={`${tableCell} hidden sm:table-cell`}>{assay.technology_type}</td>
              <td className={`${tableCell} hidden text-muted sm:table-cell`}>{assay.platform}</td>
              <td className={`${tableCell} hidden text-right tabular-nums sm:table-cell`}>
                {String(assay.sample_count)}
              </td>
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
