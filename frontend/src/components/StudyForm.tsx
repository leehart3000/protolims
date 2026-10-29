import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { codePattern, DuplicateCodeError, optionalText, text } from '../forms'
import type { StudyDetails } from '../studies'
import { errorBox, primaryButton, textLink } from '../styles'
import { DesignFactorsEditor, type FactorRow } from './DesignFactorsEditor'
import { TextAreaField, TextField } from './FormFields'

// The form for a new study or for changing one. A study's code can only be set when it's
// created, as it's part of the study's address.
export function StudyForm({
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
  initial: StudyDetails
  withCode: boolean
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: StudyDetails) => void
  onEdit: () => void
}) {
  const [factors, setFactors] = useState<FactorRow[]>(() =>
    initial.design_factors.map((factor, index) => ({
      key: index,
      name: factor.name,
      description: factor.description ?? '',
    })),
  )

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
          title: text(form, 'title'),
          description: optionalText(form, 'description'),
          design_factors: factors.map((factor) => ({
            name: factor.name.trim(),
            description: factor.description.trim() || null,
          })),
        })
      }}
    >
      {withCode && (
        <TextField
          label="Code"
          name="code"
          hint="A short identifier, unique within this project, such as RNASEQ. It can contain letters, digits, dots, dashes or underscores, and must start with a letter or digit. It can't be ‘new’ or ‘edit’, and it can't be changed later, as it's part of the study's web address."
          error={codeError}
          defaultValue={initial.code}
          required
          maxLength={64}
          pattern={codePattern}
          autoComplete="off"
          mono
        />
      )}
      <TextField label="Title" name="title" defaultValue={initial.title} required maxLength={300} />
      <TextAreaField
        label="Description"
        name="description"
        defaultValue={initial.description ?? ''}
        rows={4}
        optional
      />
      <DesignFactorsEditor rows={factors} onChange={setFactors} />

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
