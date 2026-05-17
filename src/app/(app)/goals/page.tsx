"use client";

/**
 * /goals — Goal sheet list page.
 *
 * - Employee: shows their own goal sheets.
 * - Manager/Admin: shows their own sheets + direct reports' sheets.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GoalSheet {
  id: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "RETURNED";
  createdAt: string;
  updatedAt: string;
  cycle: { id: string; name: string; isActive: boolean };
  employee?: { id: string; name: string; email: string };
  _count: { goals: number };
}

const STATUS_LABELS: Record<GoalSheet["status"], string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

const STATUS_VARIANTS: Record<
  GoalSheet["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  RETURNED: "destructive",
};

function GoalSheetCard({ sheet }: { sheet: GoalSheet }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{sheet.cycle.name}</h3>
            {sheet.cycle.isActive && (
              <Badge variant="default" className="shrink-0 text-xs">
                Active
              </Badge>
            )}
          </div>
          {sheet.employee && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {sheet.employee.name}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {sheet._count.goals} goal{sheet._count.goals !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={STATUS_VARIANTS[sheet.status]}>
            {STATUS_LABELS[sheet.status]}
          </Badge>
          <Link href={`/goals/${sheet.id}`}>
            <Button variant="outline" size="sm">
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function GoalsContent() {
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/v1/goal-sheets")
      .then((r) => r.json())
      .then((data) => {
        setSheets(data.goalSheets ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load goal sheets");
        setLoading(false);
      });
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/goal-sheets", { method: "POST" });
      const data = await res.json();

      if (res.status === 409 && data.goalSheetId) {
        // Already exists — navigate to it
        window.location.href = `/goals/${data.goalSheetId}`;
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to create goal sheet");
        return;
      }

      window.location.href = `/goals/${data.goalSheet.id}`;
    } catch {
      setError("Failed to create goal sheet");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your goal sheets for each performance cycle.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "New Goal Sheet"}
        </Button>
      </div>

      {error && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sheets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No goal sheets yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click &quot;New Goal Sheet&quot; to create one for the active cycle.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => (
            <GoalSheetCard key={sheet.id} sheet={sheet} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  return (
    <RoleGuard allowedRoles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
      <GoalsContent />
    </RoleGuard>
  );
}
