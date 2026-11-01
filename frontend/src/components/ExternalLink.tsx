import { ExternalIcon } from '../icons'
import { textLink } from '../styles'

// A link to something outside the website's own pages (another site, or the API's
// documentation), opening in a new tab, with the usual icon to say so, kept on the same line as
// the link's last word. Screen readers hear "(opens in a new tab)" after its words.
export function ExternalLink({ href, children }: { href: string; children: string }) {
  const lastWord = children.lastIndexOf(' ') + 1
  return (
    <a
      href={href}
      className={textLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${children} (opens in a new tab)`}
    >
      {children.slice(0, lastWord)}
      <span className="whitespace-nowrap">
        {children.slice(lastWord)}
        <ExternalIcon aria-hidden="true" className="ml-0.5 inline size-3 align-baseline" />
      </span>
    </a>
  )
}
