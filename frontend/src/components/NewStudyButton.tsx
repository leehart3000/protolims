import { Link } from 'react-router'

import { primaryButton } from '../styles'

export function NewStudyButton({ projectCode }: { projectCode: string }) {
  return (
    <Link
      to={`/projects/${encodeURIComponent(projectCode)}/studies/new`}
      className={`${primaryButton} inline-block text-sm`}
    >
      New study
    </Link>
  )
}
