import { SquarePlus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { api } from '../api/client'
import { fetchAssayPage, fetchStudy } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataFileForm } from '../components/DataFileForm'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { DuplicateLocationError, invalidDetailsMessage } from '../dataFiles'
import { errorBox } from '../styles'
import { DuplicateExternalIdError, isExternalIdConflict } from '../forms'

type Assay = components['schemas']['AssayRead']
type DataFileCreate = components['schemas']['DataFileCreate']

async function createDataFile(projectCode: string, studyCode: string, body: DataFileCreate) {
  const { data, error, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/data-files',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError(
      'Another data file in this study already has this external ID.',
    )
  }
  if (response.status === 409) {
    throw new DuplicateLocationError('A file at this location is already recorded in this study.')
  }
  if (response.status === 404) {
    throw new Error(`There is no study ${studyCode} in project ${projectCode}.`)
  }
  if (response.status === 422) {
    throw new Error(invalidDetailsMessage(error))
  }
  throw new Error('Could not record the data file. Please try again later.')
}

function NewDataFileForm({
  projectCode,
  studyCode,
  assays,
  initialAssayId,
}: {
  projectCode: string
  studyCode: string
  assays: Assay[]
  initialAssayId: string | null
}) {
  const studyPath = `/projects/${encodeURIComponent(projectCode)}/studies/${encodeURIComponent(studyCode)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: DataFileCreate) => createDataFile(projectCode, studyCode, body),
    onSuccess: async (file) => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode, 'data-files'],
      })
      await navigate(`/data-files/${file.id}`)
    },
  })

  return (
    <DataFileForm
      assays={assays}
      initial={{
        name: '',
        uri: '',
        level: 'raw',
        format: '',
        assay_id: initialAssayId,
        size_bytes: null,
        sha256: null,
        external_id: null,
      }}
      submitLabel="Record data file"
      submitIcon={SquarePlus}
      pendingLabel="Recording…"
      cancelTo={initialAssayId ? `/assays/${initialAssayId}` : studyPath}
      isPending={mutation.isPending}
      error={mutation.error}
      onEdit={mutation.reset}
      onSubmit={(values) => {
        mutation.mutate(values)
      }}
    />
  )
}

export default function NewDataFilePage() {
  const { code: projectCode = '', studyCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const study = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode],
    queryFn: () => fetchStudy(projectCode, studyCode),
  })
  const assays = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'assays', 'all'],
    queryFn: async () => (await fetchAssayPage(projectCode, studyCode, { limit: 500 })).items,
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: studyCode, to: studyPath, mono: true },
          { label: 'New data file' },
        ]}
      />
      <PageTitle>New data file</PageTitle>
      <DetailList
        items={[
          ['Study', study.data?.title ?? null],
          ['Study code', <span className="font-mono">{studyCode}</span>],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      {assays.isError ? (
        <p role="alert" className={`mt-6 ${errorBox}`}>
          Could not load the study's assays. Please try again later.
        </p>
      ) : assays.data ? (
        <NewDataFileForm
          projectCode={projectCode}
          studyCode={studyCode}
          assays={assays.data}
          initialAssayId={searchParams.get('assay')}
        />
      ) : (
        <p className="mt-6 text-muted">Loading…</p>
      )}
    </>
  )
}
