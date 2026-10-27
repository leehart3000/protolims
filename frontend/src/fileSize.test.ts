import { describe, expect, it } from 'vitest'

import { formatFileSize } from './fileSize'

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1.0 kB'],
    [2_500_000, '2.5 MB'],
    [3_200_000_000, '3.2 GB'],
    [7_000_000_000_000, '7.0 TB'],
  ])('shows %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})
