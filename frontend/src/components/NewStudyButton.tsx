import { NewButton } from './NewButton'

// Only the project's admins can add studies to it.
export function NewStudyButton({
  projectCode,
  align,
}: {
  projectCode: string
  align?: 'start' | 'end'
}) {
  return (
    <NewButton
      to={`/projects/${encodeURIComponent(projectCode)}/studies/new`}
      need={{ role: 'admin', project: projectCode }}
      align={align}
    >
      New study
    </NewButton>
  )
}
