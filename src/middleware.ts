import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

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

  const isAdminOnly = pathname.startsWith("/dashboard/admin");
  if (isAdminOnly && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/reset-password"],
};
