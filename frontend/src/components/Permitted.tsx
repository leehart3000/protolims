import type { ReactNode } from 'react'
import { useLocation } from 'react-router'

import { SignInIcon } from '../icons'
import { type Need, refusalReason } from '../permissions'
import { signInHref } from '../signIn'
import { primaryButton } from '../styles'
import { useMe } from '../useMe'

// Shows its children (a form, say) only to someone who can use them. Anyone else is told why
// not, and offered a way to sign in if they aren't. Nothing shows while that's being checked.
// The API checks every change anyway; this just saves filling in a form for nothing.
export function Permitted({ need, children }: { need: Need; children: ReactNode }) {
  const { data: me } = useMe()
  const location = useLocation()

  if (me === undefined) {
    return null
  }
  const reason = refusalReason(me, need)
  if (reason === null) {
    return children
  }
  return (
    <div className="mt-6 max-w-2xl space-y-4 rounded-lg border border-line bg-panel p-4 sm:p-6">
      <p>{reason}</p>
      {me.user === null && (
        <a
          href={signInHref(location.pathname, location.search)}
          className={`${primaryButton} inline-flex items-center gap-2 text-sm`}
        >
          <SignInIcon aria-hidden="true" className="size-4 shrink-0" />
          Sign in with ORCID
        </a>
      )}
    </div>
  )
}
