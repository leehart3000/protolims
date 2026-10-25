import { useEffect, useState } from 'react'

// The value, but only once it has stopped changing for `delay` milliseconds, so typing
// in a search box doesn't send a request for every key press.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])
  return debounced
}
