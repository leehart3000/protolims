import { ReadOnlyIcon } from '../icons'
import { READ_ONLY_REASON } from '../permissions'
import { useMe } from '../useMe'

// In the header while the site is read-only (PROTOLIMS_READ_ONLY): a lock, and the words
// "Read-only" from small screens up (on phones, for screen readers and as a tooltip only).
export function ReadOnlyBadge() {
  const { data: me } = useMe()
  if (!me?.read_only) {
    return null
  }
  return (
    <span
      title={READ_ONLY_REASON}
      className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-muted"
    >
      <ReadOnlyIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="max-sm:sr-only">Read-only</span>
    </span>
  )
}
