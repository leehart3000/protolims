import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { TextAreaField, TextField } from '../components/FormFields'
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
    throw new DuplicateCodeError(`A study with the code ${body.code} already exists.`)
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
  const mutation = useMutation({
    mutationFn: (body: StudyCreate) => createStudy(projectCode, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', projectCode, 'studies'] })
      await navigate(projectPath)
    },
  })

  const codeError =
    mutation.error instanceof DuplicateCodeError
      ? 'This code is already in use. Please choose another.'
      : undefined

  return (
    <>
      <p className="mb-6 text-sm">
        <Link to={projectPath} className={textLink}>
          ← Back to project
        </Link>
      </p>
      <h1 className="text-2xl font-semibold sm:text-3xl">New study</h1>
      <p className="mt-2 text-muted">
        In project <span className="font-mono">{projectCode}</span>
      </p>

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
          hint="Study codes are unique across all projects, so they start with the project code, for example TCGA-BRCA-RNASEQ."
          error={codeError}
          defaultValue={`${projectCode}-`}
          required
          maxLength={64}
          pattern={codePattern}
          autoComplete="off"
          mono
        />
        <TextField label="Title" name="title" required maxLength={200} />
        <TextAreaField label="Description" name="description" rows={4} optional />

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={mutation.isPending} className={primaryButton}>
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
