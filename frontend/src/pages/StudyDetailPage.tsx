import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { formatDate } from '../format'
import { errorBox, textLink } from '../styles'

type Study = components['schemas']['StudyRead']

async function fetchStudy(projectCode: string, studyCode: string) {
  const { data, response } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}', {
    params: { path: { project_code: projectCode, study_code: studyCode } },
  })
  if (response.status === 404) {
    return null
  }
  if (!data) {
    throw new Error('Could not load study')
  }
  return data
}

function StudyDetails({ projectCode, study }: { projectCode: string; study: Study }) {
  return (
    <>
      <p className="font-mono text-sm text-muted">
        {projectCode} / {study.code}
      </p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{study.title}</h1>
      {study.description && <p className="mt-3 max-w-3xl text-muted">{study.description}</p>}

      <dl className="mt-6 space-y-2 text-sm">
        <div className="sm:flex sm:gap-6">
          <dt className="text-muted sm:w-40 sm:shrink-0">Created</dt>
          <dd>{formatDate(study.created_at)}</dd>
        </div>
      </dl>

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
        <h1 className="text-2xl font-semibold sm:text-3xl">Study not found</h1>
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
      <p className="mb-6 text-sm">
        <Link to={`/projects/${encodeURIComponent(projectCode)}`} className={textLink}>
          ← Back to project
        </Link>
      </p>
      <StudyContent projectCode={projectCode} studyCode={studyCode} />
    </>
  )
}
