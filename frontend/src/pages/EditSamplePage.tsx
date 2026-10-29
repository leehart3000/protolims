import { Save } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchSample, fetchSamples, fetchSubjects } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { SampleForm } from '../components/SampleForm'
import type { SampleStatus } from '../labels'
import {
  DuplicateNameError,
  DuplicateExternalIdError,
  isExternalIdConflict,
  refusal,
} from '../forms'
import { collectedAt, type SampleFormValues } from '../samples'
import { errorBox } from '../styles'

type Sample = components['schemas']['SampleRead']
type SampleUpdate = components['schemas']['SampleUpdate']

async function updateSample(sampleId: string, body: SampleUpdate, name: string) {
  const { data, error, response } = await api.PATCH('/api/v1/samples/{sample_id}', {
    params: { path: { sample_id: sampleId } },
    body,
  })
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError('Another sample in this study already has this external ID.')
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`A sample called ${name} already exists in this study.`)
  }
  if (response.status === 422) {
    // A broken rule, such as a loop in the lineage, is explained in words; invalid details
    // come back as a list.
    const detail: unknown = (error as { detail?: unknown }).detail
    throw new Error(
      typeof detail === 'string'
        ? detail
        : 'Some of the details are not valid. Please check them and try again.',
    )
  }
  throw refusal(response.status, 'Could not save the changes. Please try again later.')
}

function formValues(sample: Sample): SampleFormValues {
  return {
    name: sample.name,
    material_type: sample.material_type,
    status: sample.status as SampleStatus,
    subject_id: sample.subject_id,
    parent_sample_id: sample.parent_sample_id,
    collected_on: sample.collected_at?.slice(0, 10) ?? null,
    external_id: sample.external_id,
  }
}

// Only the fields that were changed are sent, so an unchanged collection time isn't
// replaced by midday on the same day.
function changedFields(initial: SampleFormValues, values: SampleFormValues): SampleUpdate {
  const { collected_on: initialDate, ...initialRest } = initial
  const { collected_on: date, ...rest } = values
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(
      ([key, value]) => value !== initialRest[key as keyof typeof initialRest],
    ),
  )
  if (date !== initialDate) {
    body.collected_at = collectedAt(date)
  }
  return body
}

// The samples this one could be derived from: not itself, nor anything derived from it,
// directly or not, as that would make a loop.
function possibleParents(sample: Sample, samples: Sample[]) {
  const excluded = new Set([sample.id])
  let added = true
  while (added) {
    added = false
    for (const other of samples) {
      if (
        other.parent_sample_id &&
        excluded.has(other.parent_sample_id) &&
        !excluded.has(other.id)
      ) {
        excluded.add(other.id)
        added = true
      }
    }
  }
  return samples.filter((other) => !excluded.has(other.id))
}

function EditSample({ sample }: { sample: Sample }) {
  const { project_code: projectCode, study_code: studyCode } = sample
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const samplePath = `/samples/${sample.id}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const subjects = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'subjects'],
    queryFn: () => fetchSubjects(projectCode, studyCode),
  })
  const samples = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'samples'],
    queryFn: () => fetchSamples(projectCode, studyCode),
  })
  const initial = formValues(sample)
  const mutation = useMutation({
    mutationFn: (values: SampleFormValues) =>
      updateSample(sample.id, changedFields(initial, values), values.name),
    onSuccess: async () => {
      // Other pages may show this sample's name or details, so they're refreshed too.
      await queryClient.invalidateQueries({ queryKey: ['samples'] })
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode],
      })
      await navigate(samplePath)
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
          { label: sample.name, to: samplePath },
          { label: 'Edit' },
        ]}
      />
      <PageTitle label="Edit sample">{sample.name}</PageTitle>

      {subjects.isError || samples.isError ? (
        <p role="alert" className={`mt-6 ${errorBox}`}>
          Could not load the study's subjects and samples. Please try again later.
        </p>
      ) : subjects.data && samples.data ? (
        <SampleForm
          subjects={subjects.data}
          samples={possibleParents(sample, samples.data)}
          parentHint="This sample and the samples derived from it aren't listed, as a sample can't be derived from itself."
          initial={initial}
          submitLabel="Save changes"
          submitIcon={Save}
          pendingLabel="Saving…"
          cancelTo={samplePath}
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

export default function EditSamplePage() {
  const { sampleId = '' } = useParams()
  const query = useQuery({
    queryKey: ['samples', sampleId],
    queryFn: () => fetchSample(sampleId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading sample…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load sample. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Sample not found</PageTitle>
        <p className="mt-3 text-muted">There is no sample at this address.</p>
      </>
    )
  }

  return <EditSample sample={query.data} />
}
