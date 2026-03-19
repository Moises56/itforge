import 'server-only'

import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { SESSION_DURATION_SECONDS } from '@/lib/constants'

const SESSION_DURATION_MS = SESSION_DURATION_SECONDS * 1000

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  organizationId: string
  isActive: boolean
  roles: Array<{ id: string; name: string }>
}

export type ValidatedSession = {
  id: string
  userId: string
  organizationId: string
  expiresAt: Date
  user: SessionUser
}

/**
 * Creates a new session for a user.
 * Token is 32 cryptographically random bytes (64 hex chars).
 * The token IS the session ID — no separate secret needed since
 * it's unguessable and stored httpOnly.
 */
export async function createSession(
  userId: string,
  organizationId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      id: token,
      userId,
      organizationId,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  })

  return { token, expiresAt }
}

/**
 * Validates a session token against the DB.
 * Returns null if not found, expired, or user is inactive/deleted.
 * Cleans up expired sessions lazily.
 */
export async function validateSession(token: string): Promise<ValidatedSession | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: {
      user: {
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      },
    },
  })

  if (!session) return null

  // Lazy expiry cleanup
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => null)
    return null
  }

  // Guard against deactivated or soft-deleted users
  if (!session.user.isActive || session.user.deletedAt !== null) {
    await prisma.session.delete({ where: { id: token } }).catch(() => null)
    return null
  }

  return {
    id: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      organizationId: session.user.organizationId,
      isActive: session.user.isActive,
      roles: session.user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
    },
  }
}

/**
 * Destroys a single session (logout from current device).
 * Silently ignores if session doesn't exist.
 */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => null)
}

/**
 * Destroys ALL sessions for a user.
 * Used when: password change, account suspension, admin force-logout.
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}
