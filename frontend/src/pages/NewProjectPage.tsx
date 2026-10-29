import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { ProjectForm } from '../components/ProjectForm'
import { DuplicateCodeError, refusal } from '../forms'
import { NewIcon } from '../icons'

type ProjectCreate = components['schemas']['ProjectCreate']

async function createProject(body: ProjectCreate) {
  const { data, response } = await api.POST('/api/v1/projects', { body })
  if (data) {
    return data
  }
  if (response.status === 409) {
    throw new DuplicateCodeError(`A project with the code ${body.code} already exists.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not create the project. Please try again later.')
}

export default function NewProjectPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await navigate(`/projects/${encodeURIComponent(project.code)}`)
    },
  })

  return (
    <>
      <Breadcrumbs items={[{ label: 'Projects', to: '/projects' }, { label: 'New project' }]} />
      <PageTitle>New project</PageTitle>

      <ProjectForm
        initial={{
          code: '',
          name: '',
          description: null,
          source_repository: null,
          licence: null,
          citation: null,
        }}
        withCode
        submitLabel="Create project"
        submitIcon={NewIcon}
        pendingLabel="Creating…"
        cancelTo="/projects"
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
