'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/core/crypto/encryption'
import { createSession, destroySession } from '@/core/auth/session'
import { setSessionCookie, getSessionCookie, clearSessionCookie } from '@/core/auth/cookies'
import { RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginFormState = {
  error?: string
  fields?: { email?: string }
}

// ─── Input validation ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

// ─── Rate limiting (DB-backed, no Redis required) ─────────────────────────────

async function isRateLimited(ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      ipAddress: ip,
      successful: false,
      createdAt: { gte: windowStart },
    },
  })
  return failedAttempts >= RATE_LIMIT_MAX_ATTEMPTS
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Server Action for the login form.
 * Flow: validate input → rate limit check → find user → verify password →
 *       create session → set cookie → audit log → redirect.
 *
 * Important: redirect() must be called OUTSIDE try/catch because Next.js
 * implements it by throwing a special error internally.
 */
export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const headersList = await headers()
  // x-forwarded-for is set by middleware; fall back to loopback in dev
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '127.0.0.1'
  const userAgent = headersList.get('user-agent') ?? undefined

  // 1. Rate limit check before doing any DB user lookup
  if (await isRateLimited(ip)) {
    return {
      error: 'Demasiados intentos fallidos. Espera 15 minutos antes de intentarlo nuevamente.',
    }
  }

  // 2. Input validation
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      fields: { email: formData.get('email') as string },
    }
  }

  const { email, password } = parsed.data

  // Helper to record attempt — extracted to avoid code duplication
  const recordAttempt = (userId: string | null, successful: boolean) =>
    prisma.loginAttempt.create({
      data: { userId, email, ipAddress: ip, successful },
    })

  // 3. Look up user by email
  // We intentionally do NOT reveal whether the email exists (same error message either way)
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
    select: {
      id: true,
      organizationId: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
    },
  })

  if (!user) {
    // Perform a dummy verify to prevent timing attacks that could reveal
    // whether an email exists via response time differences
    await verifyPassword('$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy', password).catch(() => null)
    await recordAttempt(null, false)
    return { error: 'Credenciales incorrectas', fields: { email } }
  }

  // 4. Verify password
  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    await recordAttempt(user.id, false)
    return { error: 'Credenciales incorrectas', fields: { email } }
  }

  // 5. Create session and set cookie
  // NOTE: do ALL async work before calling redirect() —
  // redirect() throws internally and any awaited work after it is lost.
  await recordAttempt(user.id, true)

  const { token } = await createSession(user.id, user.organizationId, ip, userAgent)
  await setSessionCookie(token)

  // 6. Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'login',
      resource: 'auth',
      ipAddress: ip,
      metadata: { userAgent: userAgent ?? null },
    },
  })

  redirect('/')
}

/**
 * Server Action for logout.
 * Destroys the server-side session, clears the cookie, redirects to /login.
 */
export async function logoutAction(): Promise<void> {
  const token = await getSessionCookie()
  if (token) {
    await destroySession(token)
  }
  await clearSessionCookie()
  redirect('/login')
}
