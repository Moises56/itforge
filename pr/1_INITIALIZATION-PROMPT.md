# ITForge — Prompt de Inicialización para Claude Code

## Cómo Usar Este Documento

Este prompt está diseñado para ser usado en **fases incrementales** con Claude Code (Plan Pro).
NO pegues todo de una vez. Sigue el flujo de fases para optimizar el consumo de tokens.

---

## FASE 0: Setup del Proyecto (pegar completo en Claude Code)

```
Inicializa un proyecto Next.js llamado "itforge" con la siguiente configuración exacta:

1. Crea el proyecto con: pnpm create next-app@latest itforge --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
2. Entra al directorio: cd itforge
3. Instala dependencias core:
   pnpm add prisma @prisma/client
   pnpm add minio
   pnpm add argon2
   pnpm add zod
   pnpm add server-only
   pnpm add lucide-react
   pnpm add clsx tailwind-merge
   pnpm add -D @types/node

4. Inicializa Prisma: pnpm prisma init --datasource-provider postgresql

5. Crea docker-compose.dev.yml con:
   - PostgreSQL 16 (puerto 5432, user: itforge, pass: itforge_dev, db: itforge_db)
   - MinIO (puertos 9000 API + 9001 console, user: minioadmin, pass: minioadmin123)
   - Volumes persistentes para ambos

6. Configura el .env:
   DATABASE_URL="postgresql://itforge:itforge_dev@localhost:5432/itforge_db"
   MINIO_ENDPOINT="localhost"
   MINIO_PORT=9000
   MINIO_ACCESS_KEY="minioadmin"
   MINIO_SECRET_KEY="minioadmin123"
   MINIO_BUCKET="itforge-assets"
   ENCRYPTION_MASTER_KEY="genera-una-key-de-64-caracteres-hex"
   SESSION_SECRET="genera-una-key-de-32-caracteres-hex"
   NEXT_PUBLIC_APP_NAME="ITForge"

7. Crea la estructura de carpetas según el CLAUDE.md del proyecto.

8. Configura tsconfig.json con strict mode habilitado y noUncheckedIndexedAccess: true.

9. Agrega scripts al package.json:
   "db:push": "prisma db push",
   "db:migrate": "prisma migrate dev",
   "db:seed": "prisma db seed",
   "db:studio": "prisma studio",
   "typecheck": "tsc --noEmit"

10. Lee el CLAUDE.md del proyecto para entender la arquitectura completa antes de generar código.

NO generes ningún componente de UI todavía. Solo la estructura base, configuraciones y Docker.
Haz commit: "chore: initial project setup with Next.js, Prisma, MinIO, Docker"
```

---

## FASE 1: Schema de Prisma + Auth (dividir en 2 prompts)

### Prompt 1A — Schema de Base de Datos

