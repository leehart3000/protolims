import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { components } from '../api/schema'
import { fetchSubject, fetchSubjectAssays, fetchSubjectDataFiles } from '../api/queries'
import { assaysWithWideFiles } from '../assayWideFiles'
import { AssayWideFiles } from '../components/AssayWideFiles'
import { DetailsCard } from '../components/DetailsCard'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { KeyValueList } from '../components/KeyValueList'
import { SampleAssayTable } from '../components/SampleAssayTable'
import { SampleDataFileTable } from '../components/SampleDataFileTable'
import { SampleList } from '../components/SampleList'
import { formatDate } from '../format'
import { subjectTypeLabel } from '../labels'
import { errorBox } from '../styles'
import { editorOf } from '../permissions'
import { SectionHeading } from '../components/SectionHeading'
import { AssayIcon, DataFileIcon, SampleIcon, SubjectIcon } from '../icons'

type Subject = components['schemas']['SubjectRead']

// The assays the subject's samples (derived ones included) were measured in.
function SubjectAssays({ subjectId }: { subjectId: string }) {
  const query = useQuery({
    queryKey: ['subjects', subjectId, 'assays'],
    queryFn: () => fetchSubjectAssays(subjectId),
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
    return (
      <p className="mt-4 text-muted">
        None of this subject's samples have been measured in an assay yet.
      </p>
    )
  }

  return <SampleAssayTable assays={query.data} />
}

// The files the subject's samples are in: those they're linked to, and those of their assays
// that hold the data of all the assay's samples.
function SubjectDataFiles({ subjectId }: { subjectId: string }) {
  const query = useQuery({
    queryKey: ['subjects', subjectId, 'data-files'],
    queryFn: () => fetchSubjectDataFiles(subjectId),
  })
  const assays = useQuery({
    queryKey: ['subjects', subjectId, 'assays'],
    queryFn: () => fetchSubjectAssays(subjectId),
  })

  if (query.isPending || assays.isPending) {
    return <p className="mt-4 text-muted">Loading data files…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load data files. Please try again later.
      </p>
    )
  }

  const linked = query.data
  const throughAssays = assays.data ?? []
  if (linked.length === 0 && assaysWithWideFiles(throughAssays).length === 0) {
    return <p className="mt-4 text-muted">None of this subject's samples are in data files yet.</p>
  }

  return (
    <>
      {linked.length > 0 && <SampleDataFileTable files={linked} />}
      <AssayWideFiles assays={throughAssays} also={linked.length > 0} />
    </>
  )
}

function SubjectDetails({ subject }: { subject: Subject }) {
  const projectPath = `/projects/${encodeURIComponent(subject.project_code)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(subject.study_code)}`

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: subject.project_code, to: projectPath, mono: true },
          {
            label: 'Studies',
            to: `/studies?project=${encodeURIComponent(subject.project_code)}`,
          },
          { label: subject.study_code, to: studyPath, mono: true },
          { label: subject.name },
        ]}
      />
      <PageTitle icon={SubjectIcon} label="Subject">
        {subject.name}
      </PageTitle>

      <DetailsCard
        editTo={`/subjects/${subject.id}/edit`}
        editLabel="Edit subject"
        editNeed={editorOf(subject.project_code, subject.study_code)}
      >
        <DetailList
          items={[
            ['Type', subjectTypeLabel(subject.subject_type)],
            ['Species', subject.species && <span className="italic">{subject.species}</span>],
            [
              'External ID',
              subject.external_id && <span className="font-mono">{subject.external_id}</span>,
            ],
            ['Study code', <span className="font-mono">{subject.study_code}</span>],
            ['Project code', <span className="font-mono">{subject.project_code}</span>],
            ['Created', formatDate(subject.created_at)],
          ]}
        />
      </DetailsCard>

      <h2 className="mt-10 text-xl font-semibold">Attributes</h2>
      <KeyValueList values={subject.attributes} emptyText="No attributes recorded." />

      <SectionHeading icon={SampleIcon} className="mt-10">
        Samples
      </SectionHeading>
      <SampleList
        projectCode={subject.project_code}
        studyCode={subject.study_code}
        subjectId={subject.id}
        emptyText="No samples from this subject yet."
      />
      <SectionHeading icon={AssayIcon} className="mt-10">
        Assays
      </SectionHeading>
      <SubjectAssays subjectId={subject.id} />
      <SectionHeading icon={DataFileIcon} className="mt-10">
        Data files
      </SectionHeading>
      <SubjectDataFiles subjectId={subject.id} />
    </>
  )
}

export default function SubjectDetailPage() {
  const { subjectId = '' } = useParams()
  const query = useQuery({
    queryKey: ['subjects', subjectId],
    queryFn: () => fetchSubject(subjectId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading subject…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load subject. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Subject not found</PageTitle>
        <p className="mt-3 text-muted">There is no subject at this address.</p>
      </>
    )
  }

  return <SubjectDetails subject={query.data} />
}
