import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { AssayFormValues } from '../assays'
import { DuplicateNameError, namePattern, optionalText, text } from '../forms'
import { errorBox, primaryButton, textLink } from '../styles'
import { TextField } from './FormFields'

const measurementSuggestions = [
  'transcription profiling',
  'protein expression profiling',
  'genome sequencing',
  'DNA methylation profiling',
  'metabolite profiling',
]

const technologySuggestions = [
  'nucleotide sequencing',
  'mass spectrometry',
  'DNA microarray',
  'NMR spectroscopy',
]

// The form for a new assay or for changing one.
export function AssayForm({
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
  initial: AssayFormValues
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: AssayFormValues) => void
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
          measurement_type: text(form, 'measurement_type'),
          technology_type: text(form, 'technology_type'),
          platform: optionalText(form, 'platform'),
          performed_on: optionalText(form, 'performed_on'),
          external_id: optionalText(form, 'external_id'),
        })
      }}
    >
      <TextField
        label="Name"
        name="name"
        hint="The name used by the study or its source, such as an experiment or run name. Spaces are allowed; slashes are not."
        error={nameError}
        defaultValue={initial.name}
        required
        maxLength={200}
        pattern={namePattern}
        autoComplete="off"
      />
      <TextField
        label="Measurement type"
        name="measurement_type"
        hint="What was measured, such as transcription profiling. Choose a suggestion or type your own."
        defaultValue={initial.measurement_type}
        required
        maxLength={100}
        list="measurement-suggestions"
        autoComplete="off"
      />
      <datalist id="measurement-suggestions">
        {measurementSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <TextField
        label="Technology type"
        name="technology_type"
        hint="How it was measured, such as nucleotide sequencing or mass spectrometry. Choose a suggestion or type your own."
        defaultValue={initial.technology_type}
        required
        maxLength={100}
        list="technology-suggestions"
        autoComplete="off"
      />
      <datalist id="technology-suggestions">
        {technologySuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <TextField
        label="Platform"
        name="platform"
        hint="The instrument, such as Illumina HiSeq 2000."
        defaultValue={initial.platform ?? ''}
        maxLength={200}
        autoComplete="off"
        optional
      />
      <TextField
        label="Performed"
        name="performed_on"
        type="date"
        defaultValue={initial.performed_on ?? ''}
        optional
      />
      <TextField
        label="External ID"
        name="external_id"
        hint="The assay's ID in its source repository."
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
