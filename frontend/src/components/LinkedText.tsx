import type { ReactNode } from 'react'

import { textLink } from '../styles'

// Web addresses in free text: https only, without any punctuation that ends a sentence or
// closes a bracket after them.
const ADDRESS = /https:\/\/[^\s<>"]+/g
const TRAILING = /[.,;:!?)\]]+$/

// Free text (such as a licence or citation) with its line breaks kept, and its web addresses
// as links, opening in a new tab.
export function LinkedText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let shown = 0
  for (const match of text.matchAll(ADDRESS)) {
    const address = match[0].replace(TRAILING, '')
    parts.push(text.slice(shown, match.index))
    parts.push(
      <a
        key={match.index}
        href={address}
        className={textLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {address}
      </a>,
    )
    shown = match.index + address.length
  }
  parts.push(text.slice(shown))
  return <span className="whitespace-pre-line wrap-anywhere">{parts}</span>
}
