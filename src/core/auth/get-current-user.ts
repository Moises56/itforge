import 'server-only'

import { redirect } from 'next/navigation'
import { getSessionCookie } from './cookies'
import { validateSession } from './session'

export type CurrentUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  /** Full name helper */
  fullName: string
  organizationId: string
  roles: string[]
}

function buildCurrentUser(session: NonNullable<Awaited<ReturnType<typeof validateSession>>>): CurrentUser {
  const { user } = session
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    organizationId: session.organizationId,
    roles: user.roles.map((r) => r.name),
  }
}

/**
 * Reads the session cookie, validates against DB, returns the current user.
 * Redirects to /login if no valid session exists.
 *
 * Use in Server Components and Server Actions that require authentication.
 * NEVER call this in middleware — use validateSession() directly there.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const token = await getSessionCookie()
  if (!token) redirect('/login')

  const session = await validateSession(token)
  if (!session) redirect('/login')

  return buildCurrentUser(session)
}

/**
 * Like getCurrentUser() but returns null instead of redirecting.
 * Use in layouts that need to conditionally show auth UI
 * (e.g. the root layout deciding whether to render the sidebar).
 */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  const token = await getSessionCookie()
  if (!token) return null

  const session = await validateSession(token)
  if (!session) return null

  return buildCurrentUser(session)
}
