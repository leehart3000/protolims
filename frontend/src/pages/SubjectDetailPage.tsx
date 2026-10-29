import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { components } from '../api/schema'
import { fetchSubject } from '../api/queries'
import { DetailsCard } from '../components/DetailsCard'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { KeyValueList } from '../components/KeyValueList'
import { SampleList } from '../components/SampleList'
import { formatDate } from '../format'
import { subjectTypeLabel } from '../labels'
import { errorBox } from '../styles'
import { editorOf } from '../permissions'
import { SectionHeading } from '../components/SectionHeading'
import { SampleIcon, SubjectIcon } from '../icons'

type Subject = components['schemas']['SubjectRead']

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
