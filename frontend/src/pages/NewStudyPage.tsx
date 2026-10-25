import { SquarePlus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { TextAreaField, TextField } from '../components/FormFields'
import { PageTitle } from '../components/PageTitle'
import { codePattern, optionalText, text } from '../forms'
import { errorBox, primaryButton, textLink } from '../styles'

type StudyCreate = components['schemas']['StudyCreate']

class DuplicateCodeError extends Error {}

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
  throw new Error('Could not create the study. Please try again later.')
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

  const codeError =
    mutation.error instanceof DuplicateCodeError
      ? 'This code is already in use. Please choose another.'
      : undefined

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

      <form
        className="mt-6 max-w-2xl space-y-5"
        onChange={() => {
          if (mutation.isError) {
            mutation.reset()
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          mutation.mutate({
            code: text(form, 'code'),
            title: text(form, 'title'),
            description: optionalText(form, 'description'),
          })
        }}
      >
        <TextField
          label="Code"
          name="code"
          hint="A short identifier, unique within this project, such as RNASEQ. Letters, digits, dots, dashes and underscores; it must start with a letter or digit."
          error={codeError}
          required
          maxLength={64}
          pattern={codePattern}
          autoComplete="off"
          mono
        />
        <TextField label="Title" name="title" required maxLength={200} />
        <TextAreaField label="Description" name="description" rows={4} optional />

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={`${primaryButton} inline-flex items-center gap-2`}
          >
            <SquarePlus aria-hidden="true" className="size-4 shrink-0" />
            {mutation.isPending ? 'Creating…' : 'Create study'}
          </button>
          <Link to={projectPath} className={textLink}>
            Cancel
          </Link>
        </div>

        {mutation.isError && (
          <p role="alert" className={errorBox}>
            {mutation.error.message}
          </p>
        )}
      </form>
    </>
  )
}
