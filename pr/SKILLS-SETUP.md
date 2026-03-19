# ITForge — Guía de Skills para Claude Code

## Instalación de Skills

Ejecuta estos comandos en tu terminal ANTES de iniciar Claude Code en el proyecto.

### 1. Skills Oficiales de Anthropic (frontend-design)

```bash
# Skill principal para diseño de UI — INDISPENSABLE
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

**Qué hace**: Guía a Claude Code para crear interfaces de calidad profesional,
evitando el "AI slop" (diseños genéricos). Le da instrucciones sobre tipografía,
color, animaciones, composición espacial.

**Cuándo se activa**: Automáticamente cuando pidas crear componentes de UI,
páginas, dashboards, o cualquier interfaz visual.

### 2. Skills de Prisma (Oficiales de Prisma)

```bash
# Referencia completa del CLI de Prisma
npx skills add prisma/skills --skill prisma-cli

# API de Prisma Client — queries, relations, transactions
npx skills add prisma/skills --skill prisma-client-api

# Configuración con diferentes providers (PostgreSQL en nuestro caso)
npx skills add prisma/skills --skill prisma-database-connectors
```

**Qué hace**: Le da a Claude Code conocimiento actualizado y preciso sobre
Prisma ORM. Sin esto, Claude podría generar código con patrones deprecados
o syntax incorrecta.

**Cuándo se activa**: Cuando trabajes con el schema de Prisma, queries,
migrations, o cualquier operación de base de datos.

### 3. Skills de Next.js + Auth (Comunidad)

```bash
# Skills actualizados para Next.js + Prisma + Auth.js
# (contiene patterns de App Router, Server Components, Server Actions)
npx skills add https://github.com/gocallum/nextjs16-agent-skills --skill nextjs-16
npx skills add https://github.com/gocallum/nextjs16-agent-skills --skill authjs-v5
npx skills add https://github.com/gocallum/nextjs16-agent-skills --skill shadcn-ui
```

**Qué hace**: Asegura que Claude Code use los patterns más recientes de
Next.js (App Router, async request APIs) y shadcn/ui. Sin esto, puede
generar código con patterns de Pages Router o versiones viejas.

**Cuándo se activa**: En prácticamente toda operación del proyecto.

### 4. Verificación de Instalación

```bash
# Verifica que las skills están instaladas
ls -la .claude/skills/
# Deberías ver carpetas para cada skill instalada
```

---

## Skills Recomendadas Adicionales (instalar según necesidad)

### Para testing (cuando llegues a esa fase)
```bash
# Si existe una skill de testing, instalar aquí
# Por ahora, Claude Code tiene conocimiento base de Jest/Vitest
```

### Para documentación
```bash
# Si necesitas generar documentación del proyecto
npx skills add https://github.com/anthropics/skills --skill pdf
npx skills add https://github.com/anthropics/skills --skill docx
```

---

## Skill Custom: ITForge Project Context

Para un proyecto tan específico, vale la pena crear una skill custom que
Claude Code cargue automáticamente. Crea este archivo:

```bash
mkdir -p .claude/skills/itforge-context
```

Y crea `.claude/skills/itforge-context/SKILL.md` con:

```markdown
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

## Authentication Check Pattern
Every Server Action and protected page must:
1. Call getCurrentUser() to get the authenticated user
2. If no user, redirect to /login
3. Check permissions with resolvePermission(userId, resource, action)
4. If denied, throw new AuthorizationError()

## Server Action Template
Always follow this pattern for Server Actions:

```typescript
'use server'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const schema = z.object({
  // ... define schema
})

export async function createSomething(formData: FormData) {
  const user = await getCurrentUser()
  await requirePermission(user.id, 'resource.code', 'create')

  const validated = schema.parse({
    // ... parse formData
  })

  const result = await prisma.entity.create({
    data: {
      ...validated,
      organizationId: user.organizationId,
    }
  })

  revalidatePath('/path')
  return { success: true, id: result.id }
}
```

## Credential Encryption Pattern
NEVER store credentials in plaintext. Always:
1. Import { encrypt, decrypt } from '@/core/crypto/encryption'
2. encrypt(plainValue) before storing in DB
3. decrypt(encryptedValue) only in revealCredential action with audit log

## MinIO Upload Pattern
1. Validate file type and size in Server Action
2. Generate path: `{module}/{entityType}/{entityId}/{timestamp}-{filename}`
3. Upload via MinIO client
4. Store ONLY the path in DB, never the full URL
5. Generate presigned URLs on-demand for viewing/downloading

## Multi-Tenant Filter
EVERY Prisma query on business entities MUST include:
```typescript
where: { organizationId: user.organizationId, ...otherFilters }
```

## Permission-Aware UI Pattern
Use this in Server Components to conditionally render actions:
```typescript
const canDelete = await resolvePermission(user.id, 'projects', 'delete')
// Then in JSX: {canDelete && <DeleteButton />}
```
```

---

## Estrategia de Uso con Plan Pro (tokens limitados)

### Reglas para Optimizar Tokens

1. **Un prompt = una tarea concreta**. No mezcles "crea el CRUD de proyectos Y
   el sistema de permisos" en un solo prompt. Divídelos.

2. **Usa /clear agresivamente**. Después de cada tarea completada y commiteada,
   limpia el contexto. Claude Code mantiene el CLAUDE.md y las skills
   automáticamente.

3. **Commits frecuentes**. Pide a Claude Code que haga commit después de cada
   tarea. Si algo sale mal, puedes revertir sin perder todo.

4. **No pidas explicaciones largas**. En Claude Code, di: "No expliques, solo
   implementa. Si hay decisiones de diseño, pon un comentario en el código."

5. **Referencia archivos existentes**. En vez de describir qué hay en un archivo,
   di: "Sigue el patrón de src/modules/development/actions/create-project.ts
   para crear update-project.ts"

6. **Usa el modo Plan para tareas complejas**. Antes de implementar, pide:
   "Planifica cómo implementarías el sistema de Change Requests. Solo el plan,
   no el código." Revisa el plan, y luego di: "Ejecuta el plan."

### Orden Recomendado de Trabajo

```
Sesión 1: Fase 0 (setup) + Fase 1A (schema Prisma)     → /clear
Sesión 2: Fase 1B (autenticación)                        → /clear
Sesión 3: Fase 2 (permisos + seed)                       → /clear
Sesión 4: Fase 3A (dashboard layout)                     → /clear
Sesión 5: Fase 3B (CRUD proyectos — lista + crear)       → /clear
Sesión 6: Fase 3B cont. (detalle proyecto + editar)      → /clear
Sesión 7: Fase 4 (credenciales + MinIO)                  → /clear
Sesión 8: Fase 5 (Change Requests + Kanban)              → /clear
```

Cada sesión es independiente. Claude Code leerá el CLAUDE.md + skills +
código existente automáticamente al inicio de cada sesión.
