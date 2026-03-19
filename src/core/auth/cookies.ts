import 'server-only'

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/constants'

/**
 * Sets the session cookie with security-hardened options:
 * - httpOnly: not accessible via document.cookie (XSS protection)
 * - sameSite: strict (CSRF protection)
 * - secure: enforced in production (HTTPS only)
 * - path: / (available across whole app)
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  })
}

/**
 * Reads the session cookie value from the current request.
 * Returns undefined if not present.
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

/**
 * Deletes the session cookie from the browser.
 * Does NOT destroy the server-side session — call destroySession() separately.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
