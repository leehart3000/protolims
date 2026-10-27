import { Link } from 'react-router'

import type { components } from '../api/schema'
import { dataFileLevelLabel } from '../labels'
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

type DataFileSummary = components['schemas']['DataFileSummary']

// A short list of data files, such as the files another file was made from.
export function FileSummaryTable({ files, label }: { files: DataFileSummary[]; label: string }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label={label}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Level
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Format
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {files.map((file) => (
            <tr key={file.id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/data-files/${file.id}`} className={rowLink}>
                  {file.name}
                </Link>
                <div className="mt-1 break-all font-mono text-xs text-muted">{file.uri}</div>
                <div className="mt-1 text-sm text-muted sm:hidden">
                  {dataFileLevelLabel(file.level)} · {file.format}
                </div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {dataFileLevelLabel(file.level)}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {file.format}
              </td>
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
