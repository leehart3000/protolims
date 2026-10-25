import { SquarePlus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import { fetchStudy } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { SelectField, TextField } from '../components/FormFields'
import { PageTitle } from '../components/PageTitle'
import { namePattern, optionalText, text } from '../forms'
import { type SubjectType, subjectTypeOptions } from '../labels'
import { errorBox, primaryButton, textLink } from '../styles'

type SubjectCreate = components['schemas']['SubjectCreate']

class DuplicateNameError extends Error {}

async function createSubject(projectCode: string, studyCode: string, body: SubjectCreate) {
  const { data, response } = await api.POST(
    '/api/v1/projects/{project_code}/studies/{study_code}/subjects',
    { params: { path: { project_code: projectCode, study_code: studyCode } }, body },
  )
  if (data) {
    return data
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
  throw new Error('Could not create the subject. Please try again later.')
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

  const nameError =
    mutation.error instanceof DuplicateNameError
      ? 'This name is already used in this study. Please choose another.'
      : undefined

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
            subject_type: text(form, 'subject_type') as SubjectType,
            species: optionalText(form, 'species'),
            external_id: optionalText(form, 'external_id'),
          })
        }}
      >
        <TextField
          label="Name"
          name="name"
          hint="The name used by the study or its source, such as TCGA-A1-A0SB or Hs 578T. Spaces are allowed; slashes are not."
          error={nameError}
          required
          maxLength={200}
          pattern={namePattern}
          autoComplete="off"
        />
        <SelectField
          label="Type"
          name="subject_type"
          options={subjectTypeOptions}
          defaultValue=""
          required
        />
        <TextField
          label="Species"
          name="species"
          hint="For example, Homo sapiens."
          maxLength={200}
          optional
        />
        <TextField
          label="External ID"
          name="external_id"
          hint="The subject's ID in its source repository, such as a GDC case UUID."
          maxLength={200}
          autoComplete="off"
          optional
          mono
        />

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={`${primaryButton} inline-flex items-center gap-2`}
          >
            <SquarePlus aria-hidden="true" className="size-4 shrink-0" />
            {mutation.isPending ? 'Creating…' : 'Create subject'}
          </button>
          <Link to={studyPath} className={textLink}>
            Cancel
          </Link>
        </div>

        {mutation.isError && (
          <p role="alert" className={errorBox}>
            {mutation.error.message}
          </p>
        )}
      </form>
    </>
  )
}
