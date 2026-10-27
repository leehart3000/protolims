import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { components } from '../api/schema'
import { DuplicateNameError, externalIdError, namePattern, optionalText, text } from '../forms'
import { type SampleStatus, sampleStatusOptions } from '../labels'
import type { SampleFormValues } from '../samples'
import { errorBox, primaryButton, textLink } from '../styles'
import { SelectField, TextField } from './FormFields'

type Sample = components['schemas']['SampleRead']
type Subject = components['schemas']['SubjectRead']

const materialSuggestions = ['tissue', 'blood', 'plasma', 'serum', 'cells', 'DNA', 'RNA', 'protein']

// The form for a new sample or for changing one. `samples` are the choices for "Derived from".
export function SampleForm({
  subjects,
  samples,
  parentHint,
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
  subjects: Subject[]
  samples: Sample[]
  parentHint?: string
  initial: SampleFormValues
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: SampleFormValues) => void
  onEdit: () => void
}) {
  const [parentId, setParentId] = useState(initial.parent_sample_id ?? '')
  const [subjectId, setSubjectId] = useState(initial.subject_id ?? '')

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
          material_type: text(form, 'material_type'),
          status: text(form, 'status') as SampleStatus,
          subject_id: subjectId || null,
          parent_sample_id: parentId || null,
          collected_on: optionalText(form, 'collected_on'),
          external_id: optionalText(form, 'external_id'),
        })
      }}
    >
      <TextField
        label="Name"
        name="name"
        hint="The name used by the study or its source, such as TCGA-A1-A0SB-01A. Spaces are allowed; slashes are not."
        error={nameError}
        defaultValue={initial.name}
        required
        maxLength={200}
        pattern={namePattern}
        autoComplete="off"
      />
      <TextField
        label="Material"
        name="material_type"
        hint="What the sample is, such as tissue, blood, RNA or protein. Choose a suggestion or type your own."
        defaultValue={initial.material_type}
        required
        maxLength={100}
        list="material-suggestions"
        autoComplete="off"
      />
      <datalist id="material-suggestions">
        {materialSuggestions.map((material) => (
          <option key={material} value={material} />
        ))}
      </datalist>
      <SelectField
        label="Status"
        name="status"
        options={sampleStatusOptions}
        defaultValue={initial.status}
        required
      />
      <SelectField
        label="Derived from"
        name="parent_sample_id"
        hint={parentHint}
        options={samples.map((sample) => ({
          value: sample.id,
          label: `${sample.name} (${sample.material_type})`,
        }))}
        value={parentId}
        onChange={(event) => {
          const parent = samples.find((sample) => sample.id === event.target.value)
          setParentId(event.target.value)
          if (parent?.subject_id) {
            setSubjectId(parent.subject_id)
          }
        }}
        optional
      />
      <SelectField
        label="Subject"
        name="subject_id"
        options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
        value={subjectId}
        onChange={(event) => {
          setSubjectId(event.target.value)
        }}
        optional
      />
      <TextField
        label="Collected"
        name="collected_on"
        type="date"
        defaultValue={initial.collected_on ?? ''}
        optional
      />
      <TextField
        label="External ID"
        name="external_id"
        hint="The sample's ID in its source repository, such as a GDC sample UUID."
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
