import { Link } from 'react-router'

import { type AssayFiles, assaysWithWideFiles } from '../assayWideFiles'
import { textLink } from '../styles'

// Files that hold the data of all of an assay's samples (those with no samples of their own,
// such as each of a TMT plex's spectra files), as a line for each assay linking to it, where
// they're listed. `also` is for when other files are listed above.
export function AssayWideFiles({ assays, also }: { assays: AssayFiles[]; also: boolean }) {
  const shown = assaysWithWideFiles(assays)
  if (shown.length === 0) {
    return null
  }

  return (
    <ul className="mt-4 space-y-1 text-muted">
      {shown.map((assay) => {
        const count = assay.assay_wide_files
        return (
          <li key={assay.assay_id}>
            {also ? 'Also in' : 'In'} {count.toLocaleString('en-GB')}{' '}
            {count === 1 ? 'file' : 'files'} from assay{' '}
            <Link to={`/assays/${assay.assay_id}`} className={textLink}>
              {assay.assay_name}
            </Link>
            , which {count === 1 ? 'holds' : 'hold'} the data of all the assay's samples.
          </li>
        )
      })}
    </ul>
  )
}
