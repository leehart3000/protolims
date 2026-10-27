import { Save } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchAssayPage, fetchDataFile } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataFileForm } from '../components/DataFileForm'
import { PageTitle } from '../components/PageTitle'
import {
  type DataFileFormValues,
  DuplicateLocationError,
  invalidDetailsMessage,
} from '../dataFiles'
import type { DataFileLevel } from '../labels'
import { errorBox } from '../styles'
import { DuplicateExternalIdError, isExternalIdConflict } from '../forms'

type DataFile = components['schemas']['DataFileRead']
type DataFileUpdate = components['schemas']['DataFileUpdate']

async function updateDataFile(dataFileId: string, body: DataFileUpdate) {
  const { data, error, response } = await api.PATCH('/api/v1/data-files/{data_file_id}', {
    params: { path: { data_file_id: dataFileId } },
    body,
  })
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
  if (response.status === 422) {
    throw new Error(invalidDetailsMessage(error))
  }
  throw new Error('Could not save the changes. Please try again later.')
}

function formValues(file: DataFile): DataFileFormValues {
  return {
    name: file.name,
    uri: file.uri,
    level: file.level as DataFileLevel,
    format: file.format,
    assay_id: file.assay_id,
    size_bytes: file.size_bytes,
    sha256: file.sha256,
    external_id: file.external_id,
  }
}

// Only the fields that were changed are sent.
function changedFields(initial: DataFileFormValues, values: DataFileFormValues): DataFileUpdate {
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => value !== initial[key as keyof DataFileFormValues],
    ),
  )
  return body
}

function EditDataFile({ file }: { file: DataFile }) {
  const { project_code: projectCode, study_code: studyCode } = file
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const filePath = `/data-files/${file.id}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const assays = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'assays', 'all'],
    queryFn: async () => (await fetchAssayPage(projectCode, studyCode, { limit: 500 })).items,
  })
  const initial = formValues(file)
  const mutation = useMutation({
    mutationFn: (values: DataFileFormValues) =>
      updateDataFile(file.id, changedFields(initial, values)),
    onSuccess: async () => {
      // The study's list of files shows these details too, so it's refreshed as well.
      await queryClient.invalidateQueries({ queryKey: ['data-files'] })
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode],
      })
      await navigate(filePath)
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
          { label: file.name, to: filePath },
          { label: 'Edit' },
        ]}
      />
      <PageTitle label="Edit data file">{file.name}</PageTitle>

      {assays.isError ? (
        <p role="alert" className={`mt-6 ${errorBox}`}>
          Could not load the study's assays. Please try again later.
        </p>
      ) : assays.data ? (
        <DataFileForm
          assays={assays.data}
          initial={initial}
          submitLabel="Save changes"
          submitIcon={Save}
          pendingLabel="Saving…"
          cancelTo={filePath}
          isPending={mutation.isPending}
          error={mutation.error}
          onEdit={mutation.reset}
          onSubmit={(values) => {
            mutation.mutate(values)
          }}
        />
      ) : (
        <p className="mt-6 text-muted">Loading…</p>
      )}
    </>
  )
}

export default function EditDataFilePage() {
  const { dataFileId = '' } = useParams()
  const query = useQuery({
    queryKey: ['data-files', dataFileId],
    queryFn: () => fetchDataFile(dataFileId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading data file…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load data file. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Data file not found</PageTitle>
        <p className="mt-3 text-muted">There is no data file at this address.</p>
      </>
    )
  }

  return <EditDataFile file={query.data} />
}
