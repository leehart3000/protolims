import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { fetchUserPage, type UserSort } from '../api/queries'
import type { components } from '../api/schema'
import { PagedTable } from '../components/PagedTable'
import { PageTitle } from '../components/PageTitle'
import { PersonCell } from '../components/PersonCell'
import { SearchBox } from '../components/SearchBox'
import { SortHeader } from '../components/SortHeader'
import { formatDate } from '../format'
import {
  errorBox,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
  textLink,
} from '../styles'
import { useListControls } from '../useListControls'
import { useMe } from '../useMe'

type UserColumn = Exclude<UserSort, `-${string}`>
type RoleRead = components['schemas']['RoleRead']

// A role, as a link to where it applies: "P1: Editor", or "P1 / S1: Admin" for a study.
function RoleLink({ role }: { role: RoleRead }) {
  const projectPath = `/projects/${encodeURIComponent(role.project)}`
  const to =
    role.study === null ? projectPath : `${projectPath}/studies/${encodeURIComponent(role.study)}`
  const label = role.role.charAt(0).toUpperCase() + role.role.slice(1)
  return (
    <>
      <Link to={to} className={`${textLink} font-mono`}>
        {role.study === null ? role.project : `${role.project} / ${role.study}`}
      </Link>
      : {label}
    </>
  )
}

function UserList() {
  const controls = useListControls<UserSort>('name')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['users', { q, sort, offset, limit }],
    queryFn: () => fetchUserPage({ q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading users…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-6 ${errorBox}`}>
        Could not load users. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  function heading(label: string, column: UserColumn, className: string) {
    return (
      <SortHeader<UserSort>
        label={label}
        ascending={column}
        descending={`-${column}` as const}
        sort={sort}
        onSort={changeSort}
        className={className}
      />
    )
  }

  return (
    <>
      <SearchBox
        id="user-search"
        label="Search users"
        placeholder="Search by name or ORCID iD"
        value={search}
        onChange={changeSearch}
      />
      {total === 0 ? (
        <p className="mt-6 text-muted">{q ? `No users match “${q}”.` : 'No users yet.'}</p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <div className={`mt-4 ${tableWrapper}`}>
            <table className={table} aria-label="Users">
              <thead className={tableHead}>
                <tr>
                  {heading('Name and ORCID iD', 'name', tableHeader)}
                  <th scope="col" className={tableHeader}>
                    Roles
                  </th>
                  {heading('Last signed in', 'last_signed_in_at', tableHeader)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((user) => (
                  <tr key={user.id} className={tableRow}>
                    <td className={tableCell}>
                      <PersonCell user={user} />
                    </td>
                    <td className={tableCell}>
                      <ul className="space-y-1">
                        {user.site_admin && <li className="font-medium">Site administrator</li>}
                        {user.roles.map((role) => (
                          <li key={`${role.project}/${role.study ?? ''}`}>
                            <RoleLink role={role} />
                          </li>
                        ))}
                        {!user.site_admin && user.roles.length === 0 && (
                          <li className="text-muted">None</li>
                        )}
                      </ul>
                    </td>
                    <td className={`${tableCell} whitespace-nowrap text-muted`}>
                      {user.last_signed_in_at ? formatDate(user.last_signed_in_at) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedTable>
      )}
    </>
  )
}

// Everyone who has signed in or been added, for site administrators.
export default function UsersPage() {
  const { data: me } = useMe()

  return (
    <>
      <PageTitle>Users</PageTitle>
      {me?.site_admin ? (
        <>
          <p className="mt-2 max-w-3xl text-muted">
            Everyone who has signed in, or been given a role by their ORCID iD, and their roles.
            Roles are given on each project's or study's page.
          </p>
          <UserList />
        </>
      ) : (
        <p className="mt-6 text-muted">Only site administrators can see the list of users.</p>
      )}
    </>
  )
}
