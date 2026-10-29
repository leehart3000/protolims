import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { ProjectForm } from '../components/ProjectForm'
import type { ProjectDetails } from '../projects'
import { refusal } from '../forms'
import { errorBox } from '../styles'
import { ProjectIcon, SaveIcon } from '../icons'

type Project = components['schemas']['ProjectRead']
type ProjectUpdate = components['schemas']['ProjectUpdate']

async function updateProject(code: string, body: ProjectUpdate) {
  const { data, response } = await api.PATCH('/api/v1/projects/{code}', {
    params: { path: { code } },
    body,
  })
  if (data) {
    return data
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not save the changes. Please try again later.')
}

// Only the fields that were changed are sent. The code never changes.
function changedFields(initial: ProjectDetails, values: ProjectDetails): ProjectUpdate {
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => key !== 'code' && value !== initial[key as keyof ProjectDetails],
    ),
  )
  return body
}

function EditProject({ project }: { project: Project }) {
  const projectPath = `/projects/${encodeURIComponent(project.code)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initial: ProjectDetails = {
    code: project.code,
    name: project.name,
    description: project.description,
    source_repository: project.source_repository,
    licence: project.licence,
    citation: project.citation,
  }
  const mutation = useMutation({
    mutationFn: (values: ProjectDetails) =>
      updateProject(project.code, changedFields(initial, values)),
    onSuccess: async () => {
      // The Studies list shows project names, so it's refreshed too.
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['studies'] })
      await navigate(projectPath)
    },
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: project.code, to: projectPath, mono: true },
          { label: 'Edit' },
        ]}
      />
      <PageTitle icon={ProjectIcon} label="Edit project">
        {project.name}
      </PageTitle>

      <ProjectForm
        initial={initial}
        withCode={false}
        submitLabel="Save changes"
        submitIcon={SaveIcon}
        pendingLabel="Saving…"
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

export default function EditProjectPage() {
  const { code = '' } = useParams()
  const query = useQuery({ queryKey: ['projects', code], queryFn: () => fetchProject(code) })

  if (query.isPending) {
    return <p className="text-muted">Loading project…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load project. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Project not found</PageTitle>
        <p className="mt-3 text-muted">
          There is no project with the code <span className="font-mono">{code}</span>.
        </p>
      </>
    )
  }

  return <EditProject project={query.data} />
}
