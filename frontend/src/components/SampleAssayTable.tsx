import { Link } from 'react-router'

import type { components } from '../api/schema'
import { counted, samplesOf } from '../format'
import { groupRows, sampleList } from '../groupRows'
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
import { SubjectSampleList } from './SubjectSampleList'

// A sample's assay, or a subject's (with which of its samples).
type Row = components['schemas']['SampleAssayRead'] & { sample_id?: string; sample_name?: string }

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(rows: [Row, ...Row[]], bySample: boolean) {
  const [assay] = rows
  return [bySample ? sampleList(rows) : assay.label, assay.measurement_type, assay.platform]
    .filter(Boolean)
    .join(' · ')
}

// The assays a sample was measured in, with its label in each (e.g. a TMT channel); or a
// subject's samples were, when `assays` are a subject's: the API gives a row for each of its
// samples in each assay, shown here as one row for each assay, listing its samples.
export function SampleAssayTable({ assays }: { assays: Row[] }) {
  const bySample = assays.some((assay) => assay.sample_name !== undefined)
  const groups = groupRows(assays, (row) => row.assay_id)
  const count = counted(groups.length, 'assay')
  const samples = new Set(assays.map((row) => row.sample_id)).size

  return (
    <>
      <p className="mt-4 text-sm text-muted">
        {bySample ? `${count}, measuring ${samplesOf(samples)}` : count}
      </p>
      <div className={`mt-2 ${tableWrapper}`}>
        <table className={table} aria-label="Assays">
          <thead className={tableHead}>
            <tr>
              <th scope="col" className={tableHeader}>
                Name
              </th>
              {bySample ? (
                <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
                  Samples
                </th>
              ) : (
                <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
                  Label
                </th>
              )}
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
            {groups.map((rows) => {
              const [assay] = rows
              return (
                <tr key={assay.assay_id} className={tableRow}>
                  <td className={`${tableCell} wrap-anywhere`}>
                    <Link to={`/assays/${assay.assay_id}`} className={rowLink}>
                      {assay.assay_name}
                    </Link>
                    <div className="mt-1 text-sm text-muted sm:hidden">
                      {summary(rows, bySample)}
                    </div>
                  </td>
                  {bySample ? (
                    <td className={`${tableCell} hidden sm:table-cell`}>
                      <SubjectSampleList rows={rows} />
                    </td>
                  ) : (
                    <td className={`${tableCell} hidden whitespace-nowrap font-mono sm:table-cell`}>
                      {assay.label}
                    </td>
                  )}
                  <td className={`${tableCell} hidden sm:table-cell`}>{assay.measurement_type}</td>
                  <td className={`${tableCell} hidden text-muted sm:table-cell`}>
                    {assay.platform}
                  </td>
                  <RowArrow />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
