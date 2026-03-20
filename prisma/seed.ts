/**
 * ITForge — Database Seed
 * Run with: pnpm db:seed
 *
 * Creates:
 *  - Default organization
 *  - All system Resources + Actions + ResourceActions
 *  - 5 default roles (owner, admin, developer, dba, viewer) with permissions
 *  - Initial admin user (admin@itforge.local / Admin2024!)
 *  - Demo users, departments, projects, databases, change requests
 */

import 'dotenv/config'
import { createCipheriv, randomBytes } from 'crypto'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as argon2 from 'argon2'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─── Inline encrypt (mirrors core/crypto/encryption.ts without server-only) ──

function seedEncrypt(plainText: string): string {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex || hex.length !== 64) {
    // Fallback placeholder so seed works even without encryption key set.
    // The value will NOT be decryptable — replace after deployment.
    return `SEED_PLACEHOLDER:${Buffer.from(plainText).toString('base64')}`
  }
  const key = Buffer.from(hex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

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
  const adminPasswordHash = await argon2.hash('Admin2024!', {
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
      passwordHash: adminPasswordHash,
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

  // ─── Demo Data ─────────────────────────────────────────────────────────────
  console.log('\n🗂  Seeding demo data...')

  // 8. Departments
  const deptDev = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'DEV' } },
    update: {},
    create: { organizationId: org.id, name: 'Desarrollo de Software', code: 'DEV' },
  })
  const deptInfra = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'INFRA' } },
    update: {},
    create: { organizationId: org.id, name: 'Infraestructura TI', code: 'INFRA' },
  })
  const deptSupport = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'SUPPORT' } },
    update: {},
    create: { organizationId: org.id, name: 'Soporte Técnico', code: 'SUPPORT' },
  })
  console.log('  ✓ Departments: DEV, INFRA, SUPPORT')

  // 9. Demo users
  const devPasswordHash = await argon2.hash('Dev2024!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  })

  const dbaPasswordHash = await argon2.hash('Dba2024!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  })

  const devUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'dev@itforge.local' } },
    update: {},
    create: {
      organizationId: org.id,
      departmentId: deptDev.id,
      email: 'dev@itforge.local',
      passwordHash: devPasswordHash,
      firstName: 'Carlos',
      lastName: 'Desarrollador',
      isActive: true,
    },
  })

  const dbaUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'dba@itforge.local' } },
    update: {},
    create: {
      organizationId: org.id,
      departmentId: deptInfra.id,
      email: 'dba@itforge.local',
      passwordHash: dbaPasswordHash,
      firstName: 'María',
      lastName: 'DBA',
      isActive: true,
    },
  })

  // Assign roles to demo users
  const developerRoleId = roleMap.get('developer')!
  const dbaRoleId = roleMap.get('dba')!

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: devUser.id, roleId: developerRoleId } },
    update: {},
    create: { userId: devUser.id, roleId: developerRoleId },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: dbaUser.id, roleId: dbaRoleId } },
    update: {},
    create: { userId: dbaUser.id, roleId: dbaRoleId },
  })
  console.log('  ✓ Demo users: dev@itforge.local (developer), dba@itforge.local (dba)')

  // 10. Projects

  // Project 1: Portal Ciudadano — webapp, PRODUCTION, Level 3 (full control)
  const portalProject = await prisma.project.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PORTAL-CIU' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Portal Ciudadano',
      code: 'PORTAL-CIU',
      description:
        'Portal web para trámites y servicios ciudadanos. Permite consulta de expedientes, pago de tasas y notificaciones.',
      controlLevel: 'LEVEL_3',
      deploymentType: 'WEB',
      status: 'PRODUCTION',
      priority: 'HIGH',
      hasSourceCode: true,
      repositoryUrl: 'https://git.municipio.local/ti/portal-ciudadano',
      responsibleUserId: devUser.id,
      notes: 'Proyecto principal del área. Revisión de SSL cada 90 días.',
    },
  })

  // Project 2: SIGAD Legacy — desktop, PRODUCTION, Level 0 (black box)
  const sigadProject = await prisma.project.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'SIGAD-LEG' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'SIGAD',
      code: 'SIGAD-LEG',
      description:
        'Sistema de Gestión Administrativa Legacy. Ejecutable sin código fuente ni documentación disponible. Proveedor original desaparecido.',
      controlLevel: 'LEVEL_0',
      deploymentType: 'DESKTOP',
      status: 'PRODUCTION',
      priority: 'CRITICAL',
      hasSourceCode: false,
      notes: 'CRÍTICO: Único ejecutable en \\\\SRV-LEGACY\\SIGAD\\SIGAD.exe. Nadie sabe cómo funciona internamente. Migración pendiente.',
    },
  })

  // Project 3: SIGAD Bridge — service, PRODUCTION, Level 1 (BD access, satellite)
  const bridgeProject = await prisma.project.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'SIGAD-BRG' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'SIGAD Bridge API',
      code: 'SIGAD-BRG',
      description:
        'API REST que lee directamente de la base de datos del SIGAD Legacy para exponer datos a sistemas modernos. Acceso a BD pero sin código fuente del SIGAD.',
      controlLevel: 'LEVEL_1',
      deploymentType: 'SERVICE',
      status: 'PRODUCTION',
      priority: 'HIGH',
      hasSourceCode: true,
      repositoryUrl: 'https://git.municipio.local/ti/sigad-bridge',
      responsibleUserId: devUser.id,
      notes: 'Punto de integración crítico. Solo consultas SELECT — escrituras van al SIGAD original.',
    },
  })

  // Project 4: Sistema de Inventario — webapp, DEVELOPMENT, Level 3
  const inventarioProject = await prisma.project.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'INV-TI' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Sistema de Inventario TI',
      code: 'INV-TI',
      description:
        'Sistema para gestión de activos de TI: equipos, licencias y asignaciones por usuario.',
      controlLevel: 'LEVEL_3',
      deploymentType: 'WEB',
      status: 'DEVELOPMENT',
      priority: 'MEDIUM',
      hasSourceCode: true,
      repositoryUrl: 'https://git.municipio.local/ti/inventario-ti',
      responsibleUserId: devUser.id,
      notes: 'En desarrollo activo. Sprint 3 de 5.',
    },
  })

  // Project 5: App Móvil Ciudadano — mobile, IDEA, no infra
  const mobileProject = await prisma.project.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'APP-MOV' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'App Móvil Ciudadano',
      code: 'APP-MOV',
      description:
        'Aplicación móvil para iOS y Android que extiende el Portal Ciudadano con notificaciones push y escaneo de QR para trámites.',
      controlLevel: 'LEVEL_3',
      deploymentType: 'MOBILE',
      status: 'IDEA',
      priority: 'LOW',
      hasSourceCode: false,
      notes: 'Propuesta en evaluación. Pendiente aprobación presupuestaria.',
    },
  })

  console.log('  ✓ Projects: Portal Ciudadano, SIGAD Legacy, SIGAD Bridge, Inventario TI, App Móvil')

  // 11. Project Relations
  await prisma.projectRelation.upsert({
    where: {
      sourceProjectId_targetProjectId_type: {
        sourceProjectId: bridgeProject.id,
        targetProjectId: sigadProject.id,
        type: 'EXTENDS',
      },
    },
    update: {},
    create: {
      sourceProjectId: bridgeProject.id,
      targetProjectId: sigadProject.id,
      type: 'EXTENDS',
      notes: 'SIGAD Bridge es un sistema satélite que extiende al SIGAD Legacy leyendo su BD.',
    },
  })
  await prisma.projectRelation.upsert({
    where: {
      sourceProjectId_targetProjectId_type: {
        sourceProjectId: portalProject.id,
        targetProjectId: bridgeProject.id,
        type: 'DEPENDS_ON',
      },
    },
    update: {},
    create: {
      sourceProjectId: portalProject.id,
      targetProjectId: bridgeProject.id,
      type: 'DEPENDS_ON',
      notes: 'El Portal Ciudadano consume la API del SIGAD Bridge para mostrar datos de expedientes.',
    },
  })
  console.log('  ✓ Project relations: Bridge extends SIGAD, Portal depends on Bridge')

  // 12. Environments (DEV + PRODUCTION for active projects)
  // Portal Ciudadano environments
  await prisma.projectEnvironment.upsert({
    where: { projectId_type: { projectId: portalProject.id, type: 'DEV' } },
    update: {},
    create: {
      projectId: portalProject.id,
      type: 'DEV',
      serverIp: '192.168.1.50',
      serverPort: 3000,
      url: 'http://192.168.1.50:3000',
      notes: 'Servidor de desarrollo interno',
    },
  })
  const portalProdEnv = await prisma.projectEnvironment.upsert({
    where: { projectId_type: { projectId: portalProject.id, type: 'PRODUCTION' } },
    update: {},
    create: {
      projectId: portalProject.id,
      type: 'PRODUCTION',
      serverIp: '192.168.1.10',
      serverPort: 443,
      url: 'https://portal.municipio.gob',
      notes: 'Servidor de producción — Nginx + SSL',
    },
  })

  // SIGAD Bridge environments
  await prisma.projectEnvironment.upsert({
    where: { projectId_type: { projectId: bridgeProject.id, type: 'PRODUCTION' } },
    update: {},
    create: {
      projectId: bridgeProject.id,
      type: 'PRODUCTION',
      serverIp: '192.168.1.20',
      serverPort: 8080,
      url: 'http://192.168.1.20:8080',
      notes: 'API interna — sin acceso externo',
    },
  })
  console.log('  ✓ Environments: Portal (DEV+PROD), Bridge (PROD)')

  // 13. Tech Stack
  const techStacks: Array<{
    projectId: string
    category: 'LANGUAGE' | 'FRAMEWORK' | 'DATABASE_ENGINE' | 'TOOL' | 'OTHER'
    name: string
    version?: string
  }> = [
    // Portal Ciudadano
    { projectId: portalProject.id, category: 'LANGUAGE',        name: 'TypeScript', version: '5.x' },
    { projectId: portalProject.id, category: 'FRAMEWORK',       name: 'Next.js',    version: '15' },
    { projectId: portalProject.id, category: 'DATABASE_ENGINE', name: 'PostgreSQL', version: '16' },
    { projectId: portalProject.id, category: 'TOOL',            name: 'Nginx',      version: '1.25' },
    // SIGAD Bridge
    { projectId: bridgeProject.id, category: 'LANGUAGE',        name: 'PHP',        version: '8.2' },
    { projectId: bridgeProject.id, category: 'FRAMEWORK',       name: 'Laravel',    version: '11' },
    { projectId: bridgeProject.id, category: 'DATABASE_ENGINE', name: 'SQL Server', version: '2019' },
    // Inventario TI
    { projectId: inventarioProject.id, category: 'LANGUAGE',        name: 'TypeScript', version: '5.x' },
    { projectId: inventarioProject.id, category: 'FRAMEWORK',       name: 'Next.js',    version: '15' },
    { projectId: inventarioProject.id, category: 'DATABASE_ENGINE', name: 'MongoDB',    version: '7' },
    { projectId: inventarioProject.id, category: 'TOOL',            name: 'Docker',     version: '26' },
  ]

  for (const ts of techStacks) {
    await prisma.techStack.create({ data: ts })
  }
  console.log(`  ✓ Tech stacks: ${techStacks.length} entries`)

  // 14. Project Roles
  const projectRoles = [
    { projectId: portalProject.id,    roleName: 'Tech Lead',         description: 'Responsable técnico del proyecto' },
    { projectId: portalProject.id,    roleName: 'Desarrollador',     description: 'Desarrollo de funcionalidades' },
    { projectId: portalProject.id,    roleName: 'Tester',            description: 'Pruebas y QA' },
    { projectId: bridgeProject.id,    roleName: 'Mantenedor',        description: 'Mantenimiento y monitoreo de la API' },
    { projectId: inventarioProject.id, roleName: 'Tech Lead',        description: 'Responsable técnico del proyecto' },
    { projectId: inventarioProject.id, roleName: 'Desarrollador',    description: 'Desarrollo de funcionalidades' },
  ]
  for (const pr of projectRoles) {
    await prisma.projectRole.create({ data: pr })
  }
  console.log(`  ✓ Project roles: ${projectRoles.length} entries`)

  // 15. Department Usages
  const deptUsages = [
    { projectId: portalProject.id,    departmentId: deptSupport.id, estimatedUsers: 150, contactPerson: 'Lic. Ana Torres' },
    { projectId: portalProject.id,    departmentId: deptDev.id,     estimatedUsers: 8,   contactPerson: 'Carlos Desarrollador' },
    { projectId: sigadProject.id,     departmentId: deptDev.id,     estimatedUsers: 50,  contactPerson: 'Admin Sistema' },
    { projectId: sigadProject.id,     departmentId: deptSupport.id, estimatedUsers: 30,  contactPerson: 'Lic. Ana Torres' },
    { projectId: sigadProject.id,     departmentId: deptInfra.id,   estimatedUsers: 5,   contactPerson: 'María DBA' },
    { projectId: bridgeProject.id,    departmentId: deptDev.id,     estimatedUsers: 3,   contactPerson: 'Carlos Desarrollador' },
    { projectId: inventarioProject.id, departmentId: deptInfra.id,  estimatedUsers: 10,  contactPerson: 'María DBA' },
  ]
  for (const du of deptUsages) {
    await prisma.departmentUsage.upsert({
      where: { projectId_departmentId: { projectId: du.projectId, departmentId: du.departmentId } },
      update: {},
      create: du,
    })
  }
  console.log(`  ✓ Department usages: ${deptUsages.length} entries`)

  // 16. Databases
  const sigadDb = await prisma.database.upsert({
    where: { id: 'demo-db-sigad-00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'demo-db-sigad-00000000-0000-0000-0000-000000000001',
      organizationId: org.id,
      projectId: sigadProject.id,
      name: 'SIGAD_DB',
      engine: 'SQL_SERVER',
      version: '2019',
      serverIp: '192.168.1.30',
      port: 1433,
      databaseName: 'SIGAD_PROD',
      managedBy: 'DBA_TEAM',
      notes: 'Base de datos crítica del SIGAD Legacy. Solo el equipo DBA tiene acceso. Backup diario a las 02:00.',
    },
  })

  const portalDb = await prisma.database.upsert({
    where: { id: 'demo-db-portal-00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'demo-db-portal-00000000-0000-0000-0000-000000000002',
      organizationId: org.id,
      projectId: portalProject.id,
      name: 'portal_ciudadano_db',
      engine: 'POSTGRESQL',
      version: '16',
      serverIp: '192.168.1.10',
      port: 5432,
      databaseName: 'portal_db',
      managedBy: 'DEV_TEAM',
      notes: 'PostgreSQL en Docker. Administrado por el equipo de desarrollo.',
    },
  })
  console.log('  ✓ Databases: SIGAD_DB (SQL Server / DBA), portal_ciudadano_db (PostgreSQL / DEV)')

  // 17. Database Credentials
  await prisma.databaseCredential.upsert({
    where: { id: 'demo-cred-sigad-00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'demo-cred-sigad-00000000-0000-0000-0000-000000000001',
      databaseId: sigadDb.id,
      label: 'SA de solo lectura',
      username: 'sigad_readonly',
      encryptedValue: seedEncrypt('ReadOnly@2024!'),
      accessLevel: 'read',
    },
  })
  await prisma.databaseCredential.upsert({
    where: { id: 'demo-cred-portal-00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'demo-cred-portal-00000000-0000-0000-0000-000000000002',
      databaseId: portalDb.id,
      label: 'App user',
      username: 'portal_app',
      encryptedValue: seedEncrypt('PortalApp@2024!'),
      accessLevel: 'readwrite',
    },
  })
  console.log('  ✓ Database credentials: 2 entries')

  // 18. Project Credentials (for Portal + Bridge production)
  await prisma.projectCredential.upsert({
    where: { id: 'demo-proj-cred-00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'demo-proj-cred-00000000-0000-0000-0000-000000000001',
      projectId: portalProject.id,
      environmentId: portalProdEnv.id,
      label: 'Conexión a base de datos',
      type: 'DATABASE',
      username: 'portal_app',
      encryptedValue: seedEncrypt('postgresql://portal_app:PortalApp@2024!@192.168.1.10:5432/portal_db'),
      notes: 'Connection string de producción',
    },
  })
  console.log('  ✓ Project credentials: 1 entry')

  // 19. Change Requests
  const cr1 = await prisma.changeRequest.upsert({
    where: { id: 'demo-cr-00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'demo-cr-00000000-0000-0000-0000-000000000001',
      projectId: portalProject.id,
      title: 'Agregar módulo de pagos en línea',
      description:
        'Integrar pasarela de pago para que ciudadanos paguen tasas municipales desde el portal sin acudir a ventanilla.',
      requesterName: 'Lic. Roberto Alcalde',
      requesterDepartmentId: deptSupport.id,
      type: 'NEW_FEATURE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assignedToId: devUser.id,
      startedAt: new Date('2026-02-10'),
    },
  })

  await prisma.changeRequest.upsert({
    where: { id: 'demo-cr-00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'demo-cr-00000000-0000-0000-0000-000000000002',
      projectId: portalProject.id,
      title: 'Corrección: formulario de contacto no envía email',
      description:
        'El formulario de contacto de la sección "Ayuda" falla silenciosamente al enviar. Los ciudadanos no reciben confirmación.',
      requesterName: 'Ana Torres',
      requesterDepartmentId: deptSupport.id,
      type: 'BUG_FIX',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      assignedToId: devUser.id,
      startedAt: new Date('2026-01-15'),
      completedAt: new Date('2026-01-18'),
      completionNotes: 'Se corrigió la configuración SMTP. Probado en producción el 18/01/2026.',
    },
  })

  await prisma.changeRequest.upsert({
    where: { id: 'demo-cr-00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: 'demo-cr-00000000-0000-0000-0000-000000000003',
      projectId: bridgeProject.id,
      title: 'Nuevo endpoint: consulta de expedientes por DNI',
      description:
        'El Portal Ciudadano necesita un endpoint en el Bridge que retorne todos los expedientes activos de un ciudadano dado su número de DNI.',
      requesterName: 'Carlos Desarrollador',
      requesterDepartmentId: deptDev.id,
      type: 'NEW_FEATURE',
      priority: 'HIGH',
      status: 'APPROVED',
      assignedToId: devUser.id,
    },
  })

  await prisma.changeRequest.upsert({
    where: { id: 'demo-cr-00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: 'demo-cr-00000000-0000-0000-0000-000000000004',
      projectId: inventarioProject.id,
      title: 'Catálogo inicial de categorías de activos',
      description:
        'Definir y cargar el catálogo base de categorías: equipos de escritorio, notebooks, impresoras, servidores, switches, licencias.',
      requesterName: 'María DBA',
      requesterDepartmentId: deptInfra.id,
      type: 'DATA_CORRECTION',
      priority: 'MEDIUM',
      status: 'REQUESTED',
    },
  })
  console.log('  ✓ Change requests: 4 entries (IN_PROGRESS, COMPLETED, APPROVED, REQUESTED)')

  // 20. Change Request Comments
  await prisma.changeRequestComment.create({
    data: {
      changeRequestId: cr1.id,
      userId: adminUser.id,
      content: 'Aprobado en reunión del 10/02. Priorizar integración con Mercado Pago y transferencia bancaria.',
    },
  })
  await prisma.changeRequestComment.create({
    data: {
      changeRequestId: cr1.id,
      userId: devUser.id,
      content: 'Iniciando sprint. Estimación: 3 semanas. Creando branch feat/payment-gateway.',
    },
  })
  console.log('  ✓ Change request comments: 2 entries')

  console.log('\n✅ Seed complete!')
  console.log('   Admin:     admin@itforge.local / Admin2024!')
  console.log('   Developer: dev@itforge.local   / Dev2024!')
  console.log('   DBA:       dba@itforge.local   / Dba2024!')
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
