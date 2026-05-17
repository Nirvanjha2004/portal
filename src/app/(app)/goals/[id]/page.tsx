"use client";

/**
 * /goals/[id] — View / edit a goal sheet.
 *
 * - Shows all goals in the sheet.
 * - Allows adding, editing, and removing goals when the sheet is DRAFT.
 * - Shows the WeightageBar with live total.
 * - Draft save button persists the current state.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import RoleGuard from "@/components/shared/RoleGuard";
import WeightageBar from "@/components/goals/WeightageBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ThrustArea {
  id: string;
  name: string;
}

interface Goal {
  id: string;
  thrustAreaId: string;
  thrustArea: ThrustArea;
  title: string;
  description: string;
  uom: UoM;
  target: string;
  weightage: number;
  isShared: boolean;
  isReadOnly: boolean;
}

interface GoalSheet {
  id: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "RETURNED";
  cycle: { id: string; name: string; isActive: boolean };
  employee: { id: string; name: string; email: string };
  goals: Goal[];
  reworkComment?: string | null;
}

// ─── Blank goal form ──────────────────────────────────────────────────────────

interface GoalFormData {
  thrustAreaId: string;
  title: string;
  description: string;
  uom: UoM;
  target: string;
  weightage: string;
}

const BLANK_GOAL: GoalFormData = {
  thrustAreaId: "",
  title: "",
  description: "",
  uom: "NUMERIC_MIN",
  target: "",
  weightage: "",
};

// ─── GoalRow component ────────────────────────────────────────────────────────

interface GoalRowProps {
  goal: Goal;
  thrustAreas: ThrustArea[];
  isDraft: boolean;
  onUpdate: (goalId: string, data: Partial<GoalFormData>) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

function GoalRow({ goal, thrustAreas, isDraft, onUpdate, onDelete }: GoalRowProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<GoalFormData>({
    thrustAreaId: goal.thrustAreaId,
    title: goal.title,
    description: goal.description,
    uom: goal.uom,
    target: goal.target,
    weightage: String(goal.weightage),
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(goal.id, {
        ...form,
        weightage: form.weightage,
      });
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this goal?")) return;
    setDeleting(true);
    try {
      await onDelete(goal.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setDeleting(false);
    }
  }

  if (!editing) {
    return (
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{goal.title}</span>
              {goal.isShared && (
                <Badge variant="secondary" className="text-xs">
                  Shared
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{goal.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <strong>Thrust Area:</strong> {goal.thrustArea.name}
              </span>
              <span>
                <strong>UoM:</strong> {UOM_LABELS[goal.uom]}
              </span>
              <span>
                <strong>Target:</strong> {goal.target}
              </span>
              <span>
                <strong>Weightage:</strong> {goal.weightage}%
              </span>
            </div>
          </div>
          {isDraft && (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "…" : "Remove"}
              </Button>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Thrust Area */}
        <div>
          <label className="mb-1 block text-xs font-medium">Thrust Area</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.thrustAreaId}
            onChange={(e) => setForm({ ...form, thrustAreaId: e.target.value })}
          >
            <option value="">Select…</option>
            {thrustAreas.map((ta) => (
              <option key={ta.id} value={ta.id}>
                {ta.name}
              </option>
            ))}
          </select>
        </div>

        {/* UoM */}
        <div>
          <label className="mb-1 block text-xs font-medium">Unit of Measurement</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.uom}
            onChange={(e) => setForm({ ...form, uom: e.target.value as UoM })}
          >
            {(Object.keys(UOM_LABELS) as UoM[]).map((u) => (
              <option key={u} value={u}>
                {UOM_LABELS[u]}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Title</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            disabled={goal.isReadOnly}
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Description</label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
          />
        </div>

        {/* Target */}
        <div>
          <label className="mb-1 block text-xs font-medium">Target</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            disabled={goal.isReadOnly}
          />
        </div>

        {/* Weightage */}
        <div>
          <label className="mb-1 block text-xs font-medium">
            Weightage (%)
          </label>
          <input
            type="number"
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.weightage}
            onChange={(e) => setForm({ ...form, weightage: e.target.value })}
            min={10}
            max={100}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── AddGoalForm component ────────────────────────────────────────────────────

interface AddGoalFormProps {
  sheetId: string;
  thrustAreas: ThrustArea[];
  onAdded: (goal: Goal) => void;
}

function AddGoalForm({ sheetId, thrustAreas, onAdded }: AddGoalFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GoalFormData>(BLANK_GOAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/goal-sheets/${sheetId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          weightage: parseInt(form.weightage, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add goal");
        return;
      }
      onAdded(data.goal);
      setForm(BLANK_GOAL);
      setOpen(false);
    } catch {
      setError("Failed to add goal");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + Add Goal
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium">New Goal</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Thrust Area */}
        <div>
          <label className="mb-1 block text-xs font-medium">
            Thrust Area <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.thrustAreaId}
            onChange={(e) => setForm({ ...form, thrustAreaId: e.target.value })}
            required
          >
            <option value="">Select…</option>
            {thrustAreas.map((ta) => (
              <option key={ta.id} value={ta.id}>
                {ta.name}
              </option>
            ))}
          </select>
        </div>

        {/* UoM */}
        <div>
          <label className="mb-1 block text-xs font-medium">
            Unit of Measurement <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.uom}
            onChange={(e) => setForm({ ...form, uom: e.target.value as UoM })}
          >
            {(Object.keys(UOM_LABELS) as UoM[]).map((u) => (
              <option key={u} value={u}>
                {UOM_LABELS[u]}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            required
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
            required
          />
        </div>

        {/* Target */}
        <div>
          <label className="mb-1 block text-xs font-medium">
            Target <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            required
          />
        </div>

        {/* Weightage */}
        <div>
          <label className="mb-1 block text-xs font-medium">
            Weightage (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={form.weightage}
            onChange={(e) => setForm({ ...form, weightage: e.target.value })}
            min={10}
            max={100}
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Adding…" : "Add Goal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
            setForm(BLANK_GOAL);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────

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

function GoalSheetContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [sheet, setSheet] = useState<GoalSheet | null>(null);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheet = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/goal-sheets/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load goal sheet");
        return;
      }
      const data = await res.json();
      setSheet(data.goalSheet);
    } catch {
      setError("Failed to load goal sheet");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSheet();
    fetch("/api/v1/thrust-areas")
      .then((r) => r.json())
      .then((data) => setThrustAreas(data.thrustAreas ?? []));
  }, [fetchSheet]);

  async function handleUpdateGoal(
    goalId: string,
    formData: Partial<GoalFormData>
  ) {
    const res = await fetch(`/api/v1/goal-sheets/${id}/goals/${goalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        weightage: formData.weightage
          ? parseInt(formData.weightage, 10)
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update goal");
    await fetchSheet();
  }

  async function handleDeleteGoal(goalId: string) {
    const res = await fetch(`/api/v1/goal-sheets/${id}/goals/${goalId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to delete goal");
    }
    await fetchSheet();
  }

  function handleGoalAdded() {
    fetchSheet();
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
        <Button variant="outline" onClick={() => router.push("/goals")}>
          ← Back to Goals
        </Button>
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error ?? "Goal sheet not found"}
        </div>
      </div>
    );
  }

  const isDraft = sheet.status === "DRAFT";
  const totalWeightage = sheet.goals.reduce((sum, g) => sum + g.weightage, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/goals")}
            className="mb-2 -ml-2"
          >
            ← Back
          </Button>
          <h1 className="text-2xl font-bold">{sheet.cycle.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sheet.employee.name} · {sheet.employee.email}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[sheet.status]}>
          {STATUS_LABELS[sheet.status]}
        </Badge>
      </div>

      {/* Rework comment */}
      {sheet.status === "RETURNED" && sheet.reworkComment && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <strong>Manager comment:</strong> {sheet.reworkComment}
        </div>
      )}

      {/* Weightage bar */}
      {sheet.goals.length > 0 && (
        <div className="rounded-md border bg-card p-4">
          <WeightageBar total={totalWeightage} />
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Goals ({sheet.goals.length}/8)
        </h2>

        {sheet.goals.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No goals yet. Add your first goal below.
          </div>
        ) : (
          sheet.goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              thrustAreas={thrustAreas}
              isDraft={isDraft}
              onUpdate={handleUpdateGoal}
              onDelete={handleDeleteGoal}
            />
          ))
        )}

        {/* Add goal form — only for DRAFT sheets with < 8 goals */}
        {isDraft && sheet.goals.length < 8 && (
          <AddGoalForm
            sheetId={id}
            thrustAreas={thrustAreas}
            onAdded={handleGoalAdded}
          />
        )}
      </div>

      {/* Draft save indicator */}
      {isDraft && (
        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          This sheet is saved as a <strong>Draft</strong>. Changes are saved
          automatically when you add or edit goals. Submit for approval when
          ready.
        </div>
      )}
    </div>
  );
}

export default function GoalSheetPage() {
  return (
    <RoleGuard allowedRoles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
      <GoalSheetContent />
    </RoleGuard>
  );
}
