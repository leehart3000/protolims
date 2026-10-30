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

type ProjectListQuery = NonNullable<paths['/api/v1/projects']['get']['parameters']['query']>

export type ProjectSort = NonNullable<ProjectListQuery['sort']>

// One page of projects, with the total number that match.
export async function fetchProjectPage(query: ProjectListQuery) {
  const { data } = await api.GET('/api/v1/projects', { params: { query } })
  if (!data) {
    throw new Error('Could not load projects')
  }
  return data
}

type StudyListQuery = NonNullable<
  paths['/api/v1/projects/{project_code}/studies']['get']['parameters']['query']
>

export type StudySort = NonNullable<StudyListQuery['sort']>

// One page of a project's studies, with the total number that match.
export async function fetchStudyPage(projectCode: string, query: StudyListQuery) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies', {
    params: { path: { project_code: projectCode }, query },
  })
  if (!data) {
    throw new Error('Could not load studies')
  }
  return data
}

type AllStudyListQuery = NonNullable<paths['/api/v1/studies']['get']['parameters']['query']>

export type AllStudySort = NonNullable<AllStudyListQuery['sort']>

// One page of studies across all projects (or one, with project), with the total that match.
export async function fetchAllStudyPage(query: AllStudyListQuery) {
  const { data } = await api.GET('/api/v1/studies', { params: { query } })
  if (!data) {
    throw new Error('Could not load studies')
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

type DataFileListQuery = NonNullable<
  paths['/api/v1/projects/{project_code}/studies/{study_code}/data-files']['get']['parameters']['query']
>

export type DataFileSort = NonNullable<DataFileListQuery['sort']>

// One page of a study's data files, with the total number that match.
export async function fetchDataFilePage(
  projectCode: string,
  studyCode: string,
  query: DataFileListQuery,
) {
  const { data } = await api.GET(
    '/api/v1/projects/{project_code}/studies/{study_code}/data-files',
    { params: { path: { project_code: projectCode, study_code: studyCode }, query } },
  )
  if (!data) {
    throw new Error('Could not load data files')
  }
  return data
}

// One data file by its permanent ID. An address that isn't a valid ID (422) is treated like an
// unknown one (404).
export async function fetchDataFile(dataFileId: string) {
  const { data, response } = await api.GET('/api/v1/data-files/{data_file_id}', {
    params: { path: { data_file_id: dataFileId } },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!data) {
    throw new Error('Could not load data file')
  }
  return data
}

type DataFileSampleListQuery = NonNullable<
  paths['/api/v1/data-files/{data_file_id}/samples']['get']['parameters']['query']
>

// One page of the samples whose data is in a file, with the total number that match.
export async function fetchDataFileSamplePage(dataFileId: string, query: DataFileSampleListQuery) {
  const { data } = await api.GET('/api/v1/data-files/{data_file_id}/samples', {
    params: { path: { data_file_id: dataFileId }, query },
  })
  if (!data) {
    throw new Error('Could not load samples')
  }
  return data
}

// The files a data file was made from.
export async function fetchDataFileInputs(dataFileId: string) {
  const { data } = await api.GET('/api/v1/data-files/{data_file_id}/inputs', {
    params: { path: { data_file_id: dataFileId } },
  })
  if (!data) {
    throw new Error('Could not load input files')
  }
  return data
}

// The files made from a data file.
export async function fetchDataFileOutputs(dataFileId: string) {
  const { data } = await api.GET('/api/v1/data-files/{data_file_id}/outputs', {
    params: { path: { data_file_id: dataFileId } },
  })
  if (!data) {
    throw new Error('Could not load output files')
  }
  return data
}

// The data files a sample appears in, with its label in each.
export async function fetchSampleDataFiles(sampleId: string) {
  const { data } = await api.GET('/api/v1/samples/{sample_id}/data-files', {
    params: { path: { sample_id: sampleId } },
  })
  if (!data) {
    throw new Error('Could not load data files')
  }
  return data
}

// Who is signed in on this browser (user is null if nobody), and what this server allows.
export async function fetchMe() {
  const { data } = await api.GET('/api/v1/auth/me')
  if (!data) {
    throw new Error('Could not check who is signed in')
  }
  return data
}

// Sign this browser out, ending its session.
export async function signOut() {
  const { response } = await api.POST('/api/v1/auth/logout')
  if (!response.ok) {
    throw new Error('Could not sign out')
  }
}

type UserListQuery = NonNullable<paths['/api/v1/users']['get']['parameters']['query']>

export type UserSort = NonNullable<UserListQuery['sort']>

// One page of everyone who has signed in or been added, with their roles (site
// administrators only).
export async function fetchUserPage(query: UserListQuery) {
  const { data } = await api.GET('/api/v1/users', { params: { query } })
  if (!data) {
    throw new Error('Could not load users')
  }
  return data
}

// Everyone with a role on a project or, given a study code, on that study itself.
export async function fetchMembers(projectCode: string, studyCode?: string) {
  const { data } =
    studyCode === undefined
      ? await api.GET('/api/v1/projects/{project_code}/members', {
          params: { path: { project_code: projectCode } },
        })
      : await api.GET('/api/v1/projects/{project_code}/studies/{study_code}/members', {
          params: { path: { project_code: projectCode, study_code: studyCode } },
        })
  if (!Array.isArray(data)) {
    throw new Error('Could not load members')
  }
  return data
}

type AllQuery<
  P extends '/api/v1/subjects' | '/api/v1/samples' | '/api/v1/assays' | '/api/v1/data-files',
> = NonNullable<paths[P]['get']['parameters']['query']>

// One page of every subject, sample, assay or data file in the studies someone can see, across
// all projects, with the total number that match.

export async function fetchAllSubjectPage(query: AllQuery<'/api/v1/subjects'>) {
  const { data } = await api.GET('/api/v1/subjects', { params: { query } })
  if (!data) {
    throw new Error('Could not load subjects')
  }
  return data
}

export async function fetchAllSamplePage(query: AllQuery<'/api/v1/samples'>) {
  const { data } = await api.GET('/api/v1/samples', { params: { query } })
  if (!data) {
    throw new Error('Could not load samples')
  }
  return data
}

export async function fetchAllAssayPage(query: AllQuery<'/api/v1/assays'>) {
  const { data } = await api.GET('/api/v1/assays', { params: { query } })
  if (!data) {
    throw new Error('Could not load assays')
  }
  return data
}

export async function fetchAllDataFilePage(query: AllQuery<'/api/v1/data-files'>) {
  const { data } = await api.GET('/api/v1/data-files', { params: { query } })
  if (!data) {
    throw new Error('Could not load data files')
  }
  return data
}

type ActivityQuery = NonNullable<paths['/api/v1/auth/me/activity']['get']['parameters']['query']>

// One page of the changes the signed-in person has made, newest first, with the total number.
export async function fetchMyActivity(query: ActivityQuery) {
  const { data } = await api.GET('/api/v1/auth/me/activity', { params: { query } })
  if (!data) {
    throw new Error('Could not load your changes')
  }
  return data
}
