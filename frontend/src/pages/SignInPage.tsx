import { LogIn } from 'lucide-react'
import { useLocation } from 'react-router'

import { PageTitle } from '../components/PageTitle'
import { signInHref } from '../signIn'
import { primaryButton } from '../styles'

// Shown instead of every page on a private site (public reading off) to anyone not signed in.
// Signing in comes back to the page they asked for.
export default function SignInPage() {
  const location = useLocation()

  return (
    <>
      <PageTitle>Sign in</PageTitle>
      <p className="mt-3 max-w-2xl text-muted">
        This ProtoLIMS site is private. Please sign in with your ORCID iD to see its projects and
        studies.
      </p>
      <p className="mt-6">
        <a
          href={signInHref(location.pathname, location.search)}
          className={`${primaryButton} inline-flex items-center gap-2`}
        >
          <LogIn aria-hidden="true" className="size-5" />
          Sign in with ORCID
        </a>
      </p>
    </>
  )
}
