import { Link } from 'react-router'

import type { components } from '../api/schema'
import { sampleStatusLabel } from '../labels'
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

type Sample = components['schemas']['SampleRead']

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(sample: Sample) {
  return [sample.material_type, sample.subject_name, sampleStatusLabel(sample.status)]
    .filter(Boolean)
    .join(' · ')
}

export function SampleTable({ samples }: { samples: Sample[] }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Material
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Subject
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
            <tr key={sample.id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/samples/${sample.id}`} className={rowLink}>
                  {sample.name}
                </Link>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(sample)}</div>
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
