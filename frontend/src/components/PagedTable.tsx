import type { ReactNode } from 'react'

import type { PageControls } from '../useListControls'
import { Pagination } from './Pagination'

// A table shown a page at a time, with the count, page size and page buttons above it, and the
// count and page buttons again below it when there's more than one page. Every paged list
// uses this, so changes to pagination are made here and in Pagination.
export function PagedTable({
  total,
  controls,
  children,
}: {
  total: number
  controls: PageControls
  children: ReactNode
}) {
  const bar = {
    offset: controls.offset,
    limit: controls.limit,
    total,
    filtered: controls.q !== '',
    onChange: controls.setOffset,
    onLimitChange: controls.changeLimit,
  }
  return (
    <>
      <Pagination {...bar} position="top" />
      {children}
      <Pagination {...bar} position="bottom" />
    </>
  )
}
