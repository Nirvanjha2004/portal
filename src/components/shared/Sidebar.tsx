"use client";

/**
 * Role-aware sidebar navigation.
 * Shows different links based on the authenticated user's role.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  // Employee routes
  { label: "My Goals", href: "/goals", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { label: "Check-ins", href: "/checkins", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },

  // Manager routes
  { label: "Approvals", href: "/approvals", roles: ["MANAGER", "ADMIN"] },
  { label: "Team Check-ins", href: "/manager/checkins", roles: ["MANAGER", "ADMIN"] },
  { label: "Team Reports", href: "/manager/reports", roles: ["MANAGER", "ADMIN"] },

  // Admin routes
  { label: "Dashboard", href: "/admin/dashboard", roles: ["ADMIN"] },
  { label: "Cycles", href: "/admin/cycles", roles: ["ADMIN"] },
  { label: "Organisation", href: "/admin/org", roles: ["ADMIN"] },
  { label: "Shared Goals", href: "/admin/shared-goals", roles: ["ADMIN"] },
  { label: "Audit Log", href: "/admin/audit-log", roles: ["ADMIN"] },
  { label: "Escalations", href: "/admin/escalations", roles: ["ADMIN"] },
  { label: "Analytics", href: "/admin/analytics", roles: ["ADMIN"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : [];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background px-4 py-6">
      {/* Logo / brand */}
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold tracking-tight">Goal Portal</h1>
        {role && (
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {role}
          </span>
        )}
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User info at bottom */}
      {session?.user && (
        <div className="mt-auto border-t pt-4">
          <div className="px-2">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
