"use client";

/**
 * /approvals/[id] — Manager approval detail page.
 *
 * Shows all goals with inline editable Target + Weightage.
 * Shared goal targets are read-only.
 * Approve / Return buttons with comment.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import RoleGuard from "@/components/shared/RoleGuard";
import WeightageBar from "@/components/goals/WeightageBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type UoM =
  | "NUMERIC_MIN"
  | "NUMERIC_MAX"
  | "PERCENTAGE_MIN"
  | "PERCENTAGE_MAX"
  | "TIMELINE"
  | "ZERO_BASED";

const UOM_LABELS: Record<UoM, string> = {
  NUMERIC_MIN: "Numeric (Min)",
  NUMERIC_MAX: "Numeric (Max)",
  PERCENTAGE_MIN: "Percentage (Min)",
  PERCENTAGE_MAX: "Percentage (Max)",
  TIMELINE: "Timeline",
  ZERO_BASED: "Zero-based",
};

interface Goal {
  id: string;
  title: string;
  description: string;
  uom: UoM;
  target: string;
  weightage: number;
  isShared: boolean;
  isReadOnly: boolean;
  thrustArea: { id: string; name: string };
}

interface GoalSheet {
  id: string;
  status: string;
  employee: { id: string; name: string; email: string };
  cycle: { id: string; name: string };
  goals: Goal[];
}

function GoalEditRow({
  goal,
  sheetId,
  onUpdated,
}: {
  goal: Goal;
  sheetId: string;
  onUpdated: () => void;
}) {
  const [target, setTarget] = useState(goal.target);
  const [weightage, setWeightage] = useState(String(goal.weightage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { weightage: parseInt(weightage, 10) };
      if (!goal.isReadOnly) body.target = target;

      const res = await fetch(`/api/v1/goal-sheets/${sheetId}/goals/${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
      } else {
        setDirty(false);
        onUpdated();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t">
      <td className="px-4 py-3">
        <div className="font-medium">{goal.title}</div>
        <div className="text-xs text-muted-foreground">{goal.thrustArea.name}</div>
        {goal.isShared && (
          <Badge variant="secondary" className="mt-1 text-xs">
            Shared
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {UOM_LABELS[goal.uom]}
      </td>
      <td className="px-4 py-3">
        {goal.isReadOnly ? (
          <span className="text-sm">{goal.target}</span>
        ) : (
          <input
            className="w-28 rounded border border-input bg-background px-2 py-1 text-sm"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setDirty(true);
            }}
            aria-label={`Target for ${goal.title}`}
          />
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          className="w-20 rounded border border-input bg-background px-2 py-1 text-sm"
          value={weightage}
          min={10}
          max={100}
          onChange={(e) => {
            setWeightage(e.target.value);
            setDirty(true);
          }}
          aria-label={`Weightage for ${goal.title}`}
        />
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-destructive">{error}</span>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "…" : "Save"}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function ApprovalDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [sheet, setSheet] = useState<GoalSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSheet = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/goal-sheets/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load sheet");
        return;
      }
      const data = await res.json();
      setSheet(data.goalSheet);
    } catch {
      setError("Failed to load sheet");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  async function handleApprove() {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/goal-sheets/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to approve");
      } else {
        router.push("/approvals");
      }
    } catch {
      setActionError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturn() {
    if (!returnComment.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/goal-sheets/${id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: returnComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to return sheet");
      } else {
        router.push("/approvals");
      }
    } catch {
      setActionError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push("/approvals")}>
          ← Back
        </Button>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? "Sheet not found"}
        </div>
      </div>
    );
  }

  const totalWeightage = sheet.goals.reduce((s, g) => s + g.weightage, 0);
  const isPending = sheet.status === "PENDING_APPROVAL";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/approvals")}
            className="-ml-2 mb-2"
          >
            ← Back to Queue
          </Button>
          <h1 className="text-2xl font-bold">{sheet.cycle.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sheet.employee.name} · {sheet.employee.email}
          </p>
        </div>
        <Badge variant={isPending ? "outline" : "default"}>
          {sheet.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Weightage bar */}
      <div className="rounded-md border bg-card p-4">
        <WeightageBar total={totalWeightage} />
      </div>

      {/* Goals table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Goal</th>
              <th className="px-4 py-2 text-left font-medium">UoM</th>
              <th className="px-4 py-2 text-left font-medium">Target</th>
              <th className="px-4 py-2 text-left font-medium">Weightage (%)</th>
              <th className="px-4 py-2 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sheet.goals.map((goal) => (
              <GoalEditRow
                key={goal.id}
                goal={goal}
                sheetId={sheet.id}
                onUpdated={fetchSheet}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          {actionError && (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}

          {!showReturnForm ? (
            <div className="flex gap-3">
              <Button onClick={handleApprove} disabled={submitting}>
                {submitting ? "Approving…" : "Approve"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReturnForm(true)}
                disabled={submitting}
              >
                Return for Rework
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Rework Comment <span className="text-destructive">*</span>
              </label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={4}
                maxLength={2000}
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="Explain what needs to be changed…"
                aria-label="Rework comment"
              />
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleReturn}
                  disabled={submitting || !returnComment.trim()}
                >
                  {submitting ? "Returning…" : "Return Sheet"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReturnForm(false);
                    setReturnComment("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApprovalDetailPage() {
  return (
    <RoleGuard allowedRoles={["MANAGER", "ADMIN"]}>
      <ApprovalDetailContent />
    </RoleGuard>
  );
}
