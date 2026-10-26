import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { codePattern, DuplicateCodeError, optionalText, text } from '../forms'
import type { ProjectDetails } from '../projects'
import { errorBox, primaryButton, textLink } from '../styles'
import { TextAreaField, TextField } from './FormFields'

// The form for a new project or for changing one. A project's code can only be set when it's
// created, as it's part of the project's address and its studies'.
export function ProjectForm({
  initial,
  withCode,
  submitLabel,
  submitIcon: SubmitIcon,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
  onEdit,
}: {
  initial: ProjectDetails
  withCode: boolean
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: ProjectDetails) => void
  onEdit: () => void
}) {
  const codeError =
    error instanceof DuplicateCodeError
      ? 'This code is already in use. Please choose another.'
      : undefined

  return (
    <form
      className="mt-6 max-w-2xl space-y-5"
      onChange={() => {
        if (error) {
          onEdit()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        onSubmit({
          code: withCode ? text(form, 'code') : initial.code,
          name: text(form, 'name'),
          description: optionalText(form, 'description'),
          source_repository: optionalText(form, 'source_repository'),
          licence: optionalText(form, 'licence'),
          citation: optionalText(form, 'citation'),
        })
      }}
    >
      {withCode && (
        <TextField
          label="Code"
          name="code"
          hint="A short, unique identifier such as TCGA-BRCA. Letters, digits, dots, dashes and underscores; it must start with a letter or digit."
          error={codeError}
          defaultValue={initial.code}
          required
          maxLength={64}
          pattern={codePattern}
          autoComplete="off"
          mono
        />
      )}
      <TextField label="Name" name="name" defaultValue={initial.name} required maxLength={200} />
      <TextAreaField
        label="Description"
        name="description"
        defaultValue={initial.description ?? ''}
        rows={4}
        optional
      />
      <TextField
        label="Source repository"
        name="source_repository"
        hint="Where the data comes from, such as GDC, PDC or LINCS."
        defaultValue={initial.source_repository ?? ''}
        optional
      />
      <TextField
        label="Licence"
        name="licence"
        hint="For example, CC BY 4.0."
        defaultValue={initial.licence ?? ''}
        optional
      />
      <TextField label="Citation" name="citation" defaultValue={initial.citation ?? ''} optional />

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className={`${primaryButton} inline-flex items-center gap-2`}
        >
          <SubmitIcon aria-hidden="true" className="size-4 shrink-0" />
          {isPending ? pendingLabel : submitLabel}
        </button>
        <Link to={cancelTo} className={textLink}>
          Cancel
        </Link>
      </div>

      {error && (
        <p role="alert" className={errorBox}>
          {error.message}
        </p>
      )}
    </form>
  )
}
