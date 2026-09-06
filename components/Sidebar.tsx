"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mountain,
  LayoutDashboard,
  Layers,
  Users,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Layers", icon: Layers },
];

// The sidebar has no collapse control: the layer sections are the primary way
// into the dashboard, and a panel that can vanish behind a rail buries them.
// It is simply always open on xl and up, and lives in the mobile sheet below
// that breakpoint.
function SidebarContent({
  user,
  onLoginClick,
  onLogoutClick,
}: {
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}) {
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

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent",
              pathname === href && label === "Dashboard" && "bg-sidebar-accent",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {label}
          </Link>
        ))}

        {user?.role === "admin" && (
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
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        {user ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 px-3 text-destructive hover:text-destructive"
            onClick={onLogoutClick}
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            Logout
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 px-3"
            onClick={onLoginClick}
          >
            <LogIn className="size-4" strokeWidth={1.75} />
            Login
          </Button>
        )}
      </div>
    </>
  );
}

export function Sidebar({
  user,
  onLoginClick,
  onLogoutClick,
  variant = "floating",
  className,
}: {
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  variant?: "floating" | "embedded" | "combined";
  className?: string;
}) {
  if (variant === "embedded") {
    return (
      <div className={cn("flex h-full flex-col bg-sidebar", className)}>
        <SidebarContent
          user={user}
          onLoginClick={onLoginClick}
          onLogoutClick={onLogoutClick}
        />
      </div>
    );
  }

  // Content-only, no shadow/positioning — used as the top section of
  // MapDashboard's combined sidebar+themes+layers panel, where the parent owns
  // the surrounding chrome.
  if (variant === "combined") {
    return (
      <div className={cn("flex shrink-0 flex-col", className)}>
        <SidebarContent
          user={user}
          onLoginClick={onLoginClick}
          onLogoutClick={onLogoutClick}
        />
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
      <SidebarContent
        user={user}
        onLoginClick={onLoginClick}
        onLogoutClick={onLogoutClick}
      />
    </div>
  );
}
