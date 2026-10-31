import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { fetchMembers } from '../api/queries'
import type { components } from '../api/schema'
import { text } from '../forms'
import { AddPersonIcon, MembersIcon, RemovePersonIcon, SaveIcon } from '../icons'
import { changeRole, orcidPattern, type Place, type Role, ROLE_OPTIONS } from '../members'
import { READ_ONLY_REASON, roleOn } from '../permissions'
import {
  dangerButton,
  errorBox,
  inputClass,
  primaryButton,
  secondaryButton,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
} from '../styles'
import { useMe } from '../useMe'
import { DisabledButton } from './DisabledButton'
import { PersonCell } from './PersonCell'
import { SectionHeading } from './SectionHeading'

type Member = components['schemas']['MemberRead']

// Who has a role on a project, or on a study itself, and changing that. Only the project's or
// study's admins (and site administrators) see it; it's hidden from everyone else.
export function MembersSection(place: Place) {
  const { projectCode, studyCode } = place
  const { data: me } = useMe()
  if (me === undefined || roleOn(me, projectCode, studyCode) !== 'admin') {
    return null
  }
  if (me.read_only) {
    return (
      <section className="mt-10">
        <SectionHeading icon={MembersIcon}>Members</SectionHeading>
        <p className="mt-2 max-w-3xl text-muted">{READ_ONLY_REASON}</p>
      </section>
    )
  }
  // Only someone at the level above can give or take away an admin role: a site administrator
  // for project admins, and a project admin for study admins (the API checks this too).
  const adminLocked =
    studyCode === undefined
      ? me.site_admin
        ? undefined
        : 'Only a site administrator can give or take away the project admin role.'
      : roleOn(me, projectCode) === 'admin'
        ? undefined
        : "Only the project's admins can give or take away the study admin role."
  return <Members place={place} adminLocked={adminLocked} />
}

// Gold, for a button with something waiting to be done, such as an unsaved change. Dark text
// on gold reads well in both themes.
const unsavedButton =
  'rounded-md border border-gold bg-gold px-3 py-1.5 text-sm font-medium text-ink hover:bg-gold/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60'

// Less padding on phones, so the three columns fit without scrolling.
const cell = `${tableCell} max-sm:px-2`
const header = `${tableHeader} max-sm:px-2`

