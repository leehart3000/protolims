import { SquarePlus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { TextAreaField, TextField } from '../components/FormFields'
import { codePattern, optionalText, text } from '../forms'
import { errorBox, primaryButton, textLink } from '../styles'

type ProjectCreate = components['schemas']['ProjectCreate']

class DuplicateCodeError extends Error {}

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
  throw new Error('Could not create the project. Please try again later.')
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

  const codeError =
    mutation.error instanceof DuplicateCodeError
      ? 'This code is already in use. Please choose another.'
      : undefined

  return (
    <>
      <Breadcrumbs items={[{ label: 'Projects', to: '/projects' }, { label: 'New project' }]} />
      <PageTitle>New project</PageTitle>

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
            name: text(form, 'name'),
            description: optionalText(form, 'description'),
            source_repository: optionalText(form, 'source_repository'),
            licence: optionalText(form, 'licence'),
            citation: optionalText(form, 'citation'),
          })
        }}
      >
        <TextField
          label="Code"
          name="code"
          hint="A short, unique identifier such as TCGA-BRCA. Letters, digits, dots, dashes and underscores; it must start with a letter or digit."
          error={codeError}
          required
          maxLength={64}
          pattern={codePattern}
          autoComplete="off"
          mono
        />
        <TextField label="Name" name="name" required maxLength={200} />
        <TextAreaField label="Description" name="description" rows={4} optional />
        <TextField
          label="Source repository"
          name="source_repository"
          hint="Where the data comes from, such as GDC, PDC or LINCS."
          optional
        />
        <TextField label="Licence" name="licence" hint="For example, CC BY 4.0." optional />
        <TextField label="Citation" name="citation" optional />

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={`${primaryButton} inline-flex items-center gap-2`}
          >
            <SquarePlus aria-hidden="true" className="size-4 shrink-0" />
            {mutation.isPending ? 'Creating…' : 'Create project'}
          </button>
          <Link to="/projects" className={textLink}>
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
