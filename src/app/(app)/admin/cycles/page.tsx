"use client";

/**
 * Admin Performance Cycle Management page.
 *
 * Features:
 *  - List all performance cycles with status badges
 *  - Create a new cycle (name, startDate, endDate, optional activate)
 *  - Activate / deactivate a cycle (only one can be active at a time)
 *  - Expand a cycle to view and edit its 5 check-in windows
 */

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Quarter = "GOAL_SETTING" | "Q1" | "Q2" | "Q3" | "Q4";

interface CheckInWindow {
  id: string;
  cycleId: string;
  quarter: Quarter;
  opensAt: string;
  closesAt: string;
}

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  windows: CheckInWindow[];
  _count: { goalSheets: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUARTER_LABELS: Record<Quarter, string> = {
  GOAL_SETTING: "Goal Setting",
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

// ─── Window Editor ────────────────────────────────────────────────────────────

function WindowEditor({
  cycleId,
  windows,
  onUpdated,
}: {
  cycleId: string;
  windows: CheckInWindow[];
  onUpdated: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(w: CheckInWindow) {
    setEditingId(w.id);
    setOpensAt(toInputDate(w.opensAt));
    setClosesAt(toInputDate(w.closesAt));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveWindow(windowId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/cycles/${cycleId}/windows/${windowId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opensAt: new Date(opensAt).toISOString(),
            closesAt: new Date(closesAt + "T23:59:59.999Z").toISOString(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update window");
      } else {
        setEditingId(null);
        onUpdated();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Window</th>
            <th className="px-4 py-2 text-left font-medium">Opens</th>
            <th className="px-4 py-2 text-left font-medium">Closes</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => {
            const isEditing = editingId === w.id;
            return (
              <tr key={w.id} className="border-t">
                <td className="px-4 py-2 font-medium">
                  {QUARTER_LABELS[w.quarter]}
                </td>
                {isEditing ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={opensAt}
                        onChange={(e) => setOpensAt(e.target.value)}
                        className="h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`Opens at for ${QUARTER_LABELS[w.quarter]}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={closesAt}
                        onChange={(e) => setClosesAt(e.target.value)}
                        className="h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`Closes at for ${QUARTER_LABELS[w.quarter]}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {error && (
                          <span
                            className="max-w-[160px] truncate text-xs text-destructive"
                            title={error}
                          >
                            {error}
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => saveWindow(w.id)}
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(w.opensAt)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(w.closesAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(w)}
                        aria-label={`Edit ${QUARTER_LABELS[w.quarter]} window`}
                      >
                        Edit
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Cycle Row ────────────────────────────────────────────────────────────────

function CycleRow({
  cycle,
  onUpdated,
}: {
  cycle: Cycle;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/cycles/${cycle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cycle.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update cycle");
      } else {
        onUpdated();
      }
    } catch {
      setError("Network error");
    } finally {
      setActivating(false);
    }
  }

  return (
    <>
      <tr className="border-t hover:bg-muted/30">
        <td className="px-4 py-3">
          <div className="font-medium">{cycle.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </div>
        </td>
        <td className="px-4 py-3">
          {cycle.isActive ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="outline">Inactive</Badge>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {cycle._count.goalSheets}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {error && (
              <span
                className="max-w-[160px] truncate text-xs text-destructive"
                title={error}
              >
                {error}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} windows for ${cycle.name}`}
            >
              {expanded ? "Hide Windows" : "Windows"}
            </Button>
            <Button
              variant={cycle.isActive ? "outline" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={activating}
              aria-label={cycle.isActive ? "Deactivate cycle" : "Activate cycle"}
            >
              {activating
                ? "Updating…"
                : cycle.isActive
                ? "Deactivate"
                : "Activate"}
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/5">
          <td colSpan={4} className="px-4 pb-4 pt-2">
            <WindowEditor
              cycleId={cycle.id}
              windows={cycle.windows}
              onUpdated={onUpdated}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Create Cycle Form ────────────────────────────────────────────────────────

function CreateCycleForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create cycle");
      } else {
        setName("");
        setStartDate("");
        setEndDate("");
        setIsActive(false);
        setOpen(false);
        onCreated();
      }
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="mb-6">
        + New Cycle
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border bg-card p-4 shadow-sm"
      aria-label="Create performance cycle"
    >
      <h2 className="mb-4 text-base font-semibold">New Performance Cycle</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label
            htmlFor="cycle-name"
            className="mb-1 block text-sm font-medium"
          >
            Cycle Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="cycle-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. FY 2025–26"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Start Date */}
        <div>
          <label
            htmlFor="cycle-start"
            className="mb-1 block text-sm font-medium"
          >
            Start Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="cycle-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* End Date */}
        <div>
          <label
            htmlFor="cycle-end"
            className="mb-1 block text-sm font-medium"
          >
            End Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="cycle-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Activate immediately */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="cycle-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="cycle-active" className="text-sm">
            Activate immediately (deactivates any current active cycle)
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="submit"
          disabled={creating || !name.trim() || !startDate || !endDate}
        >
          {creating ? "Creating…" : "Create Cycle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={creating}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Cycle List ───────────────────────────────────────────────────────────────

function CycleList({
  cycles,
  onUpdated,
}: {
  cycles: Cycle[];
  onUpdated: () => void;
}) {
  if (cycles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No performance cycles yet. Create one above.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Cycle</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Goal Sheets</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((cycle) => (
            <CycleRow key={cycle.id} cycle={cycle} onUpdated={onUpdated} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function CyclesPageContent() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/cycles");
      if (!res.ok) {
        setError("Failed to load cycles");
        return;
      }
      const data = await res.json();
      setCycles(data.cycles ?? []);
    } catch {
      setError("Network error while loading cycles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
        <Button
          variant="outline"
          size="sm"
          className="ml-4"
          onClick={fetchCycles}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <CreateCycleForm onCreated={fetchCycles} />
      <CycleList cycles={cycles} onUpdated={fetchCycles} />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCyclesPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Performance Cycles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage performance cycles and check-in window schedules.
          </p>
        </div>
        <CyclesPageContent />
      </div>
    </RoleGuard>
  );
}
