import { secondaryButton } from '../styles'

function formatCount(count: number) {
  return count.toLocaleString('en-GB')
}

// What a one-page list shows: how many records, or with a search, how many match.
function onePageCount(total: number, filtered: boolean) {
  if (filtered) {
    return total === 1 ? '1 match' : `${formatCount(total)} matches`
  }
  return total === 1 ? 'Showing 1' : `Showing all ${formatCount(total)}`
}

// How many records a list shows, with Previous and Next buttons when it doesn't fit on one
// page. With filtered, the counts are of the records that match a search.
export function Pagination({
  offset,
  limit,
  total,
  filtered = false,
  onChange,
}: {
  offset: number
  limit: number
  total: number
  filtered?: boolean
  onChange: (offset: number) => void
}) {
  if (total === 0) {
    return null
  }
  if (total <= limit) {
    return <p className="mt-4 text-sm text-muted">{onePageCount(total, filtered)}</p>
  }
  const last = Math.min(offset + limit, total)

  return (
    <nav
      aria-label="Pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <p className="text-sm text-muted">
        {formatCount(offset + 1)}–{formatCount(last)} of {formatCount(total)}
        {filtered && ' matches'}
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
