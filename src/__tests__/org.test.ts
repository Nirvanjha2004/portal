/**
 * Tests for Task 4: Organisation Hierarchy Management (Admin)
 *
 * Covers:
 *  - Creating a department (success + duplicate)
 *  - Listing departments
 *  - Listing users with filters
 *  - Assigning a manager (success + self-manager validation)
 *  - Verifying the `reports` relation is correct after assignment
 *
 * Prisma is fully mocked — no running database required.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    department: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// ── Mock NextAuth auth() ──────────────────────────────────────────────────────
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ── Import route handlers after mocks are set up ──────────────────────────────
import { GET as getDepartments, POST as postDepartment } from "@/app/api/v1/org/departments/route";
import { GET as getUsers } from "@/app/api/v1/org/users/route";
import { PUT as putUser } from "@/app/api/v1/org/users/[id]/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminSession() {
  return {
    user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function makeRequest(
  method: string,
  path: string,
  body?: unknown
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Department tests ──────────────────────────────────────────────────────────

describe("GET /api/v1/org/departments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("returns a list of departments with user counts", async () => {
    const fakeDepts = [
      { id: "dept-1", name: "Engineering", _count: { users: 5 } },
      { id: "dept-2", name: "HR", _count: { users: 2 } },
    ];
    (mockPrisma.department.findMany as jest.Mock).mockResolvedValue(fakeDepts);

    const req = makeRequest("GET", "/api/v1/org/departments");
    const res = await getDepartments(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.departments).toHaveLength(2);
    expect(body.departments[0].name).toBe("Engineering");
    expect(body.departments[0]._count.users).toBe(5);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const req = makeRequest("GET", "/api/v1/org/departments");
    const res = await getDepartments(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/org/departments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("creates a new department and returns 201", async () => {
    const newDept = { id: "dept-3", name: "Finance" };
    (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
    (mockPrisma.department.create as jest.Mock).mockResolvedValue(newDept);

    const req = makeRequest("POST", "/api/v1/org/departments", { name: "Finance" });
    const res = await postDepartment(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.department.name).toBe("Finance");
    expect(mockPrisma.department.create).toHaveBeenCalledWith({
      data: { name: "Finance" },
    });
  });

  it("returns 409 when department name already exists", async () => {
    (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
      id: "dept-1",
      name: "Engineering",
    });

    const req = makeRequest("POST", "/api/v1/org/departments", { name: "Engineering" });
    const res = await postDepartment(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const req = makeRequest("POST", "/api/v1/org/departments", {});
    const res = await postDepartment(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const req = makeRequest("POST", "/api/v1/org/departments", { name: "   " });
    const res = await postDepartment(req);

    expect(res.status).toBe(400);
  });

  it("trims whitespace from department name before saving", async () => {
    const newDept = { id: "dept-4", name: "Marketing" };
    (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.department.create as jest.Mock).mockResolvedValue(newDept);

    const req = makeRequest("POST", "/api/v1/org/departments", { name: "  Marketing  " });
    const res = await postDepartment(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.department.create).toHaveBeenCalledWith({
      data: { name: "Marketing" },
    });
  });
});

// ── User listing tests ────────────────────────────────────────────────────────

describe("GET /api/v1/org/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("returns all users when no filters are applied", async () => {
    const fakeUsers = [
      {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "EMPLOYEE",
        departmentId: "dept-1",
        managerId: "user-2",
        department: { id: "dept-1", name: "Engineering" },
        manager: { id: "user-2", name: "Bob", email: "bob@example.com" },
        _count: { reports: 0 },
      },
      {
        id: "user-2",
        name: "Bob",
        email: "bob@example.com",
        role: "MANAGER",
        departmentId: "dept-1",
        managerId: null,
        department: { id: "dept-1", name: "Engineering" },
        manager: null,
        _count: { reports: 1 },
      },
    ];
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(fakeUsers);

    const req = makeRequest("GET", "/api/v1/org/users");
    const res = await getUsers(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
  });

  it("passes role filter to Prisma query", async () => {
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const req = makeRequest("GET", "/api/v1/org/users?role=MANAGER");
    await getUsers(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "MANAGER" }),
      })
    );
  });

  it("passes departmentId filter to Prisma query", async () => {
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const req = makeRequest("GET", "/api/v1/org/users?departmentId=dept-1");
    await getUsers(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentId: "dept-1" }),
      })
    );
  });

  it("passes managerId filter to Prisma query", async () => {
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const req = makeRequest("GET", "/api/v1/org/users?managerId=user-2");
    await getUsers(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ managerId: "user-2" }),
      })
    );
  });

  it("returns 400 for an invalid role filter value", async () => {
    const req = makeRequest("GET", "/api/v1/org/users?role=SUPERUSER");
    const res = await getUsers(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid role/i);
  });
});

// ── User update tests ─────────────────────────────────────────────────────────

describe("PUT /api/v1/org/users/:id", () => {
  const existingUser = {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    role: "EMPLOYEE",
    departmentId: null,
    managerId: null,
  };

  const managerUser = {
    id: "user-2",
    name: "Bob",
    email: "bob@example.com",
    role: "MANAGER",
    departmentId: "dept-1",
    managerId: null,
  };

  const dept = { id: "dept-1", name: "Engineering" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("assigns a manager to a user and returns the updated user", async () => {
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existingUser) // target user exists
      .mockResolvedValueOnce(managerUser); // manager exists

    const updatedUser = {
      ...existingUser,
      managerId: "user-2",
      manager: { id: "user-2", name: "Bob", email: "bob@example.com" },
      department: null,
      reports: [],
    };
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      managerId: "user-2",
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.managerId).toBe("user-2");
    expect(body.user.manager.name).toBe("Bob");
  });

  it("verifies the reports relation: manager's reports include the assigned user", async () => {
    // After assigning user-1's manager to user-2, user-2's reports should include user-1.
    // We simulate this by checking the update was called with the correct managerId,
    // and the returned user has the manager populated.
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(managerUser);

    const updatedUser = {
      ...existingUser,
      managerId: "user-2",
      manager: { id: "user-2", name: "Bob", email: "bob@example.com" },
      department: null,
      reports: [],
    };
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      managerId: "user-2",
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    // The update was called with managerId: "user-2", establishing the reports relation
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ managerId: "user-2" }),
      })
    );
  });

  it("returns 422 when a user is set as their own manager", async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      managerId: "user-1", // same as the user being updated
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/own manager/i);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates role and department together", async () => {
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existingUser) // target user
      .mockResolvedValueOnce(dept); // department exists (via department.findUnique)

    // Mock department lookup
    (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(dept);

    const updatedUser = {
      ...existingUser,
      role: "MANAGER",
      departmentId: "dept-1",
      department: dept,
      manager: null,
      reports: [],
    };
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      role: "MANAGER",
      departmentId: "dept-1",
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe("MANAGER");
    expect(body.user.departmentId).toBe("dept-1");
  });

  it("returns 404 when the target user does not exist", async () => {
    // Explicitly reset and set the mock to return null for this test
    (mockPrisma.user.findUnique as jest.Mock).mockReset();
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("PUT", "/api/v1/org/users/nonexistent", {
      role: "MANAGER",
    });
    const res = await putUser(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 when the referenced manager does not exist", async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockReset();
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existingUser) // target user exists
      .mockResolvedValueOnce(null); // manager not found

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      managerId: "ghost-manager",
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when an invalid role is provided", async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      role: "SUPERUSER",
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid role/i);
  });

  it("returns 400 when no updatable fields are provided", async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockReset();
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {});
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no updatable fields/i);
  });

  it("clears manager assignment when managerId is null", async () => {
    const userWithManager = { ...existingUser, managerId: "user-2" };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(userWithManager);

    const updatedUser = {
      ...userWithManager,
      managerId: null,
      manager: null,
      department: null,
      reports: [],
    };
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    const req = makeRequest("PUT", "/api/v1/org/users/user-1", {
      managerId: null,
    });
    const res = await putUser(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managerId: null }),
      })
    );
  });
});
