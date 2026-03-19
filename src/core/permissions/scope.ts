import 'server-only'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A Prisma-compatible WHERE clause fragment */
export type DataScope = Record<string, unknown>

// ─── Role constants ───────────────────────────────────────────────────────────

const GLOBAL_ROLES = new Set(['owner', 'admin'])

// ─── Scope resolver ───────────────────────────────────────────────────────────

/**
 * Returns an additional Prisma WHERE clause based on the user's role set
 * and the resource being accessed.
 *
 * Spread this into your Prisma `where` object:
 *
 * ```ts
 * const scope = getDataScope(user.id, user.roles, 'projects')
 * const projects = await prisma.project.findMany({
 *   where: { organizationId: user.organizationId, ...scope }
 * })
 * ```
 *
 * Rules:
 * - owner / admin → no restriction (full visibility)
 * - dba on databases → only { managedBy: 'DBA_TEAM' }
 * - developer on projects → only projects where they are responsible
 * - viewer on everything → view-only enforced at permission level, no scope restriction
 */
export function getDataScope(
  userId: string,
  roles: string[],
  resource: string,
): DataScope {
  // Owners and admins always see everything
  if (roles.some((r) => GLOBAL_ROLES.has(r))) return {}

  switch (resource) {
    case 'databases':
    case 'databases.credentials':
      // DBAs only manage their team's databases
      if (roles.includes('dba')) {
        return { managedBy: 'DBA_TEAM' }
      }
      // Developers see databases linked to their projects
      if (roles.includes('developer')) {
        return { project: { responsibleUserId: userId } }
      }
      // Viewers see all (read-only enforced at permission level)
      return {}

    case 'projects':
    case 'projects.credentials':
    case 'projects.change-requests':
    case 'projects.source-code':
      // Developers see only projects they're responsible for
      if (roles.includes('developer') && !roles.includes('dba')) {
        return { responsibleUserId: userId }
      }
      return {}

    default:
      return {}
  }
}
