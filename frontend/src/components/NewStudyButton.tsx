import { NewButton } from './NewButton'

// Only the project's admins can add studies to it.
export function NewStudyButton({
  projectCode,
  align,
  short,
}: {
  projectCode: string
  align?: 'start' | 'end'
  short?: boolean
}) {
  return (
    <NewButton
      to={`/projects/${encodeURIComponent(projectCode)}/studies/new`}
      need={{ role: 'admin', project: projectCode }}
      align={align}
      short={short}
    >
      New study
    </NewButton>
  )
}
