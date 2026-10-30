import { Link, useLocation } from 'react-router'

import { AccountIcon, SignInIcon } from '../icons'
import { signInHref } from '../signIn'
import { useMe } from '../useMe'
import { SignOutButton } from './SignOutButton'
import { SiteAdminBadge } from './SiteAdminBadge'

const headerButton =
  'inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted hover:bg-gold/15 hover:text-fg dark:hover:text-gold disabled:opacity-60'

// Signing in and out, in the header. Signing in leaves the site for ORCID, which sends the
// browser back to the same page afterwards. Once signed in, the name links to the account page.
// On phones, only its icon shows, and signing out is done from the account page, so the header
// fits on one line.
export default function AccountMenu() {
  const { data: me } = useMe()
  const location = useLocation()

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
        {/* On the narrowest phones only the icon shows, so the header fits on one line. */}
        <span className="max-[25rem]:sr-only">Sign in</span>
      </a>
    )
  }

  // The name is private on some ORCID records, so fall back to the ORCID iD.
  const name = me.user.name ?? me.user.subject
  return (
    <div className="flex items-center gap-1">
      <Link to="/account" title="Your account" className={headerButton}>
        <AccountIcon aria-hidden="true" className="size-5 shrink-0" />
        <span className="max-w-40 truncate max-sm:sr-only">{name}</span>
        {me.site_admin && <SiteAdminBadge />}
      </Link>
      <SignOutButton
        className={`${headerButton} max-sm:hidden`}
        labelClassName="sr-only sm:not-sr-only"
      />
    </div>
  )
}
