import type { components } from '../api/schema'
import { ExternalIcon } from '../icons'
import { textLink } from '../styles'

type User = components['schemas']['UserRead']

// Someone's name (or that they haven't signed in yet), with their ORCID iD under it. The iD
// opens their ORCID record in a new tab, with the usual icon to say so (and its label says so,
// for screen readers).
export function PersonCell({ user }: { user: User }) {
  return (
    <>
      {user.name ?? <span className="text-muted italic">Not signed in yet</span>}
      <a
        className={`${textLink} mt-0.5 flex w-fit items-center gap-1 font-mono text-xs`}
        href={`https://orcid.org/${user.subject}`}
        aria-label={`${user.subject} (opens in a new tab)`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {user.subject}
        <ExternalIcon aria-hidden="true" className="size-3 shrink-0" />
      </a>
    </>
  )
}
