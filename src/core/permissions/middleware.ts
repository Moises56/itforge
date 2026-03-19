import 'server-only'

import { prisma } from '@/lib/prisma'
import { resolvePermission } from './resolve'

// ─── Custom error ─────────────────────────────────────────────────────────────

export class AuthorizationError extends Error {
  readonly statusCode = 403

  constructor(
    public readonly resource: string,
    public readonly action: string,
  ) {
    super(`No tienes permiso para realizar la acción "${action}" en "${resource}"`)
    this.name = 'AuthorizationError'
  }
}

// ─── Sensitive actions that always produce an audit log entry ─────────────────
// Even when the check FAILS — failed attempts on sensitive resources are audited.

const SENSITIVE_ACTIONS = new Set(['reveal', 'delete', 'export'])
const SENSITIVE_RESOURCES = new Set(['projects.credentials', 'databases.credentials', 'users', 'system.config', 'audit.logs'])

// ─── Direct-call guard (use inside Server Actions) ───────────────────────────

/**
 * Checks permission and throws AuthorizationError if denied.
 * Use at the top of Server Actions:
 *
 * ```ts
 * const user = await getCurrentUser()
 * await requirePermission(user.id, user.organizationId, 'projects', 'create')
 * ```
 *
 * Automatically creates an AuditLog for sensitive actions.
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  resourceCode: string,
  actionCode: string,
  resourceId?: string,
): Promise<void> {
  const allowed = await resolvePermission(userId, resourceCode, actionCode)

  const isSensitive =
    SENSITIVE_ACTIONS.has(actionCode) || SENSITIVE_RESOURCES.has(resourceCode)

  if (!allowed) {
    // Audit failed access attempts on sensitive resources
    if (isSensitive) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `DENIED:${actionCode}`,
          resource: resourceCode,
          resourceId: resourceId ?? null,
          metadata: { organizationId },
        },
      }).catch(() => null) // never block the throw on audit failure
    }

    throw new AuthorizationError(resourceCode, actionCode)
  }

  // Audit successful sensitive actions (credential reveal, deletes, exports)
  if (isSensitive) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: actionCode,
        resource: resourceCode,
        resourceId: resourceId ?? null,
        metadata: { organizationId },
      },
    }).catch(() => null)
  }
}

// ─── Higher-order function wrapper (for non-FormData Server Actions) ──────────

/**
 * Wraps an async function with a permission check.
 * The wrapped function receives the userId as its first argument.
 *
 * Use when you want to declare permissions at the point of action definition:
 *
 * ```ts
 * export const deleteProject = withPermission(
 *   'projects', 'delete',
 *   async (userId: string, organizationId: string, projectId: string) => {
 *     // userId is guaranteed to have delete permission here
 *     await prisma.project.update(...)
 *   }
 * )
 * ```
 */
export function withPermission<
  TArgs extends [userId: string, organizationId: string, ...rest: unknown[]],
  TReturn,
>(
  resourceCode: string,
  actionCode: string,
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const [userId, organizationId] = args
    await requirePermission(userId, organizationId, resourceCode, actionCode)
    return fn(...args)
  }
}
