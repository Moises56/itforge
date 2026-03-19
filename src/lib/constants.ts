// Shared constants — safe to import anywhere including middleware (no server-only)

export const SESSION_COOKIE_NAME = 'itforge_session'

export const SESSION_DURATION_SECONDS = 8 * 60 * 60 // 8 hours

export const RATE_LIMIT_MAX_ATTEMPTS = 5
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export const PUBLIC_PATHS = ['/login', '/api/health']
