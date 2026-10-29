import { SiteAdminIcon } from '../icons'

// Marks a site administrator, someone who can do anything on this site: a gold shield (with a
// dark check, so it shows in both themes), and the words "Site admin" when `label` is set.
// Without them, the words are still there for screen readers, and as a tooltip.
export function SiteAdminBadge({ label = false }: { label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" title={label ? undefined : 'Site admin'}>
      <SiteAdminIcon aria-hidden="true" className="size-4 shrink-0 fill-gold text-ink" />
      <span className={label ? '' : 'sr-only'}>Site admin</span>
    </span>
  )
}
