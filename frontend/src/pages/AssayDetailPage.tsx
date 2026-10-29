import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { type AssaySampleSort, fetchAssay, fetchAssaySamplePage } from '../api/queries'
import type { components } from '../api/schema'
import { LinkedSampleTable } from '../components/LinkedSampleTable'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataFileList } from '../components/DataFileList'
import { DetailList } from '../components/DetailList'
import { DetailsCard } from '../components/DetailsCard'
import { KeyValueList } from '../components/KeyValueList'
import { NewButton } from '../components/NewButton'
import { PageTitle } from '../components/PageTitle'
import { PagedTable } from '../components/PagedTable'
import { SearchBox } from '../components/SearchBox'
import { SectionHeading } from '../components/SectionHeading'
import { formatDate } from '../format'
import { editorOf } from '../permissions'
import { errorBox } from '../styles'
import { useListControls } from '../useListControls'
import { AssayIcon, DataFileIcon, SampleIcon } from '../icons'

type Assay = components['schemas']['AssayRead']

function AssaySampleList({ assayId }: { assayId: string }) {
  const controls = useListControls<AssaySampleSort>('name')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['assays', assayId, 'samples', { q, sort, offset, limit }],
    queryFn: () => fetchAssaySamplePage(assayId, { q: q || undefined, sort, limit, offset }),
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
          id="assay-sample-search"
          label="Search samples"
          placeholder="Search by name or external ID"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">
          {q ? `No samples match “${q}”.` : 'No samples linked to this assay yet.'}
        </p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <LinkedSampleTable samples={items} sort={sort} onSort={changeSort} />
        </PagedTable>
      )}
    </>
  )
}

function AssayDetails({ assay }: { assay: Assay }) {
  const projectPath = `/projects/${encodeURIComponent(assay.project_code)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(assay.study_code)}`
  const newFilePath = `${studyPath}/data-files/new?assay=${assay.id}`
  const editing = editorOf(assay.project_code, assay.study_code)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: assay.project_code, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(assay.project_code)}` },
          { label: assay.study_code, to: studyPath, mono: true },
          { label: assay.name },
        ]}
      />
      <PageTitle icon={AssayIcon} label="Assay">
        {assay.name}
      </PageTitle>

      <DetailsCard editTo={`/assays/${assay.id}/edit`} editLabel="Edit assay" editNeed={editing}>
        <DetailList
          items={[
            ['Measurement type', assay.measurement_type],
            ['Technology type', assay.technology_type],
            ['Platform', assay.platform],
            ['Performed', assay.performed_at && formatDate(assay.performed_at)],
            [
              'External ID',
              assay.external_id && <span className="font-mono">{assay.external_id}</span>,
            ],
            ['Study code', <span className="font-mono">{assay.study_code}</span>],
            ['Project code', <span className="font-mono">{assay.project_code}</span>],
            ['Created', formatDate(assay.created_at)],
          ]}
        />
      </DetailsCard>

      <h2 className="mt-10 text-xl font-semibold">Parameters</h2>
      <KeyValueList values={assay.parameters} emptyText="No parameters recorded." />

      <SectionHeading icon={SampleIcon} className="mt-10">
        Samples
      </SectionHeading>
      <AssaySampleList assayId={assay.id} />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionHeading icon={DataFileIcon}>Data files</SectionHeading>
        <NewButton need={editing} to={newFilePath}>
          New data file
        </NewButton>
      </div>
      <DataFileList
        projectCode={assay.project_code}
        studyCode={assay.study_code}
        assayId={assay.id}
        emptyText="No data files from this assay yet."
      />
      <p className="mt-4">
        <NewButton need={editing} align="start" to={newFilePath}>
          New data file
        </NewButton>
      </p>
    </>
  )
}

export default function AssayDetailPage() {
  const { assayId = '' } = useParams()
  const query = useQuery({
    queryKey: ['assays', assayId],
    queryFn: () => fetchAssay(assayId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading assay…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load assay. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Assay not found</PageTitle>
        <p className="mt-3 text-muted">There is no assay at this address.</p>
      </>
    )
  }

  return <AssayDetails assay={query.data} />
}
