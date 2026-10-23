import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'

type ProjectCreate = components['schemas']['ProjectCreate']

const inputClass =
  'mt-1.5 block w-full rounded-md border border-line bg-panel px-3 py-2 focus:outline-2 focus:outline-offset-1 focus:outline-link'

async function createProject(body: ProjectCreate) {
  const { data, response } = await api.POST('/api/v1/projects', { body })
  if (data) {
    return data
  }
  if (response.status === 409) {
    throw new Error(`A project with the code ${body.code} already exists.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw new Error('Could not create the project. Please try again later.')
}

function text(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(form: FormData, name: string) {
  return text(form, name) || null
}

function FieldLabel({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string
  label: string
  optional?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium">
      {label}
      {optional && <span className="font-normal text-muted"> (optional)</span>}
    </label>
  )
}

function TextField({
  label,
  name,
  hint,
  optional,
  ...inputProps
}: {
  label: string
  name: string
  hint?: string
  optional?: boolean
} & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = `${name}-hint`
  return (
    <div>
      <FieldLabel htmlFor={name} label={label} optional={optional} />
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        aria-describedby={hint ? hintId : undefined}
        className={inputClass}
        {...inputProps}
      />
    </div>
  )
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
      <p className="mb-6 text-sm">
        <Link to="/projects" className="text-link underline hover:no-underline">
          ← All projects
        </Link>
      </p>
      <h1 className="text-2xl font-semibold sm:text-3xl">New project</h1>

      <form
        className="mt-6 max-w-2xl space-y-5"
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
        {mutation.isError && (
          <p role="alert" className="rounded-lg border border-line bg-panel px-4 py-3">
            {mutation.error.message}
          </p>
        )}

        <TextField
          label="Code"
          name="code"
          hint="A short, unique identifier such as TCGA-BRCA. Letters, digits, dots, dashes and underscores; it must start with a letter or digit."
          required
          maxLength={64}
          pattern="[A-Za-z0-9][A-Za-z0-9._\-]*"
          autoComplete="off"
          className={`${inputClass} font-mono`}
        />
        <TextField label="Name" name="name" required maxLength={200} />

        <div>
          <FieldLabel htmlFor="description" label="Description" optional />
          <textarea id="description" name="description" rows={4} className={inputClass} />
        </div>

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
            className="rounded-md bg-cobalt px-4 py-2 font-medium text-white hover:bg-cobalt/90 disabled:opacity-60"
          >
            {mutation.isPending ? 'Creating…' : 'Create project'}
          </button>
          <Link to="/projects" className="text-link underline hover:no-underline">
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}
