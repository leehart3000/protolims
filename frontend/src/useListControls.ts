import { useState } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

// How many items a list shows at a time.
export const PAGE_SIZE = 50

// Search, sort and page state for a list shown a page at a time. A new search or sort order
// goes back to the first page. `q` is the search once typing has paused, ready to send.
export function useListControls<S extends string>(initialSort: S) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<S>(initialSort)
  const [offset, setOffset] = useState(0)
  const q = useDebouncedValue(search.trim())

  return {
    search,
    q,
    sort,
    offset,
    setOffset,
    changeSearch: (value: string) => {
      setSearch(value)
      setOffset(0)
    },
    changeSort: (next: S) => {
      setSort(next)
      setOffset(0)
    },
  }
}
