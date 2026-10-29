import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { fetchSample, fetchSampleAssays, fetchSampleDataFiles, fetchSamples } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { KeyValueList } from '../components/KeyValueList'
import { PageTitle } from '../components/PageTitle'
import { SampleTable } from '../components/SampleTable'
import { SampleAssayTable } from '../components/SampleAssayTable'
import { SampleDataFileTable } from '../components/SampleDataFileTable'
import { NewButton } from '../components/NewButton'
import { SectionHeading } from '../components/SectionHeading'
import { DetailsCard } from '../components/DetailsCard'
import { formatDate } from '../format'
import { editorOf } from '../permissions'
import { sampleStatusLabel } from '../labels'
import { errorBox, textLink } from '../styles'
import { AssayIcon, DataFileIcon, SampleIcon } from '../icons'

type Sample = components['schemas']['SampleRead']

function DerivedSamples({ sample }: { sample: Sample }) {
  const query = useQuery({
    queryKey: [
      'projects',
      sample.project_code,
      'studies',
      sample.study_code,
      'samples',
      { parent: sample.id },
    ],
    queryFn: () => fetchSamples(sample.project_code, sample.study_code, sample.id),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading derived samples…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load derived samples. Please try again later.
      </p>
    )
  }

  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">No samples have been derived from this one yet.</p>
  }

  return <SampleTable samples={query.data} label="Derived samples" />
}

function SampleAssays({ sampleId }: { sampleId: string }) {
  const query = useQuery({
    queryKey: ['samples', sampleId, 'assays'],
    queryFn: () => fetchSampleAssays(sampleId),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading assays…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load assays. Please try again later.
      </p>
    )
  }

  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">Not measured in any assays yet.</p>
  }

  return <SampleAssayTable assays={query.data} />
}

function SampleDataFiles({ sampleId }: { sampleId: string }) {
  const query = useQuery({
    queryKey: ['samples', sampleId, 'data-files'],
    queryFn: () => fetchSampleDataFiles(sampleId),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading data files…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load data files. Please try again later.
      </p>
    )
  }

  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">Not in any data files yet.</p>
  }

  return <SampleDataFileTable files={query.data} />
}

function SampleDetails({ sample }: { sample: Sample }) {
  const projectPath = `/projects/${encodeURIComponent(sample.project_code)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(sample.study_code)}`
  const derivedPath = `${studyPath}/samples/new?parent=${sample.id}`
  const editing = editorOf(sample.project_code, sample.study_code)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: sample.project_code, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(sample.project_code)}` },
          { label: sample.study_code, to: studyPath, mono: true },
          { label: sample.name },
        ]}
      />
      <PageTitle icon={SampleIcon} label="Sample">
        {sample.name}
      </PageTitle>

      <DetailsCard editTo={`/samples/${sample.id}/edit`} editLabel="Edit sample" editNeed={editing}>
        <DetailList
          items={[
            ['Material', sample.material_type],
            ['Status', sampleStatusLabel(sample.status)],
            ['Collected', sample.collected_at && formatDate(sample.collected_at)],
            [
              'Subject',
              sample.subject_id && (
                <Link to={`/subjects/${sample.subject_id}`} className={textLink}>
                  {sample.subject_name}
                </Link>
              ),
            ],
            [
              'Derived from',
              sample.parent_sample_id && (
                <Link to={`/samples/${sample.parent_sample_id}`} className={textLink}>
                  {sample.parent_sample_name}
                </Link>
              ),
            ],
            [
              'External ID',
              sample.external_id && <span className="font-mono">{sample.external_id}</span>,
            ],
            ['Study code', <span className="font-mono">{sample.study_code}</span>],
            ['Project code', <span className="font-mono">{sample.project_code}</span>],
            ['Created', formatDate(sample.created_at)],
          ]}
        />
      </DetailsCard>

      <h2 className="mt-10 text-xl font-semibold">Characteristics</h2>
      <KeyValueList values={sample.characteristics} emptyText="No characteristics recorded." />

      <h2 className="mt-10 text-xl font-semibold">Factor values</h2>
      <KeyValueList values={sample.factor_values} emptyText="No factor values recorded." />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionHeading icon={SampleIcon}>Derived samples</SectionHeading>
        <NewButton need={editing} to={derivedPath}>
          New derived sample
        </NewButton>
      </div>
      <DerivedSamples sample={sample} />
      <p className="mt-4">
        <NewButton need={editing} align="start" to={derivedPath}>
          New derived sample
        </NewButton>
      </p>
      <SectionHeading icon={AssayIcon} className="mt-10">
        Assays
      </SectionHeading>
      <SampleAssays sampleId={sample.id} />
      <SectionHeading icon={DataFileIcon} className="mt-10">
        Data files
      </SectionHeading>
      <SampleDataFiles sampleId={sample.id} />
    </>
  )
}

export default function SampleDetailPage() {
  const { sampleId = '' } = useParams()
  const query = useQuery({
    queryKey: ['samples', sampleId],
    queryFn: () => fetchSample(sampleId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading sample…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load sample. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Sample not found</PageTitle>
        <p className="mt-3 text-muted">There is no sample at this address.</p>
      </>
    )
  }

  return <SampleDetails sample={query.data} />
}
