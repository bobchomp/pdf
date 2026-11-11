import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFrameAncestorsForToken } from "@/lib/api-viewer";

export default auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // The hosted viewer may only be framed by the websites its project lists — enforced by the
  // browser through frame-ancestors (an unknown token gets none, so only this site can frame it).
  if (pathname.startsWith("/v1/view/")) {
    const token = pathname.slice("/v1/view/".length);
    const origins = await getFrameAncestorsForToken(token);
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${origins.join(" ")}`.trim());
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  const isProtected = pathname.startsWith("/dashboard") || pathname === "/reset-password";

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isLoggedIn) {
    return NextResponse.next();
  }

  const mustResetPassword = req.auth?.user?.mustResetPassword;

  if (pathname.startsWith("/dashboard") && mustResetPassword) {
    return NextResponse.redirect(new URL("/reset-password", req.nextUrl.origin));
  }

  if (pathname === "/reset-password" && !mustResetPassword) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  const isAdminOnly = pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/developers");
  if (isAdminOnly && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/reset-password", "/v1/view/:path*"],
};
