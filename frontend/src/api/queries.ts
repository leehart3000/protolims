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

// One sample by its permanent ID. An address that isn't a valid ID (422) is treated like an
// unknown one (404).
export async function fetchSample(sampleId: string) {
  const { data, response } = await api.GET('/api/v1/samples/{sample_id}', {
    params: { path: { sample_id: sampleId } },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!data) {
    throw new Error('Could not load sample')
  }
  return data
}

// One subject by its permanent ID. An address that isn't a valid ID (422) is treated like an
// unknown one (404).
export async function fetchSubject(subjectId: string) {
  const { data, response } = await api.GET('/api/v1/subjects/{subject_id}', {
    params: { path: { subject_id: subjectId } },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!data) {
    throw new Error('Could not load subject')
  }
  return data
}

type AssayListQuery = NonNullable<
  paths['/api/v1/projects/{project_code}/studies/{study_code}/assays']['get']['parameters']['query']
>

export type AssaySort = NonNullable<AssayListQuery['sort']>

// One page of a study's assays, with the total number that match.
export async function fetchAssayPage(
  projectCode: string,
  studyCode: string,
  query: AssayListQuery,
) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/assays', {
    params: { path: { project_code: projectCode, study_code: studyCode }, query },
  })
  if (!data) {
    throw new Error('Could not load assays')
  }
  return data
}

// One assay by its permanent ID. An address that isn't a valid ID (422) is treated like an
// unknown one (404).
export async function fetchAssay(assayId: string) {
  const { data, response } = await api.GET('/api/v1/assays/{assay_id}', {
    params: { path: { assay_id: assayId } },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!data) {
    throw new Error('Could not load assay')
  }
  return data
}

type AssaySampleListQuery = NonNullable<
  paths['/api/v1/assays/{assay_id}/samples']['get']['parameters']['query']
>

export type AssaySampleSort = NonNullable<AssaySampleListQuery['sort']>

// One page of the samples an assay measured, with the total number that match.
export async function fetchAssaySamplePage(assayId: string, query: AssaySampleListQuery) {
  const { data } = await api.GET('/api/v1/assays/{assay_id}/samples', {
    params: { path: { assay_id: assayId }, query },
  })
  if (!data) {
    throw new Error('Could not load samples')
  }
  return data
}

// The assays a sample was measured in, with its label in each.
export async function fetchSampleAssays(sampleId: string) {
  const { data } = await api.GET('/api/v1/samples/{sample_id}/assays', {
    params: { path: { sample_id: sampleId } },
  })
  if (!data) {
    throw new Error('Could not load assays')
  }
  return data
}
