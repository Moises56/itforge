import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, PUBLIC_PATHS } from '@/lib/constants'

/**
 * Auth middleware — runs on the Edge Runtime (fast, no cold starts).
 *
 * Design decision: middleware checks cookie EXISTENCE only.
 * Full DB validation (expiry, user active status, etc.) happens inside
 * getCurrentUser() / validateSession() in each Server Component or Action.
 *
 * Why not validate against DB in middleware?
 * - Edge Runtime cannot run Prisma (requires Node.js APIs)
 * - Adding a fetch() call to /api/auth/validate adds ~20-50ms per request
 * - getCurrentUser() already handles expired/invalid sessions gracefully
 *
 * The session token is forwarded in `x-session-token` header so
 * Server Components can read it without touching cookies() again
 * (useful if we ever move to header-based auth for API routes).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Always allow Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')  // static files (images, fonts, etc.)
  ) {
    return NextResponse.next()
  }

  // 2. Allow public paths (login page, health check)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 3. Check for session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    // Preserve the intended destination so we can redirect back after login
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // 4. Cookie present — pass through, injecting token into request headers
  // Server Components use validateSession(token) for the actual DB check
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-session-token', sessionToken)
  requestHeaders.set('x-forwarded-for', request.headers.get('x-forwarded-for') ?? '127.0.0.1')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  // Match all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
