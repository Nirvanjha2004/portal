"use client";

/**
 * Admin Organisation Hierarchy Management page.
 *
 * Features:
 *  - Department list with user counts; create new department
 *  - User table with inline role / manager / department editing
 *  - Validation: user cannot be set as their own manager
 */

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

interface Department {
  id: string;
  name: string;
  _count: { users: number };
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  managerId: string | null;
  department: { id: string; name: string } | null;
  manager: UserSummary | null;
  _count: { reports: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BADGE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  EMPLOYEE: "outline",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepartmentSection({
  departments,
  onCreated,
}: {
  departments: Department[];
  onCreated: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/org/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create department");
      } else {
        setNewName("");
        onCreated();
      }
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold">Departments</h2>

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="New department name"
        />
        <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
          {creating ? "Creating…" : "Add Department"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </form>

      {/* Department list */}
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-right font-medium">Users</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="border-t">
                  <td className="px-4 py-2">{dept.name}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {dept._count.users}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Inline edit row ──────────────────────────────────────────────────────────

function UserRow({
  user,
  allUsers,
  departments,
  onUpdated,
}: {
  user: OrgUser;
  allUsers: OrgUser[];
  departments: Department[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [departmentId, setDepartmentId] = useState<string>(
    user.departmentId ?? ""
  );
  const [managerId, setManagerId] = useState<string>(user.managerId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Potential managers: all users except the user themselves
  const potentialManagers = allUsers.filter((u) => u.id !== user.id);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/org/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          departmentId: departmentId || null,
          managerId: managerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update user");
      } else {
        setEditing(false);
        onUpdated();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setRole(user.role);
    setDepartmentId(user.departmentId ?? "");
    setManagerId(user.managerId ?? "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className="border-t hover:bg-muted/30">
        <td className="px-4 py-2">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </td>
        <td className="px-4 py-2">
          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{user.role}</Badge>
        </td>
        <td className="px-4 py-2 text-sm">
          {user.department?.name ?? <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-2 text-sm">
          {user.manager?.name ?? <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-2 text-right text-sm text-muted-foreground">
          {user._count.reports}
        </td>
        <td className="px-4 py-2 text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${user.name}`}
          >
            Edit
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-muted/10">
      <td className="px-4 py-2">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </td>

      {/* Role select */}
      <td className="px-4 py-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Role"
        >
          <option value="EMPLOYEE">EMPLOYEE</option>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </td>

      {/* Department select */}
      <td className="px-4 py-2">
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Department"
        >
          <option value="">— None —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </td>

      {/* Manager select */}
      <td className="px-4 py-2">
        <select
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          className="h-7 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Manager"
        >
          <option value="">— None —</option>
          {potentialManagers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-2 text-right text-sm text-muted-foreground">
        {user._count.reports}
      </td>

      {/* Actions */}
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          {error && (
            <span className="max-w-[160px] truncate text-xs text-destructive" title={error}>
              {error}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────────

function UserTable({
  users,
  departments,
  onUpdated,
}: {
  users: OrgUser[];
  departments: Department[];
  onUpdated: () => void;
}) {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (deptFilter && u.departmentId !== deptFilter) return false;
    return true;
  });

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Users</h2>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="EMPLOYEE">EMPLOYEE</option>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {(roleFilter || deptFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRoleFilter("");
              setDeptFilter("");
            }}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users match the current filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">User</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Department</th>
                <th className="px-4 py-2 text-left font-medium">Manager</th>
                <th className="px-4 py-2 text-right font-medium">Reports</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  allUsers={users}
                  departments={departments}
                  onUpdated={onUpdated}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function OrgPageContent() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, usersRes] = await Promise.all([
        fetch("/api/v1/org/departments"),
        fetch("/api/v1/org/users"),
      ]);

      if (!deptRes.ok || !usersRes.ok) {
        setError("Failed to load organisation data");
        return;
      }

      const [deptData, usersData] = await Promise.all([
        deptRes.json(),
        usersRes.json(),
      ]);

      setDepartments(deptData.departments ?? []);
      setUsers(usersData.users ?? []);
    } catch {
      setError("Network error while loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
        <Button variant="outline" size="sm" className="ml-4" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <DepartmentSection departments={departments} onCreated={fetchData} />
      <UserTable users={users} departments={departments} onUpdated={fetchData} />
    </>
  );
}

export default function AdminOrgPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Organisation Hierarchy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage departments, user roles, and reporting lines.
          </p>
        </div>
        <OrgPageContent />
      </div>
    </RoleGuard>
  );
}
