import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import {
  type AssaySampleSort,
  fetchDataFile,
  fetchDataFileInputs,
  fetchDataFileOutputs,
  fetchDataFileSamplePage,
} from '../api/queries'
import type { components } from '../api/schema'
import { LinkedSampleTable } from '../components/LinkedSampleTable'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { DetailsCard } from '../components/DetailsCard'
import { FileSummaryTable } from '../components/FileSummaryTable'
import { KeyValueList } from '../components/KeyValueList'
import { PageTitle } from '../components/PageTitle'
import { PagedTable } from '../components/PagedTable'
import { SearchBox } from '../components/SearchBox'
import { formatFileSize } from '../fileSize'
import { formatDate } from '../format'
import { dataFileLevelLabel } from '../labels'
import { errorBox, textLink } from '../styles'
import { useListControls } from '../useListControls'
import { editorOf } from '../permissions'

type DataFile = components['schemas']['DataFileRead']

// Web addresses open in a new tab; cloud storage addresses aren't links a browser can open.
function Location({ uri }: { uri: string }) {
  if (uri.startsWith('https://')) {
    return (
      <a
        href={uri}
        className={`${textLink} break-all font-mono`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {uri}
      </a>
    )
  }
  return <span className="break-all font-mono">{uri}</span>
}

function DataFileSampleList({ dataFileId }: { dataFileId: string }) {
  const controls = useListControls<AssaySampleSort>('name')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['data-files', dataFileId, 'samples', { q, sort, offset, limit }],
    queryFn: () => fetchDataFileSamplePage(dataFileId, { q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading samples…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load samples. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id="data-file-sample-search"
          label="Search samples"
          placeholder="Search by name or external ID"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">
          {q ? `No samples match “${q}”.` : 'No samples linked to this file yet.'}
        </p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <LinkedSampleTable samples={items} sort={sort} onSort={changeSort} />
        </PagedTable>
      )}
    </>
  )
}

function RelatedFiles({ dataFileId, which }: { dataFileId: string; which: 'inputs' | 'outputs' }) {
  const query = useQuery({
    queryKey: ['data-files', dataFileId, which],
    queryFn: () =>
      which === 'inputs' ? fetchDataFileInputs(dataFileId) : fetchDataFileOutputs(dataFileId),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading files…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        {which === 'inputs'
          ? 'Could not load the files it was made from.'
          : 'Could not load the files made from it.'}{' '}
        Please try again later.
      </p>
    )
  }

  if (query.data.length === 0) {
    return (
      <p className="mt-4 text-muted">
        {which === 'inputs'
          ? 'Not recorded as made from other files.'
          : 'No files recorded as made from this one.'}
      </p>
    )
  }

  return (
    <FileSummaryTable
      files={query.data}
      label={which === 'inputs' ? 'Made from' : 'Used to make'}
    />
  )
}

function DataFileDetails({ file }: { file: DataFile }) {
  const projectPath = `/projects/${encodeURIComponent(file.project_code)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(file.study_code)}`

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: file.project_code, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(file.project_code)}` },
          { label: file.study_code, to: studyPath, mono: true },
          { label: file.name },
        ]}
      />
      <PageTitle label="Data file">{file.name}</PageTitle>

      <DetailsCard
        editTo={`/data-files/${file.id}/edit`}
        editLabel="Edit data file"
        editNeed={editorOf(file.project_code, file.study_code)}
      >
        <DetailList
          items={[
            ['Location', <Location uri={file.uri} />],
            ['Level', dataFileLevelLabel(file.level)],
            ['Format', file.format],
            ['Size', file.size_bytes === null ? null : formatFileSize(file.size_bytes)],
            ['SHA-256', file.sha256 && <span className="break-all font-mono">{file.sha256}</span>],
            [
              'Assay',
              file.assay_id && (
                <Link to={`/assays/${file.assay_id}`} className={textLink}>
                  {file.assay_name}
                </Link>
              ),
            ],
            [
              'External ID',
              file.external_id && <span className="font-mono">{file.external_id}</span>,
            ],
            ['Study code', <span className="font-mono">{file.study_code}</span>],
            ['Project code', <span className="font-mono">{file.project_code}</span>],
            ['Created', formatDate(file.created_at)],
          ]}
        />
      </DetailsCard>

      <h2 className="mt-10 text-xl font-semibold">Summary</h2>
      <KeyValueList values={file.summary} emptyText="No summary recorded." />

      <h2 className="mt-10 text-xl font-semibold">Samples</h2>
      <DataFileSampleList dataFileId={file.id} />

      <h2 className="mt-10 text-xl font-semibold">Made from</h2>
      <RelatedFiles dataFileId={file.id} which="inputs" />

      <h2 className="mt-10 text-xl font-semibold">Used to make</h2>
      <RelatedFiles dataFileId={file.id} which="outputs" />
    </>
  )
}

export default function DataFileDetailPage() {
  const { dataFileId = '' } = useParams()
  const query = useQuery({
    queryKey: ['data-files', dataFileId],
    queryFn: () => fetchDataFile(dataFileId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading data file…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load data file. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Data file not found</PageTitle>
        <p className="mt-3 text-muted">There is no data file at this address.</p>
      </>
    )
  }

  return <DataFileDetails file={query.data} />
}
