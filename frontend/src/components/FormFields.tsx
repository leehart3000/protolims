import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { inputClass } from '../styles'

export function FieldLabel({
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

export function TextField({
  label,
  name,
  hint,
  error,
  optional,
  mono,
  ...inputProps
}: {
  label: string
  name: string
  hint?: string
  error?: string
  optional?: boolean
  mono?: boolean
} & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = `${name}-hint`
  const errorId = `${name}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ')

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
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? 'border-danger' : 'border-line'} ${mono ? 'font-mono' : ''}`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextAreaField({
  label,
  name,
  optional,
  ...textareaProps
}: {
  label: string
  name: string
  optional?: boolean
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel htmlFor={name} label={label} optional={optional} />
      <textarea id={name} name={name} className={`${inputClass} border-line`} {...textareaProps} />
    </div>
  )
}
