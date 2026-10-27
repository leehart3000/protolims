import { Link } from 'react-router'

import type { DataFileSort } from '../api/queries'
import type { components } from '../api/schema'
import { formatFileSize } from '../fileSize'
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
import { SortHeader } from './SortHeader'

type DataFile = components['schemas']['DataFileRead']
type DataFileColumn = Exclude<DataFileSort, `-${string}`>

function sampleCount(count: number) {
  return count === 1 ? '1 sample' : `${String(count)} samples`
}

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(file: DataFile) {
  return [
    dataFileLevelLabel(file.level),
    file.format,
    file.size_bytes === null ? null : formatFileSize(file.size_bytes),
    sampleCount(file.sample_count),
  ]
    .filter(Boolean)
    .join(' · ')
}

// Files often share names, so each file's location is shown under its name on every screen.
export function DataFileTable({
  files,
  sort,
  onSort,
}: {
  files: DataFile[]
  sort: DataFileSort
  onSort: (sort: DataFileSort) => void
}) {
  function heading(label: string, column: DataFileColumn, className: string) {
    return (
      <SortHeader<DataFileSort>
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
      <table className={table} aria-label="Data files">
        <thead className={tableHead}>
          <tr>
            {heading('Name', 'name', tableHeader)}
            {heading('Level', 'level', `${tableHeader} hidden w-px sm:table-cell`)}
            {heading('Format', 'format', `${tableHeader} hidden w-px sm:table-cell`)}
            {heading('Size', 'size_bytes', `${tableHeader} hidden w-px sm:table-cell`)}
            <th scope="col" className={`${tableHeader} hidden w-px text-right sm:table-cell`}>
              Samples
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
                <div className="mt-1 text-sm text-muted sm:hidden">{summary(file)}</div>
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {dataFileLevelLabel(file.level)}
              </td>
              <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                {file.format}
              </td>
              <td
                className={`${tableCell} hidden whitespace-nowrap text-right tabular-nums sm:table-cell`}
              >
                {file.size_bytes === null ? null : formatFileSize(file.size_bytes)}
              </td>
              <td className={`${tableCell} hidden text-right tabular-nums sm:table-cell`}>
                {String(file.sample_count)}
              </td>
              <RowArrow />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
