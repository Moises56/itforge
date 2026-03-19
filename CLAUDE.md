# ITForge — IT Portfolio Management System

## Project Identity
- **Name**: ITForge
- **Type**: Multi-module IT Portfolio Management System with CMDB capabilities
- **Target**: Institutional/enterprise on-premise deployment (first client: municipal government)
- **Business Model**: White-label product, sold per installation with perpetual license

## Tech Stack (strict — no deviations)
- **Framework**: Next.js 15+ (App Router, Server Components, Server Actions)
- **Language**: TypeScript (strict mode)
- **ORM**: Prisma (latest stable)
- **Database**: PostgreSQL 16 (runs in Docker)
- **File Storage**: MinIO (runs in Docker, S3-compatible API)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Auth**: Custom implementation — httpOnly cookies + server-side sessions in DB
- **Package Manager**: pnpm

## Architecture Rules

### Server vs Client
- Default to Server Components. Use `'use client'` ONLY when the component needs: browser events (onClick, onChange), hooks (useState, useEffect), or browser APIs.
- ALL data fetching happens in Server Components or Server Actions. Never fetch from client components directly.
- Sensitive logic (credential decryption, permission checks, MinIO operations) MUST live in Server Actions or server-only modules. Use `import 'server-only'` guard.

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth layout group (login, etc.)
│   ├── (dashboard)/        # Main authenticated layout
│   │   ├── projects/       # Module: Development
│   │   ├── infrastructure/ # Module: Infrastructure (phase 2)
│   │   ├── support/        # Module: Support (phase 3)
│   │   └── admin/          # System configuration, users, roles
│   ├── api/                # Route Handlers (only when Server Actions aren't suitable)
│   └── layout.tsx
├── core/                   # Shared domain logic (server-only)
│   ├── auth/               # Session management, permission resolution
│   ├── crypto/             # AES-256-GCM encryption for credentials
│   ├── storage/            # MinIO client wrapper
│   └── permissions/        # RBAC engine with resource×action matrix
├── modules/                # Business logic by domain (server-only)
│   ├── development/        # Projects, credentials, change-requests
│   ├── infrastructure/     # Servers, networks, domains
│   └── support/            # Tickets, assets, maintenance
├── components/             # React components
│   ├── ui/                 # shadcn/ui base components
│   └── shared/             # App-wide components (sidebar, header, etc.)
├── lib/                    # Utilities
│   ├── prisma.ts           # PrismaClient singleton
│   ├── minio.ts            # MinIO client singleton
│   └── utils.ts            # Shared helpers
└── types/                  # Global TypeScript types
```

### Prisma Conventions
- Use `@map` and `@@map` for snake_case table/column names in DB, camelCase in code.
- Every table has `id` (UUID), `createdAt`, `updatedAt`.
- Soft deletes where appropriate: `deletedAt DateTime?`.
- All credential fields use `encryptedValue String` — never store plaintext.
- Multi-tenant by default: every business entity has `organizationId`.

### Naming
- Files: kebab-case (`change-request-list.tsx`)
- Components: PascalCase (`ChangeRequestList`)
- Functions/variables: camelCase
- DB tables: PascalCase in Prisma schema, snake_case in actual DB
- Server Actions: prefix with verb (`createProject`, `updateCredential`, `revealCredential`)
- Types/interfaces: PascalCase, suffix with purpose (`ProjectWithEnvironments`, `PermissionMatrix`)

## Security (non-negotiable)

### Authentication
- NO localStorage, NO sessionStorage for tokens — ever.
- Session ID stored in httpOnly, SameSite=Strict, Secure cookie.
- Sessions persisted in DB with expiration (8 hours).
- Re-authentication required for: revealing credentials, deleting projects, exporting source code, modifying roles.
- Failed login attempts: rate limit (5 per 15 minutes per IP).
- Passwords: argon2id hashing.

### Authorization — GAM-inspired RBAC
- Permission model: Resource × Action matrix, configurable via UI checkboxes.
- Resources: `projects`, `projects.credentials`, `projects.change-requests`, `projects.source-code`, `databases`, `databases.credentials`, `users`, `system.config`, `audit.logs`.
- Actions per resource: `view`, `create`, `edit`, `delete` + resource-specific (e.g., `reveal` for credentials, `change_status` for change requests).
- Users can have multiple roles. Permissions resolve as union (most permissive wins).
- Direct user permission overrides take precedence over role permissions.
- Default roles (templates): `owner`, `admin`, `developer`, `dba`, `viewer`.
- Deny by default: if no permission entry exists, access is denied.
- Every credential reveal logs: userId, timestamp, IP, credentialId.

### Credential Storage
- AES-256-GCM encryption with organization-specific master key.
- Master key from environment variable, never in DB.
- Encrypted fields: DB passwords, server SSH keys, API keys, admin access passwords.
- UI: credentials hidden by default, "Reveal" button with 30-second auto-hide + audit log entry.

## Key Domain Concepts

### Project Control Levels
- **Level 0**: No source code, no documentation — black box executable only.
- **Level 1**: No source code, but DB access available — can extend via satellite systems.
- **Level 2**: Source code available, no documentation.
- **Level 3**: Full control — source code + documentation + known deployment process.

### Project Deployment Types
- `web`: URL, server, IP, port, domain, SSL.
- `desktop`: UNC path to shared folder, executable name, system requirements.
- `service`: Backend service/API without frontend — server, port, protocol.
- `mobile`: App store links or APK distribution path.

### Change Requests (Kanban)
- States: `requested` → `under_review` → `approved` / `rejected` → `in_progress` → `completed` / `cancelled`.
- Each CR has: title, description, requester (person + department), priority, type, assignee, comments thread, file attachments (MinIO).
- View per project (history tab) AND global Kanban board across all projects.

### Project Relations
- `depends_on`: Technical dependency.
- `extends`: Satellite system extending a legacy system.
- `replaces`: New system replacing legacy.
- `shares_database`: Multiple systems using same DB.

### Database Management Scope
- Field `managedBy`: `dba_team` | `dev_team` | `external`.
- DBAs only see/edit databases where `managedBy = 'dba_team'`.
- Developers manage their own Docker-based DBs (PostgreSQL, MongoDB).

## White-Label / Multi-Tenant
- Organization entity at top level: name, logo (MinIO), primary/secondary colors, favicon.
- Theme applied via CSS custom properties injected from DB config.
- All UI text that could be institution-specific comes from configuration, not hardcoded.
- Feature flags per module: `development.enabled`, `infrastructure.enabled`, `support.enabled`.
- Terminology mapping: configurable labels (e.g., "Dependencia" vs "Departamento").
- NEVER hardcode any institution name in code.

## Development Environment
- Next.js runs locally (NOT in Docker) for fast HMR with Turbopack.
- Docker Compose (`docker-compose.dev.yml`): PostgreSQL + MinIO only.
- Production Docker Compose: Next.js + PostgreSQL + MinIO + Nginx reverse proxy.

## Commands
- `pnpm dev`: Start Next.js dev server
- `pnpm build`: Production build
- `pnpm db:push`: Push Prisma schema to DB
- `pnpm db:migrate`: Run migrations
- `pnpm db:seed`: Seed default roles, permissions, and admin user
- `pnpm db:studio`: Open Prisma Studio
- `pnpm lint`: ESLint
- `pnpm typecheck`: tsc --noEmit

## Code Quality
- ESLint + Prettier enforced.
- TypeScript strict mode: `"strict": true`, `"noUncheckedIndexedAccess": true`.
- No `any` types. Use `unknown` and narrow with type guards.
- Error boundaries for each module section.
- All Server Actions validate input with Zod schemas.
- Meaningful error messages in Spanish for end users, English for logs.

## Git Conventions
- Conventional commits: `feat(projects):`, `fix(auth):`, `refactor(permissions):`.
- Commit after each completed task step.
- Branch per feature: `feat/project-crud`, `feat/credential-vault`, `feat/kanban-board`.

## Git Author
- ALL commits must use the project's git config author, never Claude's identity.
- Before committing, never override git user.name or user.email.