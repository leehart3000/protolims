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

export function SampleTable({ samples }: { samples: Sample[] }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
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
              </td>
              <td className={`${tableCell} whitespace-nowrap`}>{sample.material_type}</td>
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
