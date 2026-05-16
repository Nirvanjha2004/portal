import RoleGuard from "@/components/shared/RoleGuard";

export default function GoalsPage() {
  return (
    <RoleGuard allowedRoles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
      <div>
        <h1 className="text-2xl font-bold">My Goals</h1>
        <p className="mt-2 text-muted-foreground">
          Goal sheets will appear here. (Task 7)
        </p>
      </div>
    </RoleGuard>
  );
}
