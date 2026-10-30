import { NewButton } from './NewButton'

// Only the project's admins can add studies to it.
export function NewStudyButton({
  projectCode,
  align,
  round,
}: {
  projectCode: string
  align?: 'start' | 'end'
  round?: boolean
}) {
  return (
    <NewButton
      to={`/projects/${encodeURIComponent(projectCode)}/studies/new`}
      need={{ role: 'admin', project: projectCode }}
      align={align}
      round={round}
    >
      New study
    </NewButton>
  )
}
