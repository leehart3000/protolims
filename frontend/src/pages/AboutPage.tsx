import { Link } from 'react-router'

import { ExternalLink } from '../components/ExternalLink'
import { PageTitle } from '../components/PageTitle'
import { SITE } from '../site'
import { textLink } from '../styles'
import { useMe } from '../useMe'

// Who can read this site, and whether it can be changed, as the site is set up now.
function HowItsUsed() {
  const { data: me } = useMe()
  if (me === undefined) {
    return null
  }
  const reading = me.public_read
    ? 'Anyone can browse this site, without signing in.'
    : 'This site is private: its records can be seen only by people signed in with a role on them.'
  const changing = me.read_only
    ? "It's read-only at the moment, so nothing can be changed."
    : 'People given a role on a project or study can add and change its records, and every change is recorded.'
  return (
    <p>
      {reading} {changing}
    </p>
  )
}

// What ProtoLIMS is, and about this site. Who runs it comes from site.ts.
export default function AboutPage() {
  return (
    <>
      <PageTitle>About ProtoLIMS</PageTitle>
      <div className="mt-6 max-w-3xl space-y-4">
        <p>
          <strong>ProtoLIMS</strong> is a laboratory information management system (LIMS) for
          multi-omics research. It records subjects and samples, and what each sample was made from;
          assays, and the data files they produce; and where each file came from.
        </p>
        <p>
          Each{' '}
          <Link to="/projects" className={textLink}>
            project's
          </Link>{' '}
          page says where its data came from, how it's licensed, and how to cite it.
        </p>
        <HowItsUsed />
        <p>
          ProtoLIMS is <strong>open source</strong>, under the{' '}
          <ExternalLink href="https://www.gnu.org/licenses/agpl-3.0.html">
            GNU Affero General Public License v3.0
          </ExternalLink>
          . This site's <ExternalLink href={SITE.sourceUrl}>source code</ExternalLink> is available,
          and its API is described at <ExternalLink href="/api/docs">/api/docs</ExternalLink>.
        </p>
        <p>
          This site is run by {SITE.operator}, {SITE.operatorDetail}. Contact:{' '}
          <a href={`mailto:${SITE.contactEmail}`} className={textLink}>
            {SITE.contactEmail}
          </a>
          . See also the{' '}
          <Link to="/privacy" className={textLink}>
            privacy notice
          </Link>
          .
        </p>
      </div>
    </>
  )
}
