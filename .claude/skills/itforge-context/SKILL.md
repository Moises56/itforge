---
name: itforge-context
description: >
  Context and patterns for the ITForge project — an IT Portfolio Management System
  built with Next.js, Prisma, PostgreSQL, MinIO. Use this skill whenever working
  on any file in the ITForge project. Covers authentication patterns, permission
  checks, credential encryption, MinIO file operations, and the GAM-inspired
  RBAC model. Always load this skill when making changes to the project.
---

# ITForge Project Patterns

## Server Action Template
Every Server Action MUST follow this pattern:
```typescript
'use server'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const schema = z.object({ /* ... */ })

export async function createSomething(formData: FormData) {
  const user = await getCurrentUser()
  await requirePermission(user.id, 'resource.code', 'create')
  const validated = schema.parse({ /* ... */ })
  const result = await prisma.entity.create({
    data: { ...validated, organizationId: user.organizationId }
  })
  revalidatePath('/path')
  return { success: true, id: result.id }
}
```

## Multi-Tenant Filter
EVERY Prisma query MUST include:
`where: { organizationId: user.organizationId, ...otherFilters }`

## Credential Pattern
NEVER plaintext. Always encrypt() before DB, decrypt() only in revealCredential with audit log.

## MinIO Path Pattern
`{module}/{entityType}/{entityId}/{timestamp}-{filename}`
Store ONLY path in DB. Generate presigned URLs on-demand.

## Permission-Aware UI
```typescript
const canDelete = await resolvePermission(user.id, 'projects', 'delete')
// JSX: {canDelete && <DeleteButton />}
```