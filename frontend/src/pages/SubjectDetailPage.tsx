import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { formatDate } from '../format'
import { subjectTypeLabel } from '../labels'
import { errorBox } from '../styles'

type Subject = components['schemas']['SubjectRead']

// An address that isn't a valid ID (422) is treated like an unknown one (404).
async function fetchSubject(subjectId: string) {
  const { data, response } = await api.GET('/api/v1/subjects/{subject_id}', {
    params: { path: { subject_id: subjectId } },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!data) {
    throw new Error('Could not load subject')
  }
  return data
}

function SubjectDetails({ subject }: { subject: Subject }) {
  const projectPath = `/projects/${encodeURIComponent(subject.project_code)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(subject.study_code)}`
  const attributes = Object.entries(subject.attributes)

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
      <PageTitle label="Subject">{subject.name}</PageTitle>

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

      <h2 className="mt-10 text-xl font-semibold">Attributes</h2>
      {attributes.length === 0 ? (
        <p className="mt-4 text-muted">No attributes recorded.</p>
      ) : (
        <DetailList
          items={attributes.map(([key, value]): [string, string] => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
          ])}
        />
      )}
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
