"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mountain, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AuthUser } from "@/lib/auth";

// The sidebar has no collapse control: the layer sections are the primary way
// into the dashboard, and a panel that can vanish behind a rail buries them.
// It is simply always open on xl and up, and lives in the mobile sheet below
// that breakpoint.
//
// It also carries no page navigation and no auth control. The dashboard is the
// only public page and the layer sections below are its navigation, so
// "Dashboard" and "Layers" links pointed at the page you were already on;
// login/logout lives in the header's account menu, which is present on every
// page and on every breakpoint. What is left is the wordmark plus the one link
// that does lead somewhere else — the admin user-management page.
function SidebarContent({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex items-center gap-2 p-4">
        <Mountain className="size-6 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            Shetrunjay Hills
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            Web GIS Dashboard
          </p>
        </div>
      </div>

      {user?.role === "admin" && (
        <nav className="flex flex-col gap-1 p-2 pt-0">
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent",
              pathname === "/admin/users" && "bg-sidebar-accent",
            )}
          >
            <span className="flex items-center gap-2.5">
              <Users className="size-4" strokeWidth={1.75} />
              Users
            </span>
            <Badge className="bg-accent text-accent-foreground">Admin</Badge>
          </Link>
        </nav>
      )}
    </>
  );
}

export function Sidebar({
  user,
  variant = "floating",
  className,
}: {
  user: AuthUser | null;
  variant?: "floating" | "embedded" | "combined";
  className?: string;
}) {
  if (variant === "embedded") {
    return (
      <div className={cn("flex h-full flex-col bg-sidebar", className)}>
        <SidebarContent user={user} />
      </div>
    );
  }

  // Content-only, no shadow/positioning — used as the top section of
  // MapDashboard's combined sidebar+themes+layers panel, where the parent owns
  // the surrounding chrome.
  if (variant === "combined") {
    return (
      <div className={cn("flex shrink-0 flex-col", className)}>
        <SidebarContent user={user} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "hidden w-64 flex-col rounded-xl bg-sidebar shadow-sm ring-1 ring-foreground/10 xl:flex",
        className,
      )}
    >
      <SidebarContent user={user} />
    </div>
  );
}
