import { useState } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

// The page sizes people can choose from. The API allows up to 500.
export const PAGE_SIZES = [25, 50, 100, 200] as const

// How many items a list shows at a time, until someone chooses another page size.
export const PAGE_SIZE = 50

// What a paged table needs from its list's controls.
export interface PageControls {
  q: string
  offset: number
  limit: number
  setOffset: (offset: number) => void
  changeLimit: (limit: number) => void
}

// Search, sort, page and page size state for a list shown a page at a time. A new search,
// sort order or page size goes back to the first page. `q` is the search once typing has
// paused, ready to send.
export function useListControls<S extends string>(initialSort: S) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<S>(initialSort)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const q = useDebouncedValue(search.trim())

  return {
    search,
    q,
    sort,
    offset,
    limit,
    setOffset,
    changeSearch: (value: string) => {
      setSearch(value)
      setOffset(0)
    },
    changeSort: (next: S) => {
      setSort(next)
      setOffset(0)
    },
    changeLimit: (next: number) => {
      setLimit(next)
      setOffset(0)
    },
  }
}
