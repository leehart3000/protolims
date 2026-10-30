import { describe, expect, it } from 'vitest'

import { editorOf, refusalReason, roleOn } from './permissions'
import { nobody, siteAdmin, signedInWith } from './test/people'

describe('roleOn', () => {
  const me = signedInWith([
    { project: 'P1', study: null, role: 'viewer' },
    { project: 'P1', study: 'S1', role: 'admin' },
    { project: 'P2', study: 'S3', role: 'editor' },
  ])

  it('gives the higher of the project role and the study role', () => {
    expect(roleOn(me, 'P1')).toBe('viewer')
    expect(roleOn(me, 'P1', 'S1')).toBe('admin')
    expect(roleOn(me, 'P1', 'S2')).toBe('viewer')
  })

  it('gives a study role only on that study', () => {
    expect(roleOn(me, 'P2')).toBeNull()
    expect(roleOn(me, 'P2', 'S3')).toBe('editor')
    expect(roleOn(me, 'P3', 'S3')).toBeNull()
  })

  it('makes site administrators admins everywhere', () => {
    expect(roleOn(siteAdmin, 'P9', 'S9')).toBe('admin')
  })
})

describe('refusalReason', () => {
  it('asks people to sign in', () => {
    expect(refusalReason(nobody, { siteAdmin: true })).toBe('Sign in to do this.')
  })

  it('lets site administrators do anything', () => {
    expect(refusalReason(siteAdmin, { siteAdmin: true })).toBeNull()
    expect(refusalReason(siteAdmin, { role: 'admin', project: 'P1' })).toBeNull()
  })

  it('lets admins of any project add studies', () => {
    const projectAdmin = signedInWith([{ project: 'P1', study: null, role: 'admin' }])
    const studyAdmin = signedInWith([{ project: 'P1', study: 'S1', role: 'admin' }])

    expect(refusalReason(projectAdmin, { anyProjectAdmin: true })).toBeNull()
    expect(refusalReason(siteAdmin, { anyProjectAdmin: true })).toBeNull()
    expect(refusalReason(studyAdmin, { anyProjectAdmin: true })).toBe(
      "Only a project's admins can add studies to it.",
    )
  })

  it('says who can do it', () => {
    const editor = signedInWith([{ project: 'P1', study: null, role: 'editor' }])

    expect(refusalReason(editor, { siteAdmin: true })).toBe('Only site administrators can do this.')
    expect(refusalReason(editor, editorOf('P1', 'S1'))).toBeNull()
    expect(refusalReason(editor, { role: 'admin', project: 'P1' })).toBe(
      "Only the project's admins can do this.",
    )
    expect(refusalReason(editor, editorOf('P2', 'S1'))).toBe(
      "Only the study's editors and admins can do this.",
    )
  })
})
