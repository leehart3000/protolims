export const primaryButton =
  'rounded-md bg-primary px-4 py-2 font-medium text-primary-fg hover:bg-primary/85 disabled:opacity-60'

export const textLink = 'text-link underline hover:no-underline'

export const errorBox =
  'rounded-lg border border-danger-line bg-danger-bg px-4 py-3 font-medium text-danger'

export const inputClass =
  'mt-1.5 block w-full rounded-md border bg-panel px-3 py-2 focus:outline-2 focus:outline-offset-1 focus:outline-link'

export const tableWrapper = 'overflow-x-auto rounded-lg border border-line bg-panel'

export const table = 'w-full text-left text-sm'

export const tableHead =
  'border-b border-line bg-line/40 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase'

export const tableHeader = 'px-4 py-3'

export const tableCell = 'px-4 py-3 align-top'

// "relative" lets a row link's invisible overlay (rowLink's "after:") cover the whole row.
export const tableRow = 'relative hover:bg-line/30'

// No link styling (the whole row is the link); keyboard focus outlines the whole row.
export const rowLink =
  'font-medium focus-visible:outline-hidden after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-link'

export const rowIcon = 'text-base font-bold text-primary'

export const secondaryButton =
  'rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg hover:bg-line/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'
