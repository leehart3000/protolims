import { SquareMinus, SquarePlus } from 'lucide-react'

import { inputClass, secondaryButton } from '../styles'

// One design factor being edited. The key keeps each row's inputs in place when another
// row is removed.
export interface FactorRow {
  key: number
  name: string
  description: string
}

// A list of design factors, each with a name and an optional description, that can be added
// to and removed from.
export function DesignFactorsEditor({
  rows,
  onChange,
}: {
  rows: FactorRow[]
  onChange: (rows: FactorRow[]) => void
}) {
  function update(key: number, changes: Partial<FactorRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...changes } : row)))
  }

  return (
    <fieldset>
      <legend className="block text-sm font-medium">
        Design factors <span className="font-normal text-muted">(optional)</span>
      </legend>
      <p className="mt-1 text-sm text-muted">
        The variables the study compares, such as dose, time or tissue type.
      </p>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-3">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Factor ${String(index + 1)} name`}
                placeholder="Name"
                value={row.name}
                required
                maxLength={100}
                autoComplete="off"
                onChange={(event) => {
                  update(row.key, { name: event.target.value })
                }}
                className={`${inputClass} border-line min-w-40 flex-1`}
              />
              <input
                aria-label={`Factor ${String(index + 1)} description`}
                placeholder="Description (optional)"
                value={row.description}
                autoComplete="off"
                onChange={(event) => {
                  update(row.key, { description: event.target.value })
                }}
                className={`${inputClass} border-line min-w-40 flex-[2]`}
              />
              <button
                type="button"
                aria-label={`Remove factor ${String(index + 1)}`}
                className={`${secondaryButton} inline-flex items-center gap-2`}
                onClick={() => {
                  onChange(rows.filter((other) => other.key !== row.key))
                }}
              >
                <SquareMinus aria-hidden="true" className="size-4 shrink-0" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`${secondaryButton} mt-3 inline-flex items-center gap-2`}
        onClick={() => {
          const key = Math.max(-1, ...rows.map((row) => row.key)) + 1
          onChange([...rows, { key, name: '', description: '' }])
        }}
      >
        <SquarePlus aria-hidden="true" className="size-4 shrink-0" />
        Add factor
      </button>
    </fieldset>
  )
}
