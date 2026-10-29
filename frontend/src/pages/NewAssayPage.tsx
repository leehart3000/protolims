import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchStudy } from '../api/queries'
import type { components } from '../api/schema'
import { performedAt } from '../assays'
import { AssayForm } from '../components/AssayForm'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { NewIcon } from '../icons'
import {
  DuplicateNameError,
  DuplicateExternalIdError,
  isExternalIdConflict,
  refusal,
} from '../forms'

type AssayCreate = components['schemas']['AssayCreate']

async function createAssay(projectCode: string, studyCode: string, body: AssayCreate) {
  const { data, error, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/assays',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError('Another assay in this study already has this external ID.')
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`An assay called ${body.name} already exists in this study.`)
  }
  if (response.status === 404) {
    throw new Error(`There is no study ${studyCode} in project ${projectCode}.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not create the assay. Please try again later.')
}

export default function NewAssayPage() {
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
    mutationFn: (body: AssayCreate) => createAssay(projectCode, studyCode, body),
    onSuccess: async (assay) => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode, 'assays'],
      })
      await navigate(`/assays/${assay.id}`)
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
          { label: 'New assay' },
        ]}
      />
      <PageTitle>New assay</PageTitle>
      <DetailList
        items={[
          ['Study', study.data?.title ?? null],
          ['Study code', <span className="font-mono">{studyCode}</span>],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      <AssayForm
        initial={{
          name: '',
          measurement_type: '',
          technology_type: '',
          platform: null,
          performed_on: null,
          external_id: null,
        }}
        submitLabel="Create assay"
        submitIcon={NewIcon}
        pendingLabel="Creating…"
        cancelTo={studyPath}
        isPending={mutation.isPending}
        error={mutation.error}
        onEdit={mutation.reset}
        onSubmit={({ performed_on, ...values }) => {
          mutation.mutate({ ...values, performed_at: performedAt(performed_on) })
        }}
      />
    </>
  )
}
