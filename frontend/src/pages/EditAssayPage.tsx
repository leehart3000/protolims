import { Save } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchAssay } from '../api/queries'
import type { components } from '../api/schema'
import { type AssayFormValues, performedAt } from '../assays'
import { AssayForm } from '../components/AssayForm'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { DuplicateNameError } from '../forms'
import { errorBox } from '../styles'

type Assay = components['schemas']['AssayRead']
type AssayUpdate = components['schemas']['AssayUpdate']

async function updateAssay(assayId: string, body: AssayUpdate, name: string) {
  const { data, response } = await api.PATCH('/api/v1/assays/{assay_id}', {
    params: { path: { assay_id: assayId } },
    body,
  })
  if (data) {
    return data
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`An assay called ${name} already exists in this study.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw new Error('Could not save the changes. Please try again later.')
}

function formValues(assay: Assay): AssayFormValues {
  return {
    name: assay.name,
    measurement_type: assay.measurement_type,
    technology_type: assay.technology_type,
    platform: assay.platform,
    performed_on: assay.performed_at?.slice(0, 10) ?? null,
    external_id: assay.external_id,
  }
}

// Only the fields that were changed are sent, so an unchanged time isn't replaced by midday
// on the same day.
function changedFields(initial: AssayFormValues, values: AssayFormValues): AssayUpdate {
  const { performed_on: initialDate, ...initialRest } = initial
  const { performed_on: date, ...rest } = values
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(
      ([key, value]) => value !== initialRest[key as keyof typeof initialRest],
    ),
  )
  if (date !== initialDate) {
    body.performed_at = performedAt(date)
  }
  return body
}

function EditAssay({ assay }: { assay: Assay }) {
  const { project_code: projectCode, study_code: studyCode } = assay
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const assayPath = `/assays/${assay.id}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initial = formValues(assay)
  const mutation = useMutation({
    mutationFn: (values: AssayFormValues) =>
      updateAssay(assay.id, changedFields(initial, values), values.name),
    onSuccess: async () => {
      // The study's list of assays shows these details too, so it's refreshed as well.
      await queryClient.invalidateQueries({ queryKey: ['assays'] })
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode],
      })
      await navigate(assayPath)
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
          { label: assay.name, to: assayPath },
          { label: 'Edit' },
        ]}
      />
      <PageTitle label="Edit assay">{assay.name}</PageTitle>

      <AssayForm
        initial={initial}
        submitLabel="Save changes"
        submitIcon={Save}
        pendingLabel="Saving…"
        cancelTo={assayPath}
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

export default function EditAssayPage() {
  const { assayId = '' } = useParams()
  const query = useQuery({
    queryKey: ['assays', assayId],
    queryFn: () => fetchAssay(assayId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading assay…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load assay. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Assay not found</PageTitle>
        <p className="mt-3 text-muted">There is no assay at this address.</p>
      </>
    )
  }

  return <EditAssay assay={query.data} />
}
