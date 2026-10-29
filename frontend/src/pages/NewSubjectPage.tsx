import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SquarePlus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchStudy } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { SubjectForm } from '../components/SubjectForm'
import {
  DuplicateNameError,
  DuplicateExternalIdError,
  isExternalIdConflict,
  refusal,
} from '../forms'

type SubjectCreate = components['schemas']['SubjectCreate']

async function createSubject(projectCode: string, studyCode: string, body: SubjectCreate) {
  const { data, error, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/subjects',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError(
      'Another subject in this study already has this external ID.',
    )
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`A subject called ${body.name} already exists in this study.`)
  }
  if (response.status === 404) {
    throw new Error(`There is no study ${studyCode} in project ${projectCode}.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not create the subject. Please try again later.')
}

export default function NewSubjectPage() {
  const { code: projectCode = '', studyCode = '' } = useParams()
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const study = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode],
    queryFn: () => fetchStudy(projectCode, studyCode),
  })
  const mutation = useMutation({
    mutationFn: (body: SubjectCreate) => createSubject(projectCode, studyCode, body),
    onSuccess: async (subject) => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode, 'subjects'],
      })
      await navigate(`/subjects/${subject.id}`)
    },
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: studyCode, to: studyPath, mono: true },
          { label: 'New subject' },
        ]}
      />
      <PageTitle>New subject</PageTitle>
      <DetailList
        items={[
          ['Study', study.data?.title ?? null],
          ['Study code', <span className="font-mono">{studyCode}</span>],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      <SubjectForm
        initial={{ name: '', subject_type: '', species: null, external_id: null }}
        submitLabel="Create subject"
        submitIcon={SquarePlus}
        pendingLabel="Creating…"
        cancelTo={studyPath}
        isPending={mutation.isPending}
        error={mutation.error}
        onEdit={mutation.reset}
        onSubmit={(values) => {
          mutation.mutate(values)
        }}
      />
    </>
  )
}
