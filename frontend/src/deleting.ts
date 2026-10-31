import { api } from './api/client'
import { refusal } from './forms'

// Why the API wouldn't delete something it found but refused (409), as it explains: what's
// still in it.
function stillInUse(error: unknown, otherwise: string) {
  const detail = (error as { detail?: unknown } | undefined)?.detail
  return new Error(typeof detail === 'string' ? `${detail}.` : otherwise)
}

const FAILED = 'Could not delete it. Please try again later.'

// Delete an empty study (one with no subjects, samples, assays or data files).
export async function deleteStudy(projectCode: string, studyCode: string) {
  const { error, response } = await api.DELETE(
    '/api/v1/projects/{project_code}/studies/{study_code}',
    { params: { path: { project_code: projectCode, study_code: studyCode } } },
  )
  if (response.status === 409) {
    throw stillInUse(error, FAILED)
  }
  if (!response.ok) {
    throw refusal(response.status, FAILED)
  }
}

// Delete a project with no studies.
export async function deleteProject(code: string) {
  const { error, response } = await api.DELETE('/api/v1/projects/{code}', {
    params: { path: { code } },
  })
  if (response.status === 409) {
    throw stillInUse(error, FAILED)
  }
  if (!response.ok) {
    throw refusal(response.status, FAILED)
  }
}
