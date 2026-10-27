import { describe, expect, it } from 'vitest'

import { invalidDetailsMessage } from './dataFiles'

const generic = 'Some of the details are not valid. Please check them and try again.'

describe('invalidDetailsMessage', () => {
  it('shows a rule the API explains in words', () => {
    expect(invalidDetailsMessage({ detail: 'The assay must be in the same study' })).toBe(
      'The assay must be in the same study',
    )
  })

  it("shows the API's own explanations of invalid details", () => {
    const error = {
      detail: [
        { msg: "Value error, The URI can't contain a user name or password", loc: ['body', 'uri'] },
        { msg: 'String should match pattern', loc: ['body', 'sha256'] },
      ],
    }
    expect(invalidDetailsMessage(error)).toBe("The URI can't contain a user name or password.")
  })

  it('falls back to a general message', () => {
    expect(invalidDetailsMessage({ detail: [{ msg: 'String should match pattern' }] })).toBe(
      generic,
    )
    expect(invalidDetailsMessage({ detail: [null, { loc: [] }] })).toBe(generic)
    expect(invalidDetailsMessage({})).toBe(generic)
    expect(invalidDetailsMessage(undefined)).toBe(generic)
  })
})
