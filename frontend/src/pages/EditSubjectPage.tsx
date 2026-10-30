import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchSubject } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PageTitle } from '../components/PageTitle'
import { SubjectForm } from '../components/SubjectForm'
import {
  DuplicateNameError,
  DuplicateExternalIdError,
  isExternalIdConflict,
  refusal,
} from '../forms'
import type { SubjectType } from '../labels'
import { errorBox } from '../styles'
import type { SubjectDetails } from '../subjects'
import { SaveIcon, SubjectIcon } from '../icons'
import { Permitted } from '../components/Permitted'
import { editorOf } from '../permissions'

type Subject = components['schemas']['SubjectRead']
type SubjectUpdate = components['schemas']['SubjectUpdate']

async function updateSubject(subjectId: string, body: SubjectUpdate, name: string) {
  const { data, error, response } = await api.PATCH('/api/v1/subjects/{subject_id}', {
    params: { path: { subject_id: subjectId } },
    body,
  })
  if (data) {
    return data
  }
  if (response.status === 409 && isExternalIdConflict(error)) {
    throw new DuplicateExternalIdError(
      'Another subject in this study already has this external ID.',
    )
  }
  if (response.status === 409) {
    throw new DuplicateNameError(`A subject called ${name} already exists in this study.`)
  }
  if (response.status === 422) {
    throw new Error('Some of the details are not valid. Please check them and try again.')
  }
  throw refusal(response.status, 'Could not save the changes. Please try again later.')
}

// Only the fields that were changed are sent.
function changedFields(initial: SubjectDetails, values: SubjectDetails): SubjectUpdate {
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== initial[key as keyof SubjectDetails]),
  )
  return body
}

function EditSubject({ subject }: { subject: Subject }) {
  const { project_code: projectCode, study_code: studyCode } = subject
  const projectPath = `/projects/${encodeURIComponent(projectCode)}`
  const studyPath = `${projectPath}/studies/${encodeURIComponent(studyCode)}`
  const subjectPath = `/subjects/${subject.id}`
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initial: SubjectDetails = {
    name: subject.name,
    subject_type: subject.subject_type as SubjectType,
    species: subject.species,
    external_id: subject.external_id,
  }
  const mutation = useMutation({
    mutationFn: (values: SubjectDetails) =>
      updateSubject(subject.id, changedFields(initial, values), values.name),
    onSuccess: async () => {
      // Sample pages and lists show subjects' names, so they're refreshed too.
      await queryClient.invalidateQueries({ queryKey: ['subjects'] })
      await queryClient.invalidateQueries({ queryKey: ['samples'] })
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectCode, 'studies', studyCode],
      })
      await navigate(subjectPath)
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
          { label: subject.name, to: subjectPath },
          { label: 'Edit' },
        ]}
      />
      <PageTitle icon={SubjectIcon} label="Edit subject">
        {subject.name}
      </PageTitle>

      <Permitted need={editorOf(projectCode, studyCode)}>
        <SubjectForm
          initial={initial}
          submitLabel="Save changes"
          submitIcon={SaveIcon}
          pendingLabel="Saving…"
          cancelTo={subjectPath}
          isPending={mutation.isPending}
          error={mutation.error}
          onEdit={mutation.reset}
          onSubmit={(values) => {
            mutation.mutate(values)
          }}
        />
      </Permitted>
    </>
  )
}

export default function EditSubjectPage() {
  const { subjectId = '' } = useParams()
  const query = useQuery({
    queryKey: ['subjects', subjectId],
    queryFn: () => fetchSubject(subjectId),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading subject…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load subject. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Subject not found</PageTitle>
        <p className="mt-3 text-muted">There is no subject at this address.</p>
      </>
    )
  }

  return <EditSubject subject={query.data} />
}
