import type { components } from '../api/schema'

type Me = components['schemas']['Me']

// Signed in as a site administrator, who may do anything: what most tests need.
export const siteAdmin: Me = {
  user: {
    id: '0192a5b0-0000-7000-8000-0000000000a1',
    provider: 'orcid',
    subject: '0000-0001-5109-3700',
    name: 'Site Admin',
    created_at: '2026-10-29T10:47:31Z',
    last_signed_in_at: '2026-10-30T09:15:00Z',
  },
  site_admin: true,
  public_read: true,
  read_only: false,
  roles: [],
}

// Nobody signed in.
export const nobody: Me = {
  user: null,
  site_admin: false,
  public_read: true,
  read_only: false,
  roles: [],
}

// Signed in, with just these roles.
export function signedInWith(roles: Me['roles']): Me {
  return { ...siteAdmin, site_admin: false, roles }
}
