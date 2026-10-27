import { describe, expect, it } from 'vitest'

import { codePattern, isExternalIdConflict } from './forms'

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

describe('isExternalIdConflict', () => {
  it('recognises the API saying an external ID is already used', () => {
    expect(
      isExternalIdConflict({ detail: "External ID 'X-1' is already used by another sample" }),
    ).toBe(true)
  })

  it('ignores other conflicts and unexpected replies', () => {
    expect(isExternalIdConflict({ detail: "Sample 'S1' already exists" })).toBe(false)
    expect(isExternalIdConflict({ detail: [] })).toBe(false)
    expect(isExternalIdConflict({})).toBe(false)
    expect(isExternalIdConflict(undefined)).toBe(false)
  })
})
