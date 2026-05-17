"use client";

/**
 * /approvals — Manager approval queue.
 * Lists all PENDING_APPROVAL goal sheets for the manager's direct reports.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GoalSheet {
  id: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  employee: { id: string; name: string; email: string };
  cycle: { id: string; name: string };
  _count: { goals: number };
}

function ApprovalsContent() {
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/goal-sheets")
      .then((r) => r.json())
      .then((data) => {
        const pending = (data.goalSheets ?? []).filter(
          (s: GoalSheet) => s.status === "PENDING_APPROVAL"
        );
        setSheets(pending);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load approval queue");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goal sheets pending your review.
        </p>
      </div>

      {sheets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No pending approvals.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Employee</th>
                <th className="px-4 py-2 text-left font-medium">Cycle</th>
                <th className="px-4 py-2 text-left font-medium">Goals</th>
                <th className="px-4 py-2 text-left font-medium">Submitted</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={sheet.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{sheet.employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sheet.employee.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">{sheet.cycle.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{sheet._count.goals}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {sheet.submittedAt
                      ? new Date(sheet.submittedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/approvals/${sheet.id}`}>
                      <Button size="sm">Review</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <RoleGuard allowedRoles={["MANAGER", "ADMIN"]}>
      <ApprovalsContent />
    </RoleGuard>
  );
}
