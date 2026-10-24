import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { api } from '../api/client'
import { fetchSamples, fetchStudy, fetchSubjects } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { SelectField, TextField } from '../components/FormFields'
import { PageTitle } from '../components/PageTitle'
import { namePattern, optionalText, text } from '../forms'
import { type SampleStatus, sampleStatusOptions } from '../labels'
import { errorBox, primaryButton, textLink } from '../styles'

type SampleCreate = components['schemas']['SampleCreate']
type Sample = components['schemas']['SampleRead']
type Subject = components['schemas']['SubjectRead']

const materialSuggestions = ['tissue', 'blood', 'plasma', 'serum', 'cells', 'DNA', 'RNA', 'protein']

class DuplicateNameError extends Error {}

async function createSample(projectCode: string, studyCode: string, body: SampleCreate) {
  const { data, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/samples',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`A sample called ${body.name} already exists in this study.`)
  }
  if (response.status === 404) {
    throw new Error(`There is no study ${studyCode} in project ${projectCode}.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw new Error('Could not create the sample. Please try again later.')
}

// A date without a time is stored as midday UTC, so it shows as the same day in any time zone.
function collectedAt(date: string | null) {
  return date && `${date}T12:00:00Z`
}

function SampleForm({
  projectCode,
  studyCode,
  subjects,
  samples,
  initialParentId,
}: {
  projectCode: string
  studyCode: string
  subjects: Subject[]
  samples: Sample[]
  initialParentId: string | null
}) {
  const studyPath = `/projects/${encodeURIComponent(projectCode)}/studies/${encodeURIComponent(studyCode)}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initialParent = samples.find((sample) => sample.id === initialParentId)
  const [parentId, setParentId] = useState(initialParent?.id ?? '')
  const [subjectId, setSubjectId] = useState(initialParent?.subject_id ?? '')
  const mutation = useMutation({
    mutationFn: (body: SampleCreate) => createSample(projectCode, studyCode, body),
    onSuccess: async (sample) => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode, 'samples'],
      })
      await navigate(`/samples/${sample.id}`)
    },
  })

  const nameError =
    mutation.error instanceof DuplicateNameError
      ? 'This name is already used in this study. Please choose another.'
      : undefined

  return (
    <form
      className="mt-6 max-w-2xl space-y-5"
      onChange={() => {
        if (mutation.isError) {
          mutation.reset()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        mutation.mutate({
          name: text(form, 'name'),
          material_type: text(form, 'material_type'),
          status: text(form, 'status') as SampleStatus,
          subject_id: subjectId || null,
          parent_sample_id: parentId || null,
          collected_at: collectedAt(optionalText(form, 'collected_on')),
          external_id: optionalText(form, 'external_id'),
        })
      }}
    >
      <TextField
        label="Name"
        name="name"
        hint="The name used by the study or its source, such as TCGA-A1-A0SB-01A. Spaces are allowed; slashes are not."
        error={nameError}
        required
        maxLength={200}
        pattern={namePattern}
        autoComplete="off"
      />
      <TextField
        label="Material"
        name="material_type"
        hint="What the sample is, such as tissue, blood, RNA or protein. Choose a suggestion or type your own."
        required
        maxLength={100}
        list="material-suggestions"
        autoComplete="off"
      />
      <datalist id="material-suggestions">
        {materialSuggestions.map((material) => (
          <option key={material} value={material} />
        ))}
      </datalist>
      <SelectField
        label="Status"
        name="status"
        options={sampleStatusOptions}
        defaultValue="registered"
        required
      />
      <SelectField
        label="Derived from"
        name="parent_sample_id"
        options={samples.map((sample) => ({
          value: sample.id,
          label: `${sample.name} (${sample.material_type})`,
        }))}
        value={parentId}
        onChange={(event) => {
          const parent = samples.find((sample) => sample.id === event.target.value)
          setParentId(event.target.value)
          if (parent?.subject_id) {
            setSubjectId(parent.subject_id)
          }
        }}
        optional
      />
      <SelectField
        label="Subject"
        name="subject_id"
        options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
        value={subjectId}
        onChange={(event) => {
          setSubjectId(event.target.value)
        }}
        optional
      />
      <TextField label="Collected" name="collected_on" type="date" optional />
      <TextField
        label="External ID"
        name="external_id"
        hint="The sample's ID in its source repository, such as a GDC sample UUID."
        maxLength={200}
        autoComplete="off"
        optional
        mono
      />

      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={mutation.isPending} className={primaryButton}>
          {mutation.isPending ? 'Creating…' : 'Create sample'}
        </button>
        <Link to={initialParent ? `/samples/${initialParent.id}` : studyPath} className={textLink}>
          Cancel
        </Link>
      </div>

      {mutation.isError && (
        <p role="alert" className={errorBox}>
          {mutation.error.message}
        </p>
      )}
    </form>
  )
}

export default function NewSamplePage() {
  const { code: projectCode = '', studyCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const study = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode],
    queryFn: () => fetchStudy(projectCode, studyCode),
  })
  const subjects = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'subjects'],
    queryFn: () => fetchSubjects(projectCode, studyCode),
  })
  const samples = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'samples'],
    queryFn: () => fetchSamples(projectCode, studyCode),
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: projectPath, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: studyCode, to: studyPath, mono: true },
          { label: 'New sample' },
        ]}
      />
      <PageTitle>New sample</PageTitle>
      <DetailList
        items={[
          ['Study', study.data?.title ?? null],
          ['Study code', <span className="font-mono">{studyCode}</span>],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      {subjects.isError || samples.isError ? (
        <p role="alert" className={`mt-6 ${errorBox}`}>
          Could not load the study's subjects and samples. Please try again later.
        </p>
      ) : subjects.data && samples.data ? (
        <SampleForm
          projectCode={projectCode}
          studyCode={studyCode}
          subjects={subjects.data}
          samples={samples.data}
          initialParentId={searchParams.get('parent')}
        />
      ) : (
        <p className="mt-6 text-muted">Loading…</p>
      )}
    </>
  )
}
