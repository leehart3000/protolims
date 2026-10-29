import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { StudyForm } from '../components/StudyForm'
import { DuplicateCodeError, refusal } from '../forms'
import { NewIcon } from '../icons'

type StudyCreate = components['schemas']['StudyCreate']

async function createStudy(projectCode: string, body: StudyCreate) {
  const { data, response } = await api.POST('/api/v1/projects/{project_code}/studies', {
    params: { path: { project_code: projectCode } },
    body,
  })
  if (data) {
    return data
  }
  if (response.status === 409) {
    throw new DuplicateCodeError(
      `A study with the code ${body.code} already exists in this project.`,
    )
  }
  if (response.status === 404) {
    throw new Error(`There is no project with the code ${projectCode}.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not create the study. Please try again later.')
}

export default function NewStudyPage() {
  const { code: projectCode = '' } = useParams()
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const project = useQuery({
    queryKey: ['projects', projectCode],
    queryFn: () => fetchProject(projectCode),
  })
  const mutation = useMutation({
    mutationFn: (body: StudyCreate) => createStudy(projectCode, body),
    onSuccess: async (study) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', projectCode, 'studies'] })
      await queryClient.invalidateQueries({ queryKey: ['studies'] })
      await navigate(`${projectPath}/studies/${encodeURIComponent(study.code)}`)
    },
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: projectPath, mono: true },
          { label: 'New study' },
        ]}
      />
      <PageTitle>New study</PageTitle>
      <DetailList
        items={[
          ['Project', project.data?.name ?? null],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      <StudyForm
        initial={{ code: '', title: '', description: null, design_factors: [] }}
        withCode
        submitLabel="Create study"
        submitIcon={NewIcon}
        pendingLabel="Creating…"
        cancelTo={projectPath}
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