```
Lee el CLAUDE.md para entender el modelo de datos completo. Ahora crea el schema de Prisma
(prisma/schema.prisma) con TODAS estas entidades:

CORE (multi-tenant):
- Organization: id, name, slug, logo (path MinIO), primaryColor, secondaryColor, favicon, config (Json), createdAt, updatedAt
- User: id, organizationId, username, email, passwordHash, isActive, lastLoginAt, createdAt, updatedAt, deletedAt
- Session: id, userId, token (unique), ipAddress, userAgent, expiresAt, createdAt
- AuditLog: id, organizationId, userId, action, resource, resourceId, details (Json), ipAddress, createdAt

PERMISOS (modelo GAM):
- Resource: id, code (unique), name, module (enum: DEVELOPMENT, INFRASTRUCTURE, SUPPORT, SYSTEM), sortOrder
- Action: id, code (unique), name, isUniversal (actions que aplican a todos los recursos)
- ResourceAction: id, resourceId, actionId (qué acciones son válidas para qué recurso)
- Role: id, organizationId, name, description, isSystem (no editable), isDefault (asignado a nuevos usuarios), createdAt
- RolePermission: id, roleId, resourceActionId, allowed (Boolean)
- UserRole: userId, roleId (many-to-many)
- UserPermissionOverride: id, userId, resourceActionId, allowed (Boolean)

MÓDULO DESARROLLO:
- Project: id, organizationId, name, code (unique por org), description, controlLevel (enum 0-3), deploymentType (enum: WEB, DESKTOP, SERVICE, MOBILE), status (enum: IDEA, PLANNING, DEVELOPMENT, QA, PRODUCTION, SUSPENDED, DISCONTINUED), hasSourceCode, repositoryUrl, sourceCodePath (MinIO), priority (enum), responsibleUserId, createdAt, updatedAt, deletedAt
- ProjectEnvironment: id, projectId, type (enum: DEV, STAGING, PRODUCTION), serverId (nullable), serverIp, serverPort, url, uncPath (para desktop), notes, createdAt, updatedAt
- ProjectCredential: id, projectId, environmentId (nullable), label, type (enum: DATABASE, SSH, API_KEY, ADMIN_ACCESS, OTHER), username, encryptedValue, notes, createdAt, updatedAt
- ProjectRole: id, projectId, roleName, description (qué hace ese rol DENTRO del proyecto)
- DepartmentUsage: id, projectId, departmentId, estimatedUsers, contactPerson, notes
- Department: id, organizationId, name, code, parentId (self-relation para jerarquía)
- TechStack: id, projectId, category (enum: LANGUAGE, FRAMEWORK, DATABASE, TOOL, OTHER), name, version
- ProjectRelation: id, sourceProjectId, targetProjectId, type (enum: DEPENDS_ON, EXTENDS, REPLACES, SHARES_DATABASE), notes
- ProjectDocument: id, projectId, title, type (enum: SCREENSHOT, TECHNICAL_DOC, USER_MANUAL, ARCHITECTURE_DIAGRAM, OTHER), filePath (MinIO), fileSize, mimeType, uploadedById, createdAt

CHANGE REQUESTS:
- ChangeRequest: id, projectId, title, description, requestedById (userId nullable), requesterName, requesterDepartmentId, type (enum: NEW_FEATURE, MODIFICATION, BUG_FIX, DATA_CORRECTION, REPORT, VISUAL_CHANGE, OTHER), priority (enum: LOW, MEDIUM, HIGH, CRITICAL), status (enum: REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED), assignedToId (userId), rejectionReason, completionNotes, startedAt, completedAt, createdAt, updatedAt
- ChangeRequestComment: id, changeRequestId, userId, content, createdAt, updatedAt
- ChangeRequestAttachment: id, changeRequestId, filePath (MinIO), fileName, fileSize, mimeType, uploadedById, createdAt

BASES DE DATOS:
- Database: id, organizationId, projectId (nullable), name, engine (enum: POSTGRESQL, MYSQL, SQL_SERVER, MONGODB, SQLITE, OTHER), version, serverId (nullable), serverIp, port, databaseName, managedBy (enum: DBA_TEAM, DEV_TEAM, EXTERNAL), notes, createdAt, updatedAt
- DatabaseCredential: id, databaseId, label, username, encryptedValue, accessLevel, createdAt, updatedAt

Usa enums de Prisma para todos los tipos enumerados.
Agrega índices en: organizationId (en todas las tablas), projectId, status, code.
Agrega unique constraints donde corresponda.
Todas las relaciones con onDelete apropiado (Cascade, SetNull, Restrict según el caso).
Haz commit: "feat(db): complete Prisma schema with all entities and relations"
```