// The name of a role, as shown: "Editor", for example.
function roleLabel(role: Role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

// One person's row: a new role is chosen, then saved; or they're removed (role null), once
// that's confirmed.
// For anyone who can't give or take away an admin role here (`adminLocked` says why), an
// admin's row is read-only, and Admin can't be chosen for anyone else.
function MemberRow({
  member,
  busy,
  adminLocked,
  onChange,
}: {
  member: Member
  busy: boolean
  adminLocked?: string
  onChange: (role: Role | null) => void
}) {
  const { user, role } = member
  const [chosen, setChosen] = useState<Role>(role)
  const unsaved = chosen !== role
  const who = user.name ?? user.subject
  const unsavedId = useId()
  const [confirming, setConfirming] = useState(false)

  const locked = role === 'admin' ? adminLocked : undefined
  if (locked) {
    return (
      <tr>
        <td className={cell}>
          <PersonCell user={user} />
        </td>
        <td className={cell}>{roleLabel(role)}</td>
        <td className={cell}>
          <DisabledButton
            icon={RemovePersonIcon}
            className={secondaryButton}
            reason={locked}
            label={`Remove ${who}`}
          >
            <span className="hidden sm:inline">Remove</span>
          </DisabledButton>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr>
        <td className={cell}>
          <PersonCell user={user} />
        </td>
        <td className={cell}>
          {/* Save goes under the role on narrow screens. */}
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <select
              aria-label={`Role for ${who}`}
              value={chosen}
              disabled={busy}
              onChange={(event) => {
                setChosen(event.target.value as Role)
              }}
              className="rounded-md border border-line bg-panel px-2 py-1"
            >
              {ROLE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'admin' && adminLocked !== undefined}
                >
                  {option.label}
                </option>
              ))}
            </select>
            {/* Gold while there's a change to save, so it isn't missed. */}
            <button
              type="button"
              aria-label={`Save role for ${who}`}
              aria-describedby={unsaved ? unsavedId : undefined}
              disabled={busy || !unsaved}
              onClick={() => {
                onChange(chosen)
              }}
              className={`${unsaved ? unsavedButton : secondaryButton} inline-flex items-center gap-2`}
            >
              <SaveIcon aria-hidden="true" className="size-4 shrink-0" />
              Save
            </button>
            {unsaved && (
              <span id={unsavedId} className="sr-only">
                Unsaved change
              </span>
            )}
          </div>
        </td>
        <td className={cell}>
          <button
            type="button"
            aria-label={`Remove ${who}`}
            aria-expanded={confirming}
            disabled={busy}
            onClick={() => {
              setConfirming(true)
            }}
            className={`${secondaryButton} inline-flex items-center gap-2`}
          >
            <RemovePersonIcon aria-hidden="true" className="size-4 shrink-0" />
            {/* Just the icon on narrow screens; the button's label still names who. */}
            <span className="hidden sm:inline">Remove</span>
          </button>
        </td>
      </tr>
      {/* The question goes on a row of its own, across the table, so it never makes the table
        wider than the screen. */}
      {confirming && (
        <tr>
          <td colSpan={3} className={`${cell} bg-danger-bg`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm font-medium text-danger">Remove {who}&rsquo;s role?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onChange(null)
                  }}
                  className={dangerButton}
                >
                  Yes, remove
                </button>
                {/* Focus starts on Cancel, the safe choice. */}
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setConfirming(false)
                  }}
                  className={secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Members({ place, adminLocked }: { place: Place; adminLocked?: string }) {
  const { projectCode, studyCode } = place
  const queryKey = ['members', projectCode, studyCode ?? null]
  const queryClient = useQueryClient()
  const members = useQuery({ queryKey, queryFn: () => fetchMembers(projectCode, studyCode) })
  // What the last change did, so there's evidence of it.
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: ({ orcidId, role }: { orcidId: string; role: Role | null; who: string }) =>
      changeRole(place, orcidId, role),
    onMutate: () => {
      setNotice('')
    },
    onSuccess: (_, { role, who }) => {
      setNotice(
        role === null
          ? `${who}’s role was removed.`
          : `${who} now has the ${roleLabel(role)} role.`,
      )
      // Someone's own roles may have changed too.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ])
    },
  })
  const orcidId = useId()
  const roleId = useId()

  return (
    <section className="mt-10">
      <SectionHeading icon={MembersIcon}>Members</SectionHeading>
      <p className="mt-2 max-w-3xl text-muted">
        {studyCode === undefined
          ? 'People with a role on this project, which covers all its studies.'
          : "People with a role on this study itself. Roles on the project apply here too, and are listed on the project's page."}
      </p>

      {/* Always present, so screen readers announce each new notice. */}
      <p role="status" className="mt-4 text-sm font-medium empty:hidden">
        {notice}
      </p>
      {change.isError && (
        <p role="alert" className={`mt-4 ${errorBox}`}>
          {change.error.message}
        </p>
      )}

      {members.isPending ? (
        <p className="mt-4 text-muted">Loading members…</p>
      ) : members.isError ? (
        // Not an alert: it's a side section, and the page's own errors matter more.
        <p className={`mt-4 ${errorBox}`}>Could not load members. Please try again later.</p>
      ) : members.data.length === 0 ? (
        <p className="mt-4 text-muted">No one has a role here yet.</p>
      ) : (
        <div className={`mt-4 ${tableWrapper}`}>
          <table className={table} aria-label="Members">
            <thead className={tableHead}>
              <tr>
                <th scope="col" className={header}>
                  Name and ORCID iD
                </th>
                <th scope="col" className={header}>
                  Role
                </th>
                <th scope="col" className={`${header} w-px`}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.data.map((member) => (
                // Keyed by role too, so the row starts afresh when the role changes.
                <MemberRow
                  key={`${member.user.id}-${member.role}`}
                  member={member}
                  busy={change.isPending}
                  adminLocked={adminLocked}
                  onChange={(role) => {
                    change.mutate({
                      orcidId: member.user.subject,
                      role,
                      who: member.user.name ?? member.user.subject,
                    })
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        aria-label="Add someone"
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const values = new FormData(form)
          const added = text(values, 'orcid_id')
          change.mutate(
            { orcidId: added, role: text(values, 'role') as Role, who: added },
            {
              onSuccess: () => {
                form.reset()
              },
            },
          )
        }}
      >
        <div className="w-56">
          <label htmlFor={orcidId} className="block font-medium">
            ORCID iD
          </label>
          <input
            id={orcidId}
            name="orcid_id"
            required
            pattern={orcidPattern}
            placeholder="0000-0002-1825-0097"
            autoComplete="off"
            className={`${inputClass} border-line font-mono`}
          />
        </div>
        <div>
          <label htmlFor={roleId} className="block font-medium">
            Role
          </label>
          <select
            id={roleId}
            name="role"
            defaultValue="viewer"
            className={`${inputClass} border-line`}
          >
            {ROLE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value === 'admin' && adminLocked !== undefined}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={change.isPending}
          className={`${primaryButton} inline-flex items-center gap-2 text-sm`}
        >
          <AddPersonIcon aria-hidden="true" className="size-4 shrink-0" />
          Add member
        </button>
      </form>
      <p className="mt-2 text-sm text-muted">
        People can be added before they first sign in: their role will be waiting for them.
        {adminLocked && ` ${adminLocked}`}
      </p>
    </section>
  )
}
