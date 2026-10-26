import { describe, expect, it } from 'vitest'

import { codePattern } from './forms'

// Browsers test a field's pattern against the whole value, with the v flag.
function matches(value: string) {
  return new RegExp(`^(?:${codePattern})$`, 'v').test(value)
}

describe('codePattern', () => {
  it.each(['TCGA-BRCA', 'RNASEQ', 'a.b_c', 'news', 'renew', 'new-1', 'EDITS'])(
    'allows %s',
    (value) => {
      expect(matches(value)).toBe(true)
    },
  )

  it.each(['new', 'NEW', 'New', 'edit', 'Edit', '-x', '.x', 'a/b', ''])('rejects "%s"', (value) => {
    expect(matches(value)).toBe(false)
  })
})
