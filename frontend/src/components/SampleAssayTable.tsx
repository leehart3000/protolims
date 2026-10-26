import { Link } from 'react-router'

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

type SampleAssay = components['schemas']['SampleAssayRead']

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(assay: SampleAssay) {
  return [assay.label, assay.measurement_type, assay.platform].filter(Boolean).join(' · ')
}

// The assays a sample was measured in, with its label in each (e.g. a TMT channel).
export function SampleAssayTable({ assays }: { assays: SampleAssay[] }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label="Assays">
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Label
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Measurement
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Platform
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {assays.map((assay) => (
            <tr key={assay.assay_id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/assays/${assay.assay_id}`} className={rowLink}>
                  {assay.assay_name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(assay)}</div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap font-mono sm:table-cell`}>
                {assay.label}
              </td>
              <td className={`${tableCell} hidden sm:table-cell`}>{assay.measurement_type}</td>
              <td className={`${tableCell} hidden text-muted sm:table-cell`}>{assay.platform}</td>
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
