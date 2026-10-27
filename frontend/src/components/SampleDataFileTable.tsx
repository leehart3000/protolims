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

type SampleDataFile = components['schemas']['SampleDataFileRead']

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(file: SampleDataFile) {
  return [file.label, dataFileLevelLabel(file.level), file.format].filter(Boolean).join(' · ')
}

// The data files a sample appears in, with its label in each (e.g. a matrix column).
export function SampleDataFileTable({ files }: { files: SampleDataFile[] }) {
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label="Data files">
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Label
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
            <tr key={file.data_file_id} className={tableRow}>
              <td className={tableCell}>
                <Link to={`/data-files/${file.data_file_id}`} className={rowLink}>
                  {file.name}
                </Link>
                <div className="mt-1 break-all font-mono text-xs text-muted">{file.uri}</div>
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(file)}</div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap font-mono sm:table-cell`}>
                {file.label}
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
