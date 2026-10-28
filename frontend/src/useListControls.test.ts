import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PAGE_SIZE, useListControls } from './useListControls'

describe('useListControls', () => {
  it('goes back to the first page when the sort or page size changes', () => {
    const { result } = renderHook(() => useListControls<'name' | '-name'>('name'))
    expect(result.current.limit).toBe(PAGE_SIZE)

    act(() => {
      result.current.setOffset(100)
    })
    act(() => {
      result.current.changeLimit(100)
    })
    expect(result.current.limit).toBe(100)
    expect(result.current.offset).toBe(0)

    act(() => {
      result.current.setOffset(100)
    })
    act(() => {
      result.current.changeSort('-name')
    })
    expect(result.current.sort).toBe('-name')
    expect(result.current.offset).toBe(0)
  })
})
