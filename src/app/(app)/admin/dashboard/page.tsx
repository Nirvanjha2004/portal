import RoleGuard from "@/components/shared/RoleGuard";

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Completion dashboard will appear here. (Task 16)
        </p>
      </div>
    </RoleGuard>
  );
}
