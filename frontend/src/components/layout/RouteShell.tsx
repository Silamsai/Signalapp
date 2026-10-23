"use client";

import { usePathname } from "next/navigation";
import { AuthLayout } from "./AuthLayout";
import { PortalLayout } from "./PortalLayout";

/** One shell switcher — auth vs workspace — so app/ only needs the root layout.tsx. */
export function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return <AuthLayout>{children}</AuthLayout>;
  }

  // `/` redirects to login; avoid portal flash while redirecting.
  // `/platform` is the app owner's console, outside any workspace.
  if (pathname === "/" || pathname === "/platform" || pathname.startsWith("/platform/")) {
    return <>{children}</>;
  }

  return <PortalLayout>{children}</PortalLayout>;
}
