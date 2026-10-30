import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { api } from '../api/client'
import { fetchSamples, fetchStudy, fetchSubjects } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { SampleForm } from '../components/SampleForm'
import {
  DuplicateNameError,
  DuplicateExternalIdError,
  isExternalIdConflict,
  refusal,
} from '../forms'
import { collectedAt } from '../samples'
import { errorBox } from '../styles'
import { NewIcon, SampleIcon } from '../icons'
import { Permitted } from '../components/Permitted'
import { editorOf } from '../permissions'

type SampleCreate = components['schemas']['SampleCreate']
type Sample = components['schemas']['SampleRead']
type Subject = components['schemas']['SubjectRead']

async function createSample(projectCode: string, studyCode: string, body: SampleCreate) {
  const { data, error, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/samples',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError('Another sample in this study already has this external ID.')
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
  throw refusal(response.status, 'Could not create the sample. Please try again later.')
}

function NewSampleForm({
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
  const parent = samples.find((sample) => sample.id === initialParentId)
  const mutation = useMutation({
    mutationFn: (body: SampleCreate) => createSample(projectCode, studyCode, body),
    onSuccess: async (sample) => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode, 'samples'],
      })
      await navigate(`/samples/${sample.id}`)
    },
  })

  return (
    <SampleForm
      subjects={subjects}
      samples={samples}
      initial={{
        name: '',
        material_type: '',
        status: 'registered',
        subject_id: parent?.subject_id ?? null,
        parent_sample_id: parent?.id ?? null,
        collected_on: null,
        external_id: null,
      }}
      submitLabel="Create sample"
      submitIcon={NewIcon}
      pendingLabel="Creating…"
      cancelTo={parent ? `/samples/${parent.id}` : studyPath}
      isPending={mutation.isPending}
      error={mutation.error}
      onEdit={mutation.reset}
      onSubmit={({ collected_on, ...values }) => {
        mutation.mutate({ ...values, collected_at: collectedAt(collected_on) })
      }}
    />
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
      <PageTitle icon={SampleIcon}>New sample</PageTitle>
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
        <Permitted need={editorOf(projectCode, studyCode)}>
          <NewSampleForm
            projectCode={projectCode}
            studyCode={studyCode}
            subjects={subjects.data}
            samples={samples.data}
            initialParentId={searchParams.get('parent')}
          />
        </Permitted>
      ) : (
        <p className="mt-6 text-muted">Loading…</p>
      )}
    </>
  )
}
