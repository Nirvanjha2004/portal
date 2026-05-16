"use client";

/**
 * RoleGuard — client component that redirects to /login if the current
 * session role is not in the allowed list.
 *
 * Usage:
 *   <RoleGuard allowedRoles={["ADMIN"]}>
 *     <AdminPage />
 *   </RoleGuard>
 */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  /** Redirect target when access is denied. Defaults to "/login". */
  redirectTo?: string;
}

export default function RoleGuard({
  allowedRoles,
  children,
  redirectTo = "/login",
}: RoleGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace(redirectTo);
      return;
    }

    if (!allowedRoles.includes(session.user.role as Role)) {
      router.replace("/unauthorized");
    }
  }, [session, status, allowedRoles, redirectTo, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session || !allowedRoles.includes(session.user.role as Role)) {
    return null;
  }

  return <>{children}</>;
}
