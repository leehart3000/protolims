import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { fetchProject, fetchSamples, fetchStudy, fetchSubjects } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { NewButton } from '../components/NewButton'
import { PageTitle } from '../components/PageTitle'
import { SampleTable } from '../components/SampleTable'
import { SectionHeading } from '../components/SectionHeading'
import { SubjectTable } from '../components/SubjectTable'
import { formatDate } from '../format'
import { errorBox } from '../styles'

type Study = components['schemas']['StudyRead']

function SubjectList({ projectCode, studyCode }: { projectCode: string; studyCode: string }) {
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'subjects'],
    queryFn: () => fetchSubjects(projectCode, studyCode),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading subjects…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load subjects. Please try again later.
      </p>
    )
  }

  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">No subjects in this study yet.</p>
  }

  return <SubjectTable subjects={query.data} />
}

function SampleList({ projectCode, studyCode }: { projectCode: string; studyCode: string }) {
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'samples'],
    queryFn: () => fetchSamples(projectCode, studyCode),
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

  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">No samples in this study yet.</p>
  }

  return <SampleTable samples={query.data} />
}

function StudyDetails({ projectCode, study }: { projectCode: string; study: Study }) {
  const project = useQuery({
    queryKey: ['projects', projectCode],
    queryFn: () => fetchProject(projectCode),
  })
  const studyPath = `/projects/${encodeURIComponent(projectCode)}/studies/${encodeURIComponent(study.code)}`

  return (
    <>
      <PageTitle label="Study">{study.title}</PageTitle>
      {study.description && <p className="mt-3 max-w-3xl text-muted">{study.description}</p>}

      <DetailList
        items={[
          ['Study code', <span className="font-mono">{study.code}</span>],
          ['Created', formatDate(study.created_at)],
          ['Project', project.data?.name ?? null],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      <h2 className="mt-10 text-xl font-semibold">Design factors</h2>
      {study.design_factors.length === 0 ? (
        <p className="mt-4 text-muted">No design factors recorded.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {study.design_factors.map((factor, index) => (
            <li key={`${String(index)}-${factor.name}`}>
              <span className="font-medium">{factor.name}</span>
              {factor.description && <span className="text-muted"> – {factor.description}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionHeading>Subjects</SectionHeading>
        <NewButton to={`${studyPath}/subjects/new`}>New subject</NewButton>
      </div>
      <SubjectList projectCode={projectCode} studyCode={study.code} />
      <p className="mt-4">
        <NewButton to={`${studyPath}/subjects/new`}>New subject</NewButton>
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionHeading>Samples</SectionHeading>
        <NewButton to={`${studyPath}/samples/new`}>New sample</NewButton>
      </div>
      <SampleList projectCode={projectCode} studyCode={study.code} />
      <p className="mt-4">
        <NewButton to={`${studyPath}/samples/new`}>New sample</NewButton>
      </p>
    </>
  )
}

function StudyContent({ projectCode, studyCode }: { projectCode: string; studyCode: string }) {
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode],
    queryFn: () => fetchStudy(projectCode, studyCode),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading study…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load study. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Study not found</PageTitle>
        <p className="mt-3 text-muted">
          There is no study with the code <span className="font-mono">{studyCode}</span> in project{' '}
          <span className="font-mono">{projectCode}</span>.
        </p>
      </>
    )
  }

  return <StudyDetails projectCode={projectCode} study={query.data} />
}

export default function StudyDetailPage() {
  const { code: projectCode = '', studyCode = '' } = useParams()

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: `/projects/${encodeURIComponent(projectCode)}`, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: studyCode, mono: true },
        ]}
      />
      <StudyContent projectCode={projectCode} studyCode={studyCode} />
    </>
  )
}