```
promt 1A actualizado:
Lee el CLAUDE.md completo y revisa el schema de Prisma actual en prisma/schema.prisma.
EXTIENDE el schema existente (no lo reescribas desde cero, conserva lo que ya existe y agrégale lo que falta) con TODAS las entidades que falten:

Revisa qué ya existe y solo agrega lo que falta de esta lista:

CORE (si falta algo):
- Organization: slug, logo, primaryColor, secondaryColor, favicon, config (Json)
- Department: organizationId, name, code, parentId (self-relation jerárquica)

PERMISOS (si falta algo):
- Resource: code (unique), name, module (enum: DEVELOPMENT, INFRASTRUCTURE, SUPPORT, SYSTEM), sortOrder
- Action: code (unique), name, isUniversal
- ResourceAction: resourceId, actionId
- Role: organizationId, name, description, isSystem, isDefault
- RolePermission: roleId, resourceActionId, allowed
- UserRole: userId, roleId (many-to-many)
- UserPermissionOverride: userId, resourceActionId, allowed

MÓDULO DESARROLLO:
- Project: organizationId, name, code (unique por org), description, controlLevel (enum: LEVEL_0, LEVEL_1, LEVEL_2, LEVEL_3), deploymentType (enum: WEB, DESKTOP, SERVICE, MOBILE), status (enum: IDEA, PLANNING, DEVELOPMENT, QA, PRODUCTION, SUSPENDED, DISCONTINUED), hasSourceCode, repositoryUrl, sourceCodePath, priority (enum: LOW, MEDIUM, HIGH, CRITICAL), responsibleUserId
- ProjectEnvironment: projectId, type (enum: DEV, STAGING, PRODUCTION), serverIp, serverPort, url, uncPath, notes
- ProjectCredential: projectId, environmentId (nullable), label, type (enum: DATABASE, SSH, API_KEY, ADMIN_ACCESS, OTHER), username, encryptedValue, notes
- ProjectRole: projectId, roleName, description
- DepartmentUsage: projectId, departmentId, estimatedUsers, contactPerson, notes
- TechStack: projectId, category (enum: LANGUAGE, FRAMEWORK, DATABASE_ENGINE, TOOL, OTHER), name, version
- ProjectRelation: sourceProjectId, targetProjectId, type (enum: DEPENDS_ON, EXTENDS, REPLACES, SHARES_DATABASE), notes
- ProjectDocument: projectId, title, type (enum: SCREENSHOT, TECHNICAL_DOC, USER_MANUAL, ARCHITECTURE_DIAGRAM, CONFIG_FILE, OTHER), filePath, fileSize, mimeType, uploadedById

CHANGE REQUESTS:
- ChangeRequest: projectId, title, description, requestedById (nullable), requesterName, requesterDepartmentId, type (enum: NEW_FEATURE, MODIFICATION, BUG_FIX, DATA_CORRECTION, REPORT, VISUAL_CHANGE, OTHER), priority (enum), status (enum: REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED), assignedToId, rejectionReason, completionNotes, startedAt, completedAt
- ChangeRequestComment: changeRequestId, userId, content
- ChangeRequestAttachment: changeRequestId, filePath, fileName, fileSize, mimeType, uploadedById

BASES DE DATOS:
- Database: organizationId, projectId (nullable), name, engine (enum: POSTGRESQL, MYSQL, SQL_SERVER, MONGODB, SQLITE, OTHER), version, serverIp, port, databaseName, managedBy (enum: DBA_TEAM, DEV_TEAM, EXTERNAL), notes
- DatabaseCredential: databaseId, label, username, encryptedValue, accessLevel

Cada tabla con id UUID, createdAt, updatedAt. Soft delete (deletedAt) donde tenga sentido.
Índices en organizationId, projectId, status, code.
Unique constraints donde corresponda.
Relaciones con onDelete apropiado (Cascade, SetNull, Restrict según el caso).
Usa enums de Prisma.

Después de actualizar el schema, ejecuta pnpm db:push para verificar que no hay errores.
Haz commit: "feat(db): complete Prisma schema with all project entities"

```



### Prompt 1B — Sistema de Autenticación

```
Lee el CLAUDE.md (sección Security). Implementa el sistema de autenticación completo:

1. src/core/crypto/encryption.ts:
   - Funciones encrypt/decrypt usando AES-256-GCM con la ENCRYPTION_MASTER_KEY del .env
   - Funciones hashPassword/verifyPassword usando argon2id

2. src/core/auth/session.ts:
   - createSession(userId, ip, userAgent): genera token crypto random, guarda en DB, retorna session
   - validateSession(token): busca en DB, verifica expiración, retorna user + roles
   - destroySession(token): elimina de DB
   - destroyAllUserSessions(userId): cierra todas las sesiones de un usuario

3. src/core/auth/cookies.ts:
   - setSessionCookie(token): httpOnly, SameSite=Strict, Secure, Path=/, MaxAge=8h
   - getSessionCookie(): lee la cookie del request
   - clearSessionCookie(): elimina la cookie

4. src/app/(auth)/login/page.tsx: Server Component con formulario de login
5. src/app/(auth)/login/actions.ts: Server Action loginAction que:
   - Valida input con Zod (username, password)
   - Rate limiting: máximo 5 intentos por IP en 15 minutos
   - Verifica credenciales contra DB (argon2)
   - Crea sesión + setea cookie
   - Registra en AuditLog (login exitoso o fallido)
   - Redirect al dashboard

6. src/middleware.ts: Middleware de Next.js que:
   - Lee la cookie de sesión
   - Valida la sesión contra DB
   - Si no es válida: redirect a /login
   - Rutas públicas excluidas: /login, /api/health
   - Inyecta userId y organizationId en headers para uso downstream

7. src/core/auth/get-current-user.ts:
   - Función helper que obtiene el usuario actual desde la sesión (para uso en Server Components)
   - Retorna: { id, username, email, organizationId, roles, permissions }

Haz commit: "feat(auth): complete authentication system with httpOnly sessions"
```

