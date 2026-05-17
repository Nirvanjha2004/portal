"use client";

/**
 * Admin Thrust Area Management page.
 *
 * Features:
 *  - List all thrust areas with goal counts
 *  - Create a new thrust area
 *  - Delete a thrust area (blocked if any Goal references it — shows 409 error)
 */

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThrustArea {
  id: string;
  name: string;
  _count: { goals: number };
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateThrustAreaForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/thrust-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create thrust area");
      } else {
        setName("");
        onCreated();
      }
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex items-center gap-2"
      aria-label="Create thrust area"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New thrust area name"
        className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Thrust area name"
      />
      <Button
        type="submit"
        size="sm"
        disabled={creating || !name.trim()}
      >
        {creating ? "Adding…" : "Add Thrust Area"}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

// ─── Thrust Area Row ──────────────────────────────────────────────────────────

function ThrustAreaRow({
  area,
  onDeleted,
}: {
  area: ThrustArea;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete thrust area "${area.name}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/thrust-areas/${area.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete thrust area");
      } else {
        onDeleted();
      }
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">{area.name}</td>
      <td className="px-4 py-3">
        {area._count.goals > 0 ? (
          <Badge variant="secondary">{area._count.goals} goal{area._count.goals !== 1 ? "s" : ""}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No goals</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {error && (
            <span
              className="max-w-[240px] truncate text-xs text-destructive"
              title={error}
              role="alert"
            >
              {error}
            </span>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={`Delete thrust area ${area.name}`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Thrust Area List ─────────────────────────────────────────────────────────

function ThrustAreaList({
  areas,
  onDeleted,
}: {
  areas: ThrustArea[];
  onDeleted: () => void;
}) {
  if (areas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No thrust areas yet. Add one above.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Goals</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <ThrustAreaRow key={area.id} area={area} onDeleted={onDeleted} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function ThrustAreasPageContent() {
  const [areas, setAreas] = useState<ThrustArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/thrust-areas");
      if (!res.ok) {
        setError("Failed to load thrust areas");
        return;
      }
      const data = await res.json();
      setAreas(data.thrustAreas ?? []);
    } catch {
      setError("Network error while loading thrust areas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

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
          onClick={fetchAreas}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <CreateThrustAreaForm onCreated={fetchAreas} />
      <ThrustAreaList areas={areas} onDeleted={fetchAreas} />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminThrustAreasPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Thrust Areas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage strategic focus areas used to categorise employee goals.
          </p>
        </div>
        <ThrustAreasPageContent />
      </div>
    </RoleGuard>
  );
}
