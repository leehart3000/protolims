import type { LucideIcon } from 'lucide-react'
import { type ReactNode, useId } from 'react'

// A button that can't be used, and why. It's marked aria-disabled rather than disabled, so it
// can still be reached with the keyboard. The reason shows on hover, focus or tap, and screen
// readers read it as the button's description. `align` is the side of the button the reason
// lines up with, so it stays on the page.
export function DisabledButton({
  icon: Icon,
  className,
  reason,
  align = 'end',
  children,
}: {
  icon: LucideIcon
  className: string
  reason: string
  align?: 'start' | 'end'
  children: ReactNode
}) {
  const reasonId = useId()

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        className={`${className} inline-flex cursor-not-allowed items-center gap-2 opacity-50`}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {children}
      </button>
      <span
        id={reasonId}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-10 mt-1.5 hidden w-max max-w-64 rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-page shadow-md group-focus-within:block group-hover:block ${align === 'end' ? 'right-0' : 'left-0'}`}
      >
        {reason}
      </span>
    </span>
  )
}