---

## FASE 2: Sistema de Permisos (1 prompt)

```
Lee el CLAUDE.md (sección Authorization — GAM-inspired RBAC). Implementa:

1. src/core/permissions/resolve.ts:
   - Función resolvePermission(userId, resourceCode, actionCode): Boolean
     - Paso 1: Busca en UserPermissionOverride → si existe, retorna ese valor
     - Paso 2: Busca en RolePermission para TODOS los roles del usuario → union (si alguno permite, retorna true)
     - Paso 3: Si no hay entrada, retorna false (deny by default)
   - Función getUserPermissionMatrix(userId): retorna la matriz completa de permisos para la UI de configuración
   - Cache en memoria por sesión (Map<string, boolean>) para evitar queries repetidos

2. src/core/permissions/middleware.ts:
   - Higher-order function requirePermission(resource, action) que wrappea Server Actions
   - Si no tiene permiso: throw AuthorizationError
   - Registra en AuditLog si la acción es sensible

3. src/core/permissions/scope.ts:
   - Función getDataScope(userId, resource): retorna filtros Prisma WHERE adicionales
   - Para DBAs: { managedBy: 'DBA_TEAM' } en recursos de databases
   - Para developers: { responsibleUserId: userId } o sin filtro si tiene permiso global

4. prisma/seed.ts:
   - Crea la Organization default
   - Crea todos los Resources y Actions del sistema
   - Crea las ResourceAction válidas
   - Crea los 5 roles default (owner, admin, developer, dba, viewer) con sus permisos pre-configurados
   - Crea el usuario admin inicial (username: admin, password: Admin2024!)
   - Asigna rol owner al admin

5. src/app/(dashboard)/admin/roles/page.tsx:
   - Vista de lista de roles
   - Al hacer clic en un rol: abre la matriz de checkboxes Resource × Action
   - Checkbox por cada ResourceAction válida
   - Toggle "Full Control" por recurso
   - Guardar cambios via Server Action

Haz commit: "feat(permissions): GAM-inspired RBAC with resource×action matrix"
```

---

## FASE 3: CRUD de Proyectos + Dashboard (dividir en 2-3 prompts)

### Prompt 3A — Dashboard Principal

```
Usa la skill frontend-design para el diseño. Lee el CLAUDE.md para el contexto.

Crea el layout principal del dashboard (src/app/(dashboard)/layout.tsx) y la página home:

1. Layout con sidebar:
   - Logo de la organización (desde DB config o placeholder)
   - Navegación por módulos (solo los habilitados por feature flags)
   - Módulo Desarrollo: Projects, Change Requests, Databases
   - Módulo Admin: Users, Roles, System Config (solo si tiene permiso)
   - User info en el footer del sidebar + botón logout
   - Responsive: sidebar colapsable en mobile

2. Dashboard home (src/app/(dashboard)/page.tsx):
   - Cards de resumen: total proyectos por estado (Producción, Desarrollo, Ideas, Suspendido)
   - Change Requests pendientes (últimos 5)
   - Proyectos recientes (últimos 5 modificados)
   - Indicadores de riesgo: proyectos sin documentación, proyectos Level 0 sin responsable

Estilo: profesional, industrial/utilitarian, tema oscuro con acentos de color corporativo.
Tipografía: elegante y legible. NO uses Inter, Roboto ni Arial.
Usa shadcn/ui como base pero personaliza para que no se vea genérico.

Haz commit: "feat(ui): main dashboard layout with sidebar and summary cards"
```

### Prompt 3B — CRUD de Proyectos

