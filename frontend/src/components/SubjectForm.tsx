import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { DuplicateNameError, externalIdError, namePattern, optionalText, text } from '../forms'
import { type SubjectType, subjectTypeOptions } from '../labels'
import { errorBox, primaryButton, textLink } from '../styles'
import type { SubjectDetails, SubjectFormValues } from '../subjects'
import { SelectField, TextField } from './FormFields'

// The form for a new subject or for changing one.
export function SubjectForm({
  initial,
  submitLabel,
  submitIcon: SubmitIcon,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
  onEdit,
}: {
  initial: SubjectFormValues
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: SubjectDetails) => void
  onEdit: () => void
}) {
  const nameError =
    error instanceof DuplicateNameError
      ? 'This name is already used in this study. Please choose another.'
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
          name: text(form, 'name'),
          subject_type: text(form, 'subject_type') as SubjectType,
          species: optionalText(form, 'species'),
          external_id: optionalText(form, 'external_id'),
        })
      }}
    >
      <TextField
        label="Name"
        name="name"
        hint="The name used by the study or its source, such as TCGA-A1-A0SB or Hs 578T. Spaces are allowed; slashes are not."
        error={nameError}
        defaultValue={initial.name}
        required
        maxLength={200}
        pattern={namePattern}
        autoComplete="off"
      />
      <SelectField
        label="Type"
        name="subject_type"
        options={subjectTypeOptions}
        defaultValue={initial.subject_type}
        required
      />
      <TextField
        label="Species"
        name="species"
        hint="For example, Homo sapiens."
        defaultValue={initial.species ?? ''}
        maxLength={200}
        optional
      />
      <TextField
        label="External ID"
        name="external_id"
        hint="The subject's ID in its source repository, such as a GDC case UUID."
        error={externalIdError(error)}
        defaultValue={initial.external_id ?? ''}
        maxLength={200}
        autoComplete="off"
        optional
        mono
      />

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
