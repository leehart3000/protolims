import {
  ChevronFirst,
  ChevronLast,
  type LucideIcon,
  SquareArrowLeft,
  SquareArrowRight,
} from 'lucide-react'

import { secondaryButton } from '../styles'
import { PAGE_SIZES } from '../useListControls'

function formatCount(count: number) {
  return count.toLocaleString('en-GB')
}

// How many records a list shows: e.g. "Showing all 20" or "51–100 of 222", or with a search,
// "3 matches" or "1–50 of 59 matches".
function countText(offset: number, limit: number, total: number, filtered: boolean) {
  if (total <= limit) {
    if (filtered) {
      return total === 1 ? '1 match' : `${formatCount(total)} matches`
    }
    return total === 1 ? 'Showing 1 of 1' : `Showing all ${formatCount(total)}`
  }
  const last = Math.min(offset + limit, total)
  const range = `${formatCount(offset + 1)}–${formatCount(last)} of ${formatCount(total)}`
  return filtered ? `${range} matches` : range
}

// On phones only the icon is shown; the label stays as the button's name for screen readers.
function PageButton({
  label,
  icon: Icon,
  iconAfter = false,
  disabled,
  onClick,
}: {
  label: string
  icon: LucideIcon
  iconAfter?: boolean
  disabled: boolean
  onClick: () => void
}) {
  const icon = <Icon aria-hidden="true" className="size-4 shrink-0" />
  return (
    <button
      type="button"
      aria-label={label}
      className={`${secondaryButton} inline-flex items-center gap-1.5`}
      disabled={disabled}
      onClick={onClick}
    >
      {!iconAfter && icon}
      <span className="hidden sm:inline">{label}</span>
      {iconAfter && icon}
    </button>
  )
}

// One bar of a paged list. At the top: the count, the page size and, when there's more than
// one page, the page buttons. At the bottom: the count and page buttons, only when there's
// more than one page.
export function Pagination({
  offset,
  limit,
  total,
  filtered = false,
  position = 'top',
  onChange,
  onLimitChange,
}: {
  offset: number
  limit: number
  total: number
  filtered?: boolean
  position?: 'top' | 'bottom'
  onChange: (offset: number) => void
  onLimitChange: (limit: number) => void
}) {
  const manyPages = total > limit
  if (total === 0 || (position === 'bottom' && !manyPages)) {
    return null
  }
  const showSizes = position === 'top' && total > PAGE_SIZES[0]
  const lastOffset = Math.floor((total - 1) / limit) * limit

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-muted">{countText(offset, limit, total, filtered)}</p>
      {(showSizes || manyPages) && (
        <nav
          aria-label={position === 'top' ? 'Pages' : 'Pages, end of list'}
          className="flex flex-wrap items-center gap-2"
        >
          {showSizes && (
            <label className="mr-2 flex items-center gap-2 text-sm text-muted">
              Per page
              <select
                value={limit}
                className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-fg"
                onChange={(event) => {
                  onLimitChange(Number(event.target.value))
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}
          {manyPages && (
            <>
              <PageButton
                label="First"
                icon={ChevronFirst}
                disabled={offset === 0}
                onClick={() => {
                  onChange(0)
                }}
              />
              <PageButton
                label="Previous"
                icon={SquareArrowLeft}
                disabled={offset === 0}
                onClick={() => {
                  onChange(Math.max(0, offset - limit))
                }}
              />
              <PageButton
                label="Next"
                icon={SquareArrowRight}
                iconAfter
                disabled={offset >= lastOffset}
                onClick={() => {
                  onChange(offset + limit)
                }}
              />
              <PageButton
                label="Last"
                icon={ChevronLast}
                iconAfter
                disabled={offset >= lastOffset}
                onClick={() => {
                  onChange(lastOffset)
                }}
              />
            </>
          )}
        </nav>
      )}
    </div>
  )
}
