import type { ReactNode } from 'react'

// A page heading in the wordmark's style: "Label:" like "Proto", the name like "LIMS".
export function PageTitle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <h1 className="font-brand text-2xl tracking-tight sm:text-3xl">
      <span className="font-normal text-fg">{label}:</span>{' '}
      <span className="font-bold">{children}</span>
    </h1>
  )
}
