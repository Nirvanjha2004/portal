import RoleGuard from "@/components/shared/RoleGuard";

export default function ApprovalsPage() {
  return (
    <RoleGuard allowedRoles={["MANAGER", "ADMIN"]}>
      <div>
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <p className="mt-2 text-muted-foreground">
          Pending goal sheets will appear here. (Task 9)
        </p>
      </div>
    </RoleGuard>
  );
}
