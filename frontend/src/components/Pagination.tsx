import { secondaryButton } from '../styles'

function formatCount(count: number) {
  return count.toLocaleString('en-GB')
}

// Previous and Next buttons for a list shown a page at a time. Hidden when it all fits on one page.
export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number
  limit: number
  total: number
  onChange: (offset: number) => void
}) {
  if (total <= limit) {
    return null
  }
  const last = Math.min(offset + limit, total)

  return (
    <nav
      aria-label="Pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <p className="text-sm text-muted">
        {formatCount(offset + 1)}–{formatCount(last)} of {formatCount(total)}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={offset === 0}
          onClick={() => {
            onChange(Math.max(0, offset - limit))
          }}
        >
          Previous
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={last >= total}
          onClick={() => {
            onChange(offset + limit)
          }}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
