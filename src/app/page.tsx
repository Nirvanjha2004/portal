import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Root page — redirects authenticated users to their role-appropriate
 * dashboard, and unauthenticated users to the login page.
 */
export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "ADMIN":
      redirect("/admin/dashboard");
    case "MANAGER":
      redirect("/approvals");
    case "EMPLOYEE":
    default:
      redirect("/goals");
  }
}
