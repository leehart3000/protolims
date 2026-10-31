import { Link } from 'react-router'

import type { components } from '../api/schema'
import { counted, samplesOf } from '../format'
import { groupRows, sampleList } from '../groupRows'
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
import { SubjectSampleList } from './SubjectSampleList'

// A data file a sample is in, or a subject's samples are (with which sample).
type Row = components['schemas']['SampleDataFileRead'] & {
  sample_id?: string
  sample_name?: string
}

// On phones the other columns are hidden, so their values are shown under the name instead.
function summary(rows: [Row, ...Row[]], bySample: boolean) {
  const [file] = rows
  return [bySample ? sampleList(rows) : file.label, dataFileLevelLabel(file.level), file.format]
    .filter(Boolean)
    .join(' · ')
}

// The data files a sample appears in, with its label in each (e.g. a matrix column); or a
// subject's samples do, when `files` are a subject's: the API gives a row for each of its
// samples in each file, shown here as one row for each file, listing its samples.
export function SampleDataFileTable({ files }: { files: Row[] }) {
  const bySample = files.some((file) => file.sample_name !== undefined)
  const groups = groupRows(files, (row) => row.data_file_id)
  const count = counted(groups.length, 'data file')
  const samples = new Set(files.map((row) => row.sample_id)).size

  return (
    <>
      <p className="mt-4 text-sm text-muted">
        {bySample ? `${count}, holding data from ${samplesOf(samples)}` : count}
      </p>
      <div className={`mt-2 ${tableWrapper}`}>
        <table className={table} aria-label="Data files">
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
            {groups.map((rows) => {
              const [file] = rows
              return (
                <tr key={file.data_file_id} className={tableRow}>
                  <td className={`${tableCell} wrap-anywhere`}>
                    <Link to={`/data-files/${file.data_file_id}`} className={rowLink}>
                      {file.name}
                    </Link>
                    <div className="mt-1 break-all font-mono text-xs text-muted">{file.uri}</div>
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
                      {file.label}
                    </td>
                  )}
                  <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                    {dataFileLevelLabel(file.level)}
                  </td>
                  <td className={`${tableCell} hidden whitespace-nowrap sm:table-cell`}>
                    {file.format}
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
