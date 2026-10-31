import type { components } from './api/schema'
import { useMe } from './useMe'

type Me = components['schemas']['Me']
export type Role = components['schemas']['RoleRead']['role']

const RANKS: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 }

// What something needs: being a site administrator; being an admin of at least one project
// (to add a study to one of them); or a role on a project (with no study), or on a study in it.
export type Need =
  | { siteAdmin: true }
  | { anyProjectAdmin: true }
  | { role: 'editor' | 'admin'; project: string; study?: string }

// Whether someone can add studies to at least one project: they're an admin of one, or a site
// administrator.
export function adminOfAnyProject(me: Me): boolean {
  return me.site_admin || me.roles.some((held) => held.study === null && held.role === 'admin')
}

// Adding or changing a study's records needs an editor role there.
export function editorOf(project: string, study: string): Need {
  return { role: 'editor', project, study }
}

// Someone's role on a project, or on a study: the higher of their roles on the project and on
// the study itself. Site administrators are admins everywhere. The same rules as the API's.
export function roleOn(me: Me, project: string, study?: string): Role | null {
  if (me.site_admin) {
    return 'admin'
  }
  let best: Role | null = null
  for (const held of me.roles) {
    const applies = held.project === project && (held.study === null || held.study === study)
    if (applies && (best === null || RANKS[held.role] > RANKS[best])) {
      best = held.role
    }
  }
  return best
}

// Why nothing can be changed while the site is read-only (PROTOLIMS_READ_ONLY).
export const READ_ONLY_REASON = 'This site is read-only at the moment, so nothing can be changed.'

// Why someone can't do something, or null if they can.
export function refusalReason(me: Me, need: Need): string | null {
  if (me.read_only) {
    return READ_ONLY_REASON
  }
  if (!me.user) {
    return 'Sign in to do this.'
  }
  if ('siteAdmin' in need) {
    return me.site_admin ? null : 'Only site administrators can do this.'
  }
  if ('anyProjectAdmin' in need) {
    return adminOfAnyProject(me) ? null : "Only a project's admins can add studies to it."
  }
  const role = roleOn(me, need.project, need.study)
  if (role !== null && RANKS[role] >= RANKS[need.role]) {
    return null
  }
  const where = need.study === undefined ? "the project's" : "the study's"
  const who = need.role === 'admin' ? 'admins' : 'editors and admins'
  return `Only ${where} ${who} can do this.`
}

// Why the person using the website can't do something, or null if they can. Also null while
// that's still being checked: the API checks every change anyway.
export function useRefusal(need: Need | undefined): string | null {
  const { data: me } = useMe()
  return need === undefined || me === undefined ? null : refusalReason(me, need)
}
