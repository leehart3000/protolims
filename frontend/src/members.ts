import { api } from './api/client'
import type { components } from './api/schema'
import { refusal } from './forms'

export type Role = components['schemas']['MemberRead']['role']

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
]

// An ORCID iD: four groups of four digits, the last character possibly X (the API also checks
// the final check digit).
export const orcidPattern = '\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]'

// Where a role is: a project, or a study in it.
export interface Place {
  projectCode: string
  studyCode?: string
}

// Send a role change to the API, returning its response.
async function send(place: Place, orcidId: string, role: Role | null) {
  if (place.studyCode === undefined) {
    const path = { project_code: place.projectCode, orcid_id: orcidId }
    const url = '/api/v1/projects/{project_code}/members/{orcid_id}'
    return role === null
      ? (await api.DELETE(url, { params: { path } })).response
      : (await api.PUT(url, { params: { path }, body: { role } })).response
  }
  const path = { project_code: place.projectCode, study_code: place.studyCode, orcid_id: orcidId }
  const url = '/api/v1/projects/{project_code}/studies/{study_code}/members/{orcid_id}'
  return role === null
    ? (await api.DELETE(url, { params: { path } })).response
    : (await api.PUT(url, { params: { path }, body: { role } })).response
}

// Give someone a role here, or change it (role), or take it away (null).
export async function changeRole(place: Place, orcidId: string, role: Role | null) {
  const response = await send(place, orcidId, role)
  if (response.ok) {
    return
  }
  if (response.status === 422) {
    throw new Error(`${orcidId} isn't a valid ORCID iD. Please check it and try again.`)
  }
  throw refusal(response.status, 'Could not change the role. Please try again later.')
}

// Remove someone with no roles from the list of users (site administrators only). The API
// explains why it refuses someone who still has roles, or is a site administrator.
export async function removeUser(orcidId: string) {
  const { error, response } = await api.DELETE('/api/v1/users/{orcid_id}', {
    params: { path: { orcid_id: orcidId } },
  })
  if (response.ok) {
    return
  }
  const body: unknown = error
  const detail =
    typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined
  if (response.status === 409 && typeof detail === 'string') {
    throw new Error(detail)
  }
  throw refusal(response.status, 'Could not remove them. Please try again later.')
}