```
Implementa el CRUD completo de proyectos. Lee CLAUDE.md para entender los campos.

1. src/app/(dashboard)/projects/page.tsx:
   - Lista de proyectos en tarjetas o tabla (toggle de vista)
   - Filtros: por estado, por nivel de control, por tipo de deployment, por departamento
   - Búsqueda por nombre o código
   - Badge de color según nivel de control (rojo=0, amarillo=1, naranja=2, verde=3)
   - Badge de estado del proyecto
   - Botón "Ir al sitio" visible para proyectos en producción con URL

2. src/app/(dashboard)/projects/new/page.tsx:
   - Formulario multi-step o con tabs:
     Tab 1: Info básica (nombre, código, descripción, estado, tipo deployment, nivel de control)
     Tab 2: Stack técnico (agregar lenguajes, frameworks, BD usada)
     Tab 3: Ambientes (dev, staging, prod con servidor, IP, URL)
     Tab 4: Departamentos que lo usan (multi-select + cantidad de usuarios)
   - Validación con Zod en Server Action
   - Verificar permisos antes de crear

3. src/app/(dashboard)/projects/[id]/page.tsx:
   - Vista completa del proyecto con tabs:
     - General: toda la info, badges de estado y nivel de control, link directo
     - Ambientes: lista de ambientes con su infra
     - Credenciales: lista con botón "Revelar" (requiere permiso + audit log)
     - Stack Técnico: tabla de tecnologías
     - Departamentos: quién lo usa
     - Documentación: archivos subidos (screenshots, manuales, diagramas)
     - Cambios: historial de Change Requests (Kanban mini)
     - Relaciones: proyectos relacionados (depende de, extiende, reemplaza)
     - Roles: roles internos del proyecto y qué hace cada uno

4. Todas las acciones (crear, editar, eliminar) como Server Actions con:
   - Validación Zod
   - Verificación de permisos via requirePermission()
   - Audit log para operaciones sensibles
   - Manejo de errores con mensajes descriptivos

Haz commit: "feat(projects): complete project CRUD with detail view"
```

---

## FASE 4: Credenciales + MinIO (1 prompt)

```
Implementa el vault de credenciales y la integración con MinIO:

1. src/core/storage/minio-client.ts:
   - Singleton del cliente MinIO
   - uploadFile(bucket, path, file, metadata): sube archivo, retorna path
   - getPresignedUrl(bucket, path, expiresInSeconds=300): URL temporal para descarga
   - deleteFile(bucket, path): elimina archivo
   - Crear buckets automáticamente al iniciar si no existen: dev-assets, infra-assets, support-assets

2. Credenciales — Server Actions:
   - createCredential: cifra el valor con AES-256-GCM antes de guardar
   - revealCredential: requiere re-autenticación (pedir password), descifra, registra audit log, retorna valor
   - updateCredential: cifra nuevo valor
   - deleteCredential: soft delete o hard delete según política

3. UI de credenciales en la ficha del proyecto:
   - Lista mostrando: label, tipo, username, valor oculto (••••••••)
   - Botón "Revelar" → modal pidiendo password → muestra valor por 30 segundos → auto-oculta
   - Botón "Copiar" que copia al clipboard sin mostrar en pantalla
   - Indicador de cuándo fue revelada la última vez y por quién

4. Upload de documentación:
   - Componente de upload drag-and-drop para archivos
   - Validación de tipo y tamaño (máx 50MB)
   - Upload a MinIO via Server Action
   - Preview de imágenes, icono para PDFs/docs
   - Botón de descarga genera presigned URL temporal

Haz commit: "feat(vault): credential encryption and MinIO file management"
```

---

## FASE 5: Change Requests + Kanban (1 prompt)

```
Implementa el sistema de Change Requests:

1. src/app/(dashboard)/projects/[id]/changes/page.tsx:
   - Kanban board con columnas por estado
   - Drag and drop para mover entre estados (verificar permisos de change_status)
   - Cada tarjeta muestra: título, prioridad (color), solicitante, fecha, asignado a

2. src/app/(dashboard)/change-requests/page.tsx:
   - Vista global de TODOS los Change Requests de todos los proyectos
   - Filtros: por proyecto, por estado, por prioridad, por asignado, por departamento
   - Vista Kanban y vista tabla (toggle)

3. Detalle de Change Request:
   - Toda la información del CR
   - Hilo de comentarios (crear, editar propios)
   - Adjuntos (upload a MinIO)
   - Timeline de cambios de estado (quién movió a qué estado y cuándo)
   - Botones de acción según estado y permisos: Aprobar, Rechazar, Iniciar, Completar, Cancelar

4. Server Actions para todas las operaciones con validación Zod + permisos + audit log.

Haz commit: "feat(changes): change request system with Kanban board"
```

---

## FASES POSTERIORES (prompts individuales cuando se necesiten)

- **Fase 6**: Admin de usuarios + UI de matriz de permisos (checkboxes)
- **Fase 7**: Configuración white-label (logo, colores, feature flags)
- **Fase 8**: Módulo de bases de datos (CRUD + vista DBA)
- **Fase 9**: Relaciones entre proyectos + vista de dependencias
- **Fase 10**: Docker Compose de producción + seed de datos demo
- **Fase 11**: Módulo Infraestructura (phase 2)
- **Fase 12**: Módulo Soporte (phase 3)
