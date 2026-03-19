/**
 * ITForge — Database Seed
 * Run with: pnpm db:seed
 *
 * Creates:
 *  - Default organization
 *  - All system Resources + Actions + ResourceActions
 *  - 5 default roles (owner, admin, developer, dba, viewer) with permissions
 *  - Initial admin user (admin@itforge.local / Admin2024!)
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as argon2 from 'argon2'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─── Definitions ──────────────────────────────────────────────────────────────

const RESOURCES = [
  { code: 'projects',              name: 'Proyectos',                   module: 'DEVELOPMENT' as const, sortOrder: 10 },
  { code: 'projects.credentials',  name: 'Credenciales de Proyectos',   module: 'DEVELOPMENT' as const, sortOrder: 11 },
  { code: 'projects.change-requests', name: 'Solicitudes de Cambio',    module: 'DEVELOPMENT' as const, sortOrder: 12 },
  { code: 'projects.source-code',  name: 'Código Fuente',               module: 'DEVELOPMENT' as const, sortOrder: 13 },
  { code: 'databases',             name: 'Bases de Datos',              module: 'DEVELOPMENT' as const, sortOrder: 20 },
  { code: 'databases.credentials', name: 'Credenciales de BD',          module: 'DEVELOPMENT' as const, sortOrder: 21 },
  { code: 'users',                 name: 'Usuarios',                    module: 'SYSTEM'      as const, sortOrder: 30 },
  { code: 'system.config',         name: 'Configuración del Sistema',   module: 'SYSTEM'      as const, sortOrder: 31 },
  { code: 'audit.logs',            name: 'Logs de Auditoría',           module: 'SYSTEM'      as const, sortOrder: 32 },
]

const ACTIONS = [
  { code: 'view',          name: 'Ver',              isUniversal: true  },
  { code: 'create',        name: 'Crear',            isUniversal: true  },
  { code: 'edit',          name: 'Editar',           isUniversal: true  },
  { code: 'delete',        name: 'Eliminar',         isUniversal: true  },
  { code: 'reveal',        name: 'Revelar',          isUniversal: false },
  { code: 'change_status', name: 'Cambiar Estado',   isUniversal: false },
  { code: 'export',        name: 'Exportar',         isUniversal: false },
]

// Valid resource × action combinations
const RESOURCE_ACTIONS: [string, string[]][] = [
  ['projects',                 ['view', 'create', 'edit', 'delete']],
  ['projects.credentials',     ['view', 'create', 'edit', 'delete', 'reveal']],
  ['projects.change-requests', ['view', 'create', 'edit', 'delete', 'change_status']],
  ['projects.source-code',     ['view', 'export']],
  ['databases',                ['view', 'create', 'edit', 'delete']],
  ['databases.credentials',    ['view', 'create', 'edit', 'delete', 'reveal']],
  ['users',                    ['view', 'create', 'edit', 'delete']],
  ['system.config',            ['view', 'edit']],
  ['audit.logs',               ['view']],
]

// Role permission definitions:
// owner/admin  = all
// developer    = projects (view,create,edit) + cr (view,create,edit,change_status) + source (view) + creds (view) + dbs (view)
// dba          = databases (all) + db.creds (all+reveal) + projects (view) + audit.logs (view)
// viewer       = view on everything

const ROLE_PERMISSIONS: Record<string, [string, string[]][]> = {
  owner: RESOURCE_ACTIONS, // all
  admin: RESOURCE_ACTIONS, // all — same as owner; scoping done by business rules
  developer: [
    ['projects',                 ['view', 'create', 'edit']],
    ['projects.credentials',     ['view']],
    ['projects.change-requests', ['view', 'create', 'edit', 'change_status']],
    ['projects.source-code',     ['view']],
    ['databases',                ['view']],
    ['databases.credentials',    ['view']],
  ],
  dba: [
    ['projects',                 ['view']],
    ['databases',                ['view', 'create', 'edit', 'delete']],
    ['databases.credentials',    ['view', 'create', 'edit', 'delete', 'reveal']],
    ['audit.logs',               ['view']],
  ],
  viewer: RESOURCE_ACTIONS.map(([resource]) => [resource, ['view']]),
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding ITForge database...')

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Organización por Defecto',
      slug: 'default',
      primaryColor: '#4f46e5',
      secondaryColor: '#818cf8',
      developmentEnabled: true,
      infrastructureEnabled: false,
      supportEnabled: false,
    },
  })
  console.log(`  ✓ Organization: ${org.name}`)

  // 2. Resources
  const resourceMap = new Map<string, string>() // code → id
  for (const r of RESOURCES) {
    const resource = await prisma.resource.upsert({
      where: { code: r.code },
      update: { name: r.name, module: r.module, sortOrder: r.sortOrder },
      create: { ...r, organizationId: null },
    })
    resourceMap.set(resource.code, resource.id)
  }
  console.log(`  ✓ Resources: ${RESOURCES.length}`)

  // 3. Actions
  const actionMap = new Map<string, string>() // code → id
  for (const a of ACTIONS) {
    const action = await prisma.action.upsert({
      where: { code: a.code },
      update: { name: a.name, isUniversal: a.isUniversal },
      create: a,
    })
    actionMap.set(action.code, action.id)
  }
  console.log(`  ✓ Actions: ${ACTIONS.length}`)

  // 4. ResourceActions
  const raMap = new Map<string, string>() // `resource:action` → id
  for (const [resourceCode, actionCodes] of RESOURCE_ACTIONS) {
    const resourceId = resourceMap.get(resourceCode)!
    for (const actionCode of actionCodes) {
      const actionId = actionMap.get(actionCode)!
      const ra = await prisma.resourceAction.upsert({
        where: { resourceId_actionId: { resourceId, actionId } },
        update: {},
        create: { resourceId, actionId },
      })
      raMap.set(`${resourceCode}:${actionCode}`, ra.id)
    }
  }
  console.log(`  ✓ ResourceActions: ${raMap.size}`)

  // 5. Roles + their permissions
  const roleNames = ['owner', 'admin', 'developer', 'dba', 'viewer'] as const
  const roleMap = new Map<string, string>() // name → id

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name: roleName } },
      update: { isSystem: true },
      create: {
        organizationId: org.id,
        name: roleName,
        description: getRoleDescription(roleName),
        isSystem: true,
        isDefault: roleName === 'viewer',
      },
    })
    roleMap.set(roleName, role.id)

    // Upsert permissions for this role
    const permissions = ROLE_PERMISSIONS[roleName] ?? []
    for (const [resourceCode, actionCodes] of permissions) {
      for (const actionCode of actionCodes) {
        const resourceActionId = raMap.get(`${resourceCode}:${actionCode}`)
        if (!resourceActionId) continue
        await prisma.rolePermission.upsert({
          where: { roleId_resourceActionId: { roleId: role.id, resourceActionId } },
          update: { allowed: true },
          create: { roleId: role.id, resourceActionId, allowed: true },
        })
      }
    }
    console.log(`  ✓ Role: ${roleName}`)
  }

  // 6. Admin user
  const passwordHash = await argon2.hash('Admin2024!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  })

  const adminUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'admin@itforge.local' } },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@itforge.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Sistema',
      isActive: true,
    },
  })
  console.log(`  ✓ Admin user: ${adminUser.email}`)

  // 7. Assign owner role to admin
  const ownerRoleId = roleMap.get('owner')!
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: ownerRoleId } },
    update: {},
    create: { userId: adminUser.id, roleId: ownerRoleId },
  })
  console.log(`  ✓ Role assignment: admin → owner`)

  console.log('\n✅ Seed complete!')
  console.log('   Login: admin@itforge.local / Admin2024!')
}

function getRoleDescription(name: string): string {
  const descriptions: Record<string, string> = {
    owner:     'Control total del sistema, incluyendo configuración y usuarios',
    admin:     'Administración completa de proyectos, bases de datos y usuarios',
    developer: 'Gestión de proyectos asignados y solicitudes de cambio',
    dba:       'Administración de bases de datos del equipo DBA',
    viewer:    'Acceso de solo lectura a todos los módulos habilitados',
  }
  return descriptions[name] ?? name
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
