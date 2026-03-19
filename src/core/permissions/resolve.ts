import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionMatrixEntry = {
  resourceCode: string
  resourceName: string
  module: string
  actionCode: string
  actionName: string
  resourceActionId: string
  /** effective permission (override > role union) */
  allowed: boolean
  /** true if this comes from a UserPermissionOverride (not role) */
  isOverride: boolean
}

export type UserPermissionMatrix = PermissionMatrixEntry[]

// ─── Per-request data loader (memoized with React cache) ─────────────────────
//
// React's cache() provides request-scoped memoization: the function runs once
// per unique argument set per server render cycle. This avoids hitting the DB
// multiple times when resolvePermission is called for the same userId in a
// single request (e.g. sidebar rendering + page rendering).

const loadUserPermissionData = cache(async (userId: string) => {
  const [overrides, userRoles] = await Promise.all([
    // Direct user overrides — highest priority
    prisma.userPermissionOverride.findMany({
      where: { userId },
      include: {
        resourceAction: {
          include: {
            resource: true,
            action: true,
          },
        },
      },
    }),
    // All roles + their permissions
    prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                resourceAction: {
                  include: {
                    resource: true,
                    action: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])

  return { overrides, userRoles }
})

// ─── Core permission check ────────────────────────────────────────────────────

/**
 * Resolves whether userId has (resourceCode × actionCode) permission.
 *
 * Resolution order (GAM-inspired):
 *   1. UserPermissionOverride — if exists, its `allowed` value wins (can deny too)
 *   2. Role union — if ANY assigned role grants the permission, returns true
 *   3. Deny by default — if no entry found, returns false
 */
export const resolvePermission = cache(
  async (userId: string, resourceCode: string, actionCode: string): Promise<boolean> => {
    const { overrides, userRoles } = await loadUserPermissionData(userId)

    // Step 1: user-level override (takes precedence — can grant OR deny)
    const override = overrides.find(
      (o) =>
        o.resourceAction.resource.code === resourceCode &&
        o.resourceAction.action.code === actionCode,
    )
    if (override !== undefined) return override.allowed

    // Step 2: role union (any role granting it = true)
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        if (
          rp.allowed &&
          rp.resourceAction.resource.code === resourceCode &&
          rp.resourceAction.action.code === actionCode
        ) {
          return true
        }
      }
    }

    // Step 3: deny by default
    return false
  },
)

// ─── Full permission matrix ───────────────────────────────────────────────────

/**
 * Returns the full effective permission matrix for a user.
 * Useful for the "My Permissions" view and for debugging access issues.
 *
 * Each entry shows the effective permission and whether it comes from an override.
 */
export async function getUserPermissionMatrix(userId: string): Promise<UserPermissionMatrix> {
  const { overrides, userRoles } = await loadUserPermissionData(userId)

  // Collect all resourceActions relevant to this user's roles
  const allResourceActionIds = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      allResourceActionIds.add(rp.resourceActionId)
    }
  }
  for (const o of overrides) {
    allResourceActionIds.add(o.resourceActionId)
  }

  // Fetch ALL resource-actions in the system to show the complete matrix
  const allResourceActions = await prisma.resourceAction.findMany({
    include: { resource: true, action: true },
    orderBy: [{ resource: { sortOrder: 'asc' } }, { action: { code: 'asc' } }],
  })

  const matrix: UserPermissionMatrix = []

  for (const ra of allResourceActions) {
    const override = overrides.find((o) => o.resourceActionId === ra.id)

    let allowed = false
    let isOverride = false

    if (override !== undefined) {
      allowed = override.allowed
      isOverride = true
    } else {
      // Check role union
      for (const ur of userRoles) {
        const rp = ur.role.rolePermissions.find((p) => p.resourceActionId === ra.id)
        if (rp?.allowed) {
          allowed = true
          break
        }
      }
    }

    matrix.push({
      resourceCode: ra.resource.code,
      resourceName: ra.resource.name,
      module: ra.resource.module,
      actionCode: ra.action.code,
      actionName: ra.action.name,
      resourceActionId: ra.id,
      allowed,
      isOverride,
    })
  }

  return matrix
}
