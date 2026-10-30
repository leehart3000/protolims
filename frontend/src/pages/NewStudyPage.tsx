import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject, fetchProjectPage } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { SelectField } from '../components/FormFields'
import { PageTitle } from '../components/PageTitle'
import { StudyForm } from '../components/StudyForm'
import { DuplicateCodeError, refusal } from '../forms'
import { NewIcon, StudyIcon } from '../icons'
import { roleOn } from '../permissions'
import { useMe } from '../useMe'
import { Permitted } from '../components/Permitted'

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

// The projects someone can add a study to: those they're an admin of.
function ProjectPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (projectCode: string) => void
}) {
  const { data: me } = useMe()
  const projects = useQuery({
    queryKey: ['projects', { sort: 'code', limit: 500 }],
    queryFn: () => fetchProjectPage({ sort: 'code', limit: 500, offset: 0 }),
  })

  if (projects.isPending || me === undefined) {
    return <p className="mt-6 text-muted">Loading projects…</p>
  }
  if (projects.isError) {
    return (
      <p role="alert" className="mt-6 text-danger">
        Could not load projects. Please try again later.
      </p>
    )
  }
  const allowed = projects.data.items.filter((project) => roleOn(me, project.code) === 'admin')
  if (allowed.length === 0) {
    return (
      // Only possible for a site administrator before any project exists: anyone else who
      // reaches the picker is an admin of at least one project.
      <p className="mt-6 text-muted">
        There are no projects to add a study to yet. Create a project first.
      </p>
    )
  }
  return (
    <div className="mt-6 max-w-2xl">
      <SelectField
        label="Project"
        name="project"
        hint="The project the study belongs to. It can't be changed later."
        options={allowed.map((project) => ({
          value: project.code,
          label: `${project.name} (${project.code})`,
        }))}
        value={value}
        required
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

// A new study: in the project it was opened from (/projects/:code/studies/new), or, from the
// list of all studies (/studies/new), in a project chosen here.
export default function NewStudyPage() {
  const { code } = useParams()
  const [chosen, setChosen] = useState('')
  const projectCode = code ?? chosen
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const project = useQuery({
    queryKey: ['projects', projectCode],
    queryFn: () => fetchProject(projectCode),
    enabled: code !== undefined,
  })
  const mutation = useMutation({
    mutationFn: (body: StudyCreate) => {
      if (projectCode === '') {
        throw new Error('Please choose the project the study belongs to.')
      }
      return createStudy(projectCode, body)
    },
    onSuccess: async (study) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', projectCode, 'studies'] })
      await queryClient.invalidateQueries({ queryKey: ['studies'] })
      await navigate(`${projectPath}/studies/${encodeURIComponent(study.code)}`)
    },
  })

  return (
    <>
      <Breadcrumbs
        items={
          code === undefined
            ? [{ label: 'Studies', to: '/studies' }, { label: 'New study' }]
            : [
                { label: 'Projects', to: '/projects' },
                { label: code, to: projectPath, mono: true },
                { label: 'New study' },
              ]
        }
      />
      <PageTitle icon={StudyIcon}>New study</PageTitle>
      <Permitted
        need={code === undefined ? { anyProjectAdmin: true } : { role: 'admin', project: code }}
      >
        {code === undefined ? (
          <ProjectPicker
            value={chosen}
            onChange={(next) => {
              setChosen(next)
              mutation.reset()
            }}
          />
        ) : (
          <DetailList
            items={[
              ['Project', project.data?.name ?? null],
              ['Project code', <span className="font-mono">{code}</span>],
            ]}
          />
        )}

        <StudyForm
          initial={{ code: '', title: '', description: null, design_factors: [] }}
          withCode
          submitLabel="Create study"
          submitIcon={NewIcon}
          pendingLabel="Creating…"
          cancelTo={code === undefined ? '/studies' : projectPath}
          isPending={mutation.isPending}
          error={mutation.error}
          onEdit={mutation.reset}
          onSubmit={(values) => {
            mutation.mutate(values)
          }}
        />
      </Permitted>
    </>
  )
}
