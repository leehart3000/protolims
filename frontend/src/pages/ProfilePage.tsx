import { Link, useLocation } from 'react-router'

import type { components } from '../api/schema'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { SectionHeading } from '../components/SectionHeading'
import { SignOutButton } from '../components/SignOutButton'
import { SiteAdminBadge } from '../components/SiteAdminBadge'
import { ProfileIcon, ExternalIcon, MembersIcon, SignInIcon } from '../icons'
import { ROLE_OPTIONS } from '../members'
import { signInHref } from '../signIn'
import {
  primaryButton,
  secondaryButton,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
  textLink,
} from '../styles'
import { useMe } from '../useMe'

type Me = components['schemas']['Me']
type Role = Me['roles'][number]

// What a role lets someone do where they have it.
function allows(role: Role) {
  if (role.role === 'viewer') {
    return 'You can see its records.'
  }
  if (role.role === 'editor') {
    return 'You can see, add and change its records.'
  }
  return role.study === null
    ? 'You can see, add and change its records, manage its viewers and editors, and choose its study admins.'
    : 'You can see, add and change its records, and manage its viewers and editors.'
}

function roleLabel(role: Role) {
  return ROLE_OPTIONS.find((option) => option.value === role.role)?.label ?? role.role
}

// Where a role is: a project, or a study in one, linked to its page.
function Place({ role }: { role: Role }) {
  const projectPath = `/projects/${encodeURIComponent(role.project)}`
  if (role.study === null) {
    return (
      <>
        Project{' '}
        <Link to={projectPath} className={`${textLink} font-mono`}>
          {role.project}
        </Link>
      </>
    )
  }
  return (
    <>
      Study{' '}
      <Link
        to={`${projectPath}/studies/${encodeURIComponent(role.study)}`}
        className={`${textLink} font-mono`}
      >
        {role.study}
      </Link>{' '}
      in <span className="font-mono">{role.project}</span>
    </>
  )
}

// What to say when someone has no roles, which depends on whether everyone can read this site.
function noRolesText(me: Me) {
  if (me.site_admin) {
    return "As a site administrator you don't need roles: you can see and change everything."
  }
  return me.public_read
    ? 'You have no roles yet, so you can see everything here but not change anything. A project or study admin can give you a role.'
    : 'You have no roles yet, so there is nothing here for you to see. A project or study admin can give you a role.'
}

function Roles({ me }: { me: Me }) {
  if (me.roles.length === 0) {
    return <p className="mt-3 max-w-2xl text-muted">{noRolesText(me)}</p>
  }
  return (
    <>
      <p className="mt-3 max-w-2xl text-muted">
        A role on a project covers all of its studies. Where you have roles on both a project and
        one of its studies, the higher one applies.
      </p>
      <div className={`mt-4 ${tableWrapper}`}>
        <table className={table} aria-label="Your roles">
          <thead className={tableHead}>
            <tr>
              <th scope="col" className={tableHeader}>
                Where
              </th>
              <th scope="col" className={tableHeader}>
                Role
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {me.roles.map((role) => (
              <tr key={`${role.project}/${role.study ?? ''}`}>
                <td className={tableCell}>
                  <Place role={role} />
                </td>
                <td className={tableCell}>
                  <span className="font-medium">{roleLabel(role)}</span>
                  <p className="mt-1 text-muted">{allows(role)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// The signed-in person's profile: who they are, and what they can do here.
export default function ProfilePage() {
  const { data: me } = useMe()
  const location = useLocation()

  if (me === undefined) {
    return null
  }

  if (me.user === null) {
    return (
      <>
        <PageTitle icon={ProfileIcon}>Your profile</PageTitle>
        <p className="mt-3 text-muted">You're not signed in.</p>
        <p className="mt-6">
          <a
            href={signInHref(location.pathname, location.search)}
            className={`${primaryButton} inline-flex items-center gap-2`}
          >
            <SignInIcon aria-hidden="true" className="size-5" />
            Sign in with ORCID
          </a>
        </p>
      </>
    )
  }

  const { user } = me
  return (
    <>
      <PageTitle icon={ProfileIcon}>Your profile</PageTitle>
      <DetailList
        items={[
          ['Name', user.name ?? <span className="text-muted italic">Private on ORCID</span>],
          [
            'ORCID iD',
            <a
              className={`${textLink} inline-flex items-center gap-1 font-mono`}
              href={`https://orcid.org/${user.subject}`}
              aria-label={`${user.subject} (opens in a new tab)`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {user.subject}
              <ExternalIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </a>,
          ],
          [
            'Site admin',
            me.site_admin ? (
              <>
                <SiteAdminBadge label />
                <p className="mt-1 font-normal text-muted">
                  You can see and change everything, create projects, and choose project admins.
                </p>
              </>
            ) : null,
          ],
        ]}
      />

      <SectionHeading icon={MembersIcon} className="mt-8">
        Your roles
      </SectionHeading>
      <Roles me={me} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <SignOutButton className={`${secondaryButton} inline-flex items-center gap-2`} />
      </div>
    </>
  )
}
