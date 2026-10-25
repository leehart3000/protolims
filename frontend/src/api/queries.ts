import { api } from './client'
import type { paths } from './schema'

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

type SampleListQuery = NonNullable<
  paths['/api/v1/projects/{project_code}/studies/{study_code}/samples']['get']['parameters']['query']
>

export type SampleSort = NonNullable<SampleListQuery['sort']>

// One page of a study's samples, with the total number that match.
export async function fetchSamplePage(
  projectCode: string,
  studyCode: string,
  query: SampleListQuery,
) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/samples', {
    params: { path: { project_code: projectCode, study_code: studyCode }, query },
  })
  if (!data) {
    throw new Error('Could not load samples')
  }
  return data
}

// A study's samples; with parentId, only the samples derived from that sample.
export async function fetchSamples(projectCode: string, studyCode: string, parentId?: string) {
  return (await fetchSamplePage(projectCode, studyCode, { parent: parentId })).items
}

type SubjectListQuery = NonNullable<
  paths['/api/v1/projects/{project_code}/studies/{study_code}/subjects']['get']['parameters']['query']
>

export type SubjectSort = NonNullable<SubjectListQuery['sort']>

// One page of a study's subjects, with the total number that match.
export async function fetchSubjectPage(
  projectCode: string,
  studyCode: string,
  query: SubjectListQuery,
) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/subjects', {
    params: { path: { project_code: projectCode, study_code: studyCode }, query },
  })
  if (!data) {
    throw new Error('Could not load subjects')
  }
  return data
}

// The first page of a study's subjects, for the New sample form's Subject list.
export async function fetchSubjects(projectCode: string, studyCode: string) {
  return (await fetchSubjectPage(projectCode, studyCode, {})).items
}
