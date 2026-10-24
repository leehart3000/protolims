import { api } from './client'

// These return null when the item doesn't exist, so pages can show "not found".

export async function fetchProject(code: string) {
  const { data, response } = await api.GET('/api/v1/projects/{code}', {
    params: { path: { code } },
  })
  if (response.status === 404) {
    return null
  }
  if (!data) {
    throw new Error('Could not load project')
  }
  return data
}

export async function fetchStudy(projectCode: string, studyCode: string) {
  const { data, response } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}', {
    params: { path: { project_code: projectCode, study_code: studyCode } },
  })
  if (response.status === 404) {
    return null
  }
  if (!data) {
    throw new Error('Could not load study')
  }
  return data
}

// A study's samples; with parentId, only the samples derived from that sample.
export async function fetchSamples(projectCode: string, studyCode: string, parentId?: string) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/samples', {
    params: {
      path: { project_code: projectCode, study_code: studyCode },
      query: { parent: parentId },
    },
  })
  if (!data) {
    throw new Error('Could not load samples')
  }
  return data
}

export async function fetchSubjects(projectCode: string, studyCode: string) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/subjects', {
    params: { path: { project_code: projectCode, study_code: studyCode } },
  })
  if (!data) {
    throw new Error('Could not load subjects')
  }
  return data
}
