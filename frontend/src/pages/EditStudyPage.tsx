import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchStudy } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { StudyForm } from '../components/StudyForm'
import type { StudyDetails } from '../studies'
import { refusal } from '../forms'
import { errorBox } from '../styles'
import { SaveIcon } from '../icons'

type Study = components['schemas']['StudyRead']
type StudyUpdate = components['schemas']['StudyUpdate']

async function updateStudy(projectCode: string, studyCode: string, body: StudyUpdate) {
  const { data, response } = await api.PATCH(
    '/api/v1/projects/{project_code}/studies/{study_code}',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not save the changes. Please try again later.')
}

// Only the fields that were changed are sent.
function changedFields(study: Study, values: StudyDetails): StudyUpdate {
  const body: StudyUpdate = {}
  if (values.title !== study.title) {
    body.title = values.title
  }
  if (values.description !== study.description) {
    body.description = values.description
  }
  if (JSON.stringify(values.design_factors) !== JSON.stringify(study.design_factors)) {
    body.design_factors = values.design_factors
  }
  return body
}

function EditStudy({ projectCode, study }: { projectCode: string; study: Study }) {
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(study.code)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: StudyDetails) =>
      updateStudy(projectCode, study.code, changedFields(study, values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', projectCode, 'studies'] })
      await queryClient.invalidateQueries({ queryKey: ['studies'] })
      await navigate(studyPath)
    },
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: study.code, to: studyPath, mono: true },
          { label: 'Edit' },
        ]}
      />
      <PageTitle label="Edit study">{study.title}</PageTitle>

      <StudyForm
        initial={{
          code: study.code,
          title: study.title,
          description: study.description,
          design_factors: study.design_factors,
        }}
        withCode={false}
        submitLabel="Save changes"
        submitIcon={SaveIcon}
        pendingLabel="Saving…"
        cancelTo={studyPath}
        isPending={mutation.isPending}
        error={mutation.error}
        onEdit={mutation.reset}
        onSubmit={(values) => {
          mutation.mutate(values)
        }}
      />
    </>
  )
}

export default function EditStudyPage() {
  const { code: projectCode = '', studyCode = '' } = useParams()
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

  return <EditStudy projectCode={projectCode} study={query.data} />
}
