import type { ReactNode } from 'react'

import { ExternalLink } from '../components/ExternalLink'
import { PageTitle } from '../components/PageTitle'
import { SITE } from '../site'
import { textLink } from '../styles'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Email() {
  return (
    <a href={`mailto:${SITE.contactEmail}`} className={textLink}>
      {SITE.contactEmail}
    </a>
  )
}

// The site's privacy notice. What the software keeps is the same everywhere; who runs the site,
// and where it's hosted, come from site.ts.
export default function PrivacyPage() {
  return (
    <>
      <PageTitle>Privacy notice</PageTitle>

      <Section title="Who runs this site">
        <p>
          This site is run by {SITE.operator}, {SITE.operatorDetail}. {SITE.operator} decides how
          personal data here is used, and is the data controller. Contact: <Email />.
        </p>
      </Section>

      <Section title="What the site doesn't do">
        <p>
          There are no adverts, no analytics or tracking scripts, and nothing is sold or shared for
          marketing. You don't need to sign in to read whatever this site makes public.
        </p>
      </Section>

      <Section title="If you sign in with ORCID">
        <p>
          Signing in is for people given a role here, to add or change records. The site then keeps:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            your <strong>ORCID iD</strong>, and your <strong>name</strong> as your ORCID record
            shares it (updated each time you sign in);
          </li>
          <li>
            <strong>when you first and last signed in</strong>;
          </li>
          <li>
            a record of each <strong>signed-in browser</strong> (only a scrambled copy of its
            cookie), until you sign out or it expires;
          </li>
          <li>
            any <strong>roles</strong> you're given on projects or studies, and any{' '}
            <strong>API tokens</strong> you make (their name and dates; only a scrambled copy of the
            token itself).
          </li>
        </ul>
        <p>
          An administrator may also add your ORCID iD to a project or study before you've signed in.
        </p>
        <p>
          <strong>Changes you make</strong> (to records, roles or tokens) are recorded with your
          ORCID iD and the time, in an audit trail. This is part of the scientific record of where
          the data came from.
        </p>
      </Section>

      <Section title="Cookies and your browser">
        <p>
          The site sets only two cookies, both needed for signing in: one lasting 10 minutes while
          ORCID checks who you are, and your session, lasting up to 14 days. If you choose light or
          dark mode, that choice is saved in your own browser, not sent to the site.
        </p>
      </Section>

      <Section title="What the hosts record">
        <p>
          Like any website, each request passes through services that keep short-term logs of it.
          Those logs include your IP address, the page asked for, and your browser's description.
        </p>
      </Section>

      <Section title="Why (lawful basis)">
        <p>
          Legitimate interests: running the site, keeping it secure, and keeping an accurate record
          of changes to scientific data.
        </p>
      </Section>

      <Section title="Who processes it for this site">
        <ul className="list-disc space-y-1 pl-6">
          {SITE.processors.map(({ name, role }) => (
            <li key={name}>
              <strong>{name}</strong> {role}.
            </li>
          ))}
        </ul>
        <p>
          Where data leaves the country, it's under those providers' published safeguards for
          international transfers.
        </p>
      </Section>

      <Section title="How long it's kept">
        <ul className="list-disc space-y-1 pl-6">
          <li>Your account details: while you have an account.</li>
          <li>Sessions: 14 days at most.</li>
          <li>API tokens: until they expire or you revoke them.</li>
          <li>Backups: {SITE.backupDays} days.</li>
          <li>Hosting logs: {SITE.logsKept}.</li>
          <li>The audit trail: kept as part of the scientific record.</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask to see the personal data held about you, have it corrected, or have it
          deleted, and you can object to how it's used. Email <Email />.
        </p>
        <p>
          If you have signed in, your name stays attached to the changes you made, as part of the
          record. Your account and roles can be removed, and your name taken out where that doesn't
          break the record.
        </p>
        <p>
          You can also complain to{' '}
          <ExternalLink href={SITE.regulator.url}>{SITE.regulator.name}</ExternalLink>.
        </p>
      </Section>

      <Section title="Changes to this notice">
        <p>Changes will be shown here, with the date. Last updated: {SITE.privacyUpdated}.</p>
      </Section>
    </>
  )
}
