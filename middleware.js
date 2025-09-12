import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";
import { NextResponse } from 'next/server'

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/invite(.*)",
    "/api/webhooks/(.*)",
    "/api/health",
    "/api/invites/validate",
    "/pending-activation",
    "/account-suspended"
  ],
  ignoredRoutes: [
    "/api/webhooks/(.*)",
    "/_next(.*)",
    "/favicon.ico"
  ],

  async afterAuth(auth, req) {
    // Handle unauthenticated users
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url })
    }

    // If user is authenticated, check if they have a proper activated profile
    if (auth.userId && !auth.isPublicRoute) {
      
      // Skip profile checks for specific routes
      const skipProfileCheck = [
        '/api/invites/activate',
        '/api/auth/profile',
        '/sign-out',
        '/pending-activation',
        '/account-suspended'
      ].some(route => req.nextUrl.pathname.startsWith(route))

      if (!skipProfileCheck) {
        try {
          // For development, we'll do a simple check
          // In production, you'd want to cache this or use a more efficient method
          
          // Simple approach: try to access a protected API route
          const baseUrl = req.nextUrl.origin
          
          // Make a request to check user profile status
          const checkResponse = await fetch(`${baseUrl}/api/auth/check-profile`, {
            headers: {
              'Cookie': req.headers.get('cookie') || '',
              'User-Agent': req.headers.get('user-agent') || '',
            },
          }).catch(() => null)

          // If we can't check the profile, allow access but log it
          if (!checkResponse) {
            console.warn('Could not verify user profile status')
            return NextResponse.next()
          }

          if (checkResponse.status === 404) {
            // User doesn't have a profile - redirect to sign up with missing profile flag
            const url = new URL('/sign-up?missing_profile=true', req.url)
            return NextResponse.redirect(url)
          }

          if (checkResponse.status === 403) {
            // Profile exists but is not activated or is suspended
            const profileData = await checkResponse.json().catch(() => ({}))
            
            if (profileData.status === 'PENDING_ACTIVATION') {
              const url = new URL('/pending-activation', req.url)
              return NextResponse.redirect(url)
            }
            
            if (profileData.status === 'SUSPENDED') {
              const url = new URL('/account-suspended', req.url)
              return NextResponse.redirect(url)
            }
          }

        } catch (error) {
          console.error('Error in auth middleware:', error)
          // In case of error, allow access to prevent blocking legitimate users
        }
      }
    }

    return NextResponse.next()
  },
});

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ],
};