import { NewButton } from './NewButton'

export function NewStudyButton({ projectCode }: { projectCode: string }) {
  return (
    <NewButton to={`/projects/${encodeURIComponent(projectCode)}/studies/new`}>New study</NewButton>
  )
}
