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
    "/api/admin/init",
    "/pending-activation",
    "/account-suspended",
    "/request-invitation",
    "/api/request-invitation"
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

    // For authenticated users, allow access without profile checks in middleware
    // Profile validation will be handled at the component/page level instead
    // This avoids circular fetch requests and header conflicts
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