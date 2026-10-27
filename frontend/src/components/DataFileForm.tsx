import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { components } from '../api/schema'
import { type DataFileFormValues, DuplicateLocationError } from '../dataFiles'
import { namePattern, optionalText, text } from '../forms'
import { type DataFileLevel, dataFileLevelOptions } from '../labels'
import { errorBox, primaryButton, textLink } from '../styles'
import { SelectField, TextField } from './FormFields'

type Assay = components['schemas']['AssayRead']

const formatSuggestions = [
  'FASTQ',
  'BAM',
  'CRAM',
  'VCF',
  'TSV',
  'CSV',
  'mzML',
  'RAW',
  'HTML',
  'PDF',
]

// Only the kinds of location the API accepts. The API checks the rest, such as passwords or
// temporary keys in a link.
const uriPattern = '(s3|gs|az|https)://\\S+'
const sha256Pattern = '[0-9a-fA-F]{64}'

// The form for recording a data file or changing one. `assays` are the study's assays.
export function DataFileForm({
  assays,
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
  assays: Assay[]
  initial: DataFileFormValues
  submitLabel: string
  submitIcon: LucideIcon
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error: Error | null
  onSubmit: (values: DataFileFormValues) => void
  onEdit: () => void
}) {
  const uriError =
    error instanceof DuplicateLocationError
      ? 'This location is already recorded in this study.'
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
        const size = optionalText(form, 'size_bytes')
        onSubmit({
          name: text(form, 'name'),
          uri: text(form, 'uri'),
          level: text(form, 'level') as DataFileLevel,
          format: text(form, 'format'),
          assay_id: optionalText(form, 'assay_id'),
          size_bytes: size === null ? null : Number(size),
          sha256: optionalText(form, 'sha256')?.toLowerCase() ?? null,
          external_id: optionalText(form, 'external_id'),
        })
      }}
    >
      <TextField
        label="Name"
        name="name"
        hint="The file's name, such as counts.tsv. Files can share a name; their locations tell them apart."
        defaultValue={initial.name}
        required
        maxLength={200}
        pattern={namePattern}
        autoComplete="off"
      />
      <TextField
        label="Location"
        name="uri"
        hint="Where the file is: s3://, gs:// or az:// for cloud storage, or an https:// link to its source. Links containing passwords or temporary keys aren't allowed."
        error={uriError}
        defaultValue={initial.uri}
        required
        maxLength={2000}
        pattern={uriPattern}
        autoComplete="off"
        mono
      />
      <SelectField
        label="Level"
        name="level"
        options={dataFileLevelOptions}
        defaultValue={initial.level}
        required
      />
      <TextField
        label="Format"
        name="format"
        hint="Such as FASTQ, BAM, TSV or mzML. Choose a suggestion or type your own."
        defaultValue={initial.format}
        required
        maxLength={50}
        list="format-suggestions"
        autoComplete="off"
      />
      <datalist id="format-suggestions">
        {formatSuggestions.map((format) => (
          <option key={format} value={format} />
        ))}
      </datalist>
      <SelectField
        label="Assay"
        name="assay_id"
        options={assays.map((assay) => ({ value: assay.id, label: assay.name }))}
        defaultValue={initial.assay_id ?? ''}
        optional
      />
      <TextField
        label="Size in bytes"
        name="size_bytes"
        type="number"
        min={0}
        step={1}
        defaultValue={initial.size_bytes ?? ''}
        optional
      />
      <TextField
        label="SHA-256"
        name="sha256"
        hint="The file's SHA-256 checksum (64 characters, 0–9 and a–f), if known."
        defaultValue={initial.sha256 ?? ''}
        maxLength={64}
        pattern={sha256Pattern}
        autoComplete="off"
        optional
        mono
      />
      <TextField
        label="External ID"
        name="external_id"
        hint="The file's ID in its source repository, such as a GDC file UUID."
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
