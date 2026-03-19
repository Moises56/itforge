// Global TypeScript types for ITForge

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'reveal' | 'change_status' | 'export'

export type PermissionResource =
  | 'projects'
  | 'projects.credentials'
  | 'projects.change-requests'
  | 'projects.source-code'
  | 'databases'
  | 'databases.credentials'
  | 'users'
  | 'system.config'
  | 'audit.logs'

export type ProjectControlLevel = 0 | 1 | 2 | 3

export type ProjectDeploymentType = 'web' | 'desktop' | 'service' | 'mobile'

export type ProjectRelationType = 'depends_on' | 'extends' | 'replaces' | 'shares_database'

export type ChangeRequestStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type DatabaseManagedBy = 'dba_team' | 'dev_team' | 'external'
