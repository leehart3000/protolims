import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, UserRound } from 'lucide-react'
import { useLocation } from 'react-router'

import { signOut } from '../api/queries'
import { SignInIcon } from '../icons'
import { signInHref } from '../signIn'
import { useMe } from '../useMe'
import { SiteAdminBadge } from './SiteAdminBadge'

const headerButton =
  'inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted hover:bg-line/60 hover:text-fg disabled:opacity-60'

// Signing in and out, in the header. Signing in leaves the site for ORCID, which sends the
// browser back to the same page afterwards.
export default function AccountMenu() {
  const { data: me } = useMe()
  const location = useLocation()
  const queryClient = useQueryClient()
  const signingOut = useMutation({
    mutationFn: signOut,
    // What can be seen and done may have changed, so fetch everything shown again.
    onSuccess: () => queryClient.invalidateQueries(),
  })

  if (!me) {
    return null
  }

  if (!me.user) {
    return (
      <a
        href={signInHref(location.pathname, location.search)}
        title="Sign in with your ORCID iD"
        className={headerButton}
      >
        <SignInIcon aria-hidden="true" className="size-5" />
        Sign in
      </a>
    )
  }

  // The name is private on some ORCID records, so fall back to the ORCID iD.
  const name = me.user.name ?? me.user.subject
  return (
    <div className="flex items-center gap-1">
      {signingOut.isError && (
        <p role="alert" className="text-sm font-medium text-danger">
          Could not sign out
        </p>
      )}
      <p className="hidden items-center gap-1.5 text-sm sm:flex">
        <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted" />
        <span className="sr-only">Signed in as </span>
        <span className="max-w-40 truncate" title={name}>
          {name}
        </span>
        {me.site_admin && <SiteAdminBadge />}
      </p>
      <button
        type="button"
        onClick={() => {
          signingOut.mutate()
        }}
        disabled={signingOut.isPending}
        className={headerButton}
      >
        <LogOut aria-hidden="true" className="size-5" />
        <span className="sr-only sm:not-sr-only">Sign out</span>
      </button>
    </div>
  )
}
