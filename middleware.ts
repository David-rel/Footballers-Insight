import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const authPaths = ["/login", "/signup"];
const protectedPrefix = "/dashboard";
const onboardingPath = "/onboarding";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for NextAuth session token cookie (NextAuth v5 uses different cookie names)
  // Try multiple possible cookie names
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");

  const isAuthPage = authPaths.includes(pathname);
  const isProtected = pathname.startsWith(protectedPrefix);
  const isVerifyEmail = pathname === "/verify-email";
  const isOnboarding = pathname.startsWith(onboardingPath);

  // If user has session token and tries to access login/signup, redirect to dashboard
  // BUT allow access to verify-email and onboarding even if authenticated (they might need to verify/onboard)
  if (isAuthPage && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // If user doesn't have session token and tries to access protected pages or onboarding, redirect to login
  if ((isProtected || isOnboarding) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Allow verify-email and onboarding pages to be accessed even if authenticated
  // The dashboard will check verification and onboarding status and redirect if needed

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup", "/verify-email", "/onboarding/:path*", "/dashboard/:path*"],
};
