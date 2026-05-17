/**
 * Tests for Task 6: Thrust Area Management (Admin)
 *
 * Covers:
 *  - GET /api/v1/thrust-areas  — accessible to all authenticated roles
 *  - POST /api/v1/thrust-areas — Admin only; creates a thrust area
 *  - DELETE /api/v1/thrust-areas/:id — Admin only; returns 409 if referenced by a Goal
 *
 * Prisma is fully mocked — no running database required.
 */

import { NextRequest } from "next/server";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    thrustArea: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    goal: {
      count: jest.fn(),
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

// ── Import route handlers after mocks ────────────────────────────────────────
import {
  GET as getThrustAreas,
  POST as postThrustArea,
} from "@/app/api/v1/thrust-areas/route";
import { DELETE as deleteThrustArea } from "@/app/api/v1/thrust-areas/[id]/route";

// ── Session helpers ───────────────────────────────────────────────────────────

function adminSession() {
  return {
    user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function employeeSession() {
  return {
    user: { id: "emp-1", email: "emp@example.com", name: "Employee", role: "EMPLOYEE" },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function managerSession() {
  return {
    user: { id: "mgr-1", email: "mgr@example.com", name: "Manager", role: "MANAGER" },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function makeRequest(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeArea1 = {
  id: "area-1",
  name: "Customer Focus",
  _count: { goals: 3 },
};

const fakeArea2 = {
  id: "area-2",
  name: "Innovation",
  _count: { goals: 0 },
};

// ── GET /api/v1/thrust-areas ──────────────────────────────────────────────────

describe("GET /api/v1/thrust-areas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a list of thrust areas for an Admin", async () => {
    mockAuth.mockResolvedValue(adminSession() as never);
    (mockPrisma.thrustArea.findMany as jest.Mock).mockResolvedValue([
      fakeArea1,
      fakeArea2,
    ]);

    const req = makeRequest("GET", "/api/v1/thrust-areas");
    const res = await getThrustAreas(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thrustAreas).toHaveLength(2);
    expect(body.thrustAreas[0].name).toBe("Customer Focus");
  });

  it("returns a list of thrust areas for an Employee (all roles can access)", async () => {
    mockAuth.mockResolvedValue(employeeSession() as never);
    (mockPrisma.thrustArea.findMany as jest.Mock).mockResolvedValue([fakeArea1]);

    const req = makeRequest("GET", "/api/v1/thrust-areas");
    const res = await getThrustAreas(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thrustAreas).toHaveLength(1);
  });

  it("returns a list of thrust areas for a Manager", async () => {
    mockAuth.mockResolvedValue(managerSession() as never);
    (mockPrisma.thrustArea.findMany as jest.Mock).mockResolvedValue([
      fakeArea1,
      fakeArea2,
    ]);

    const req = makeRequest("GET", "/api/v1/thrust-areas");
    const res = await getThrustAreas(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thrustAreas).toHaveLength(2);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const req = makeRequest("GET", "/api/v1/thrust-areas");
    const res = await getThrustAreas(req);

    expect(res.status).toBe(401);
  });

  it("returns thrust areas ordered by name ascending", async () => {
    mockAuth.mockResolvedValue(adminSession() as never);
    (mockPrisma.thrustArea.findMany as jest.Mock).mockResolvedValue([
      fakeArea1,
      fakeArea2,
    ]);

    const req = makeRequest("GET", "/api/v1/thrust-areas");
    await getThrustAreas(req);

    expect(mockPrisma.thrustArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
      })
    );
  });
});

// ── POST /api/v1/thrust-areas ─────────────────────────────────────────────────

describe("POST /api/v1/thrust-areas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("creates a new thrust area and returns 201", async () => {
    const newArea = { id: "area-3", name: "Digital Transformation" };
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
    (mockPrisma.thrustArea.create as jest.Mock).mockResolvedValue(newArea);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "Digital Transformation",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.thrustArea.name).toBe("Digital Transformation");
    expect(mockPrisma.thrustArea.create).toHaveBeenCalledWith({
      data: { name: "Digital Transformation" },
    });
  });

  it("trims whitespace from the name before saving", async () => {
    const newArea = { id: "area-4", name: "Operational Excellence" };
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.thrustArea.create as jest.Mock).mockResolvedValue(newArea);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "  Operational Excellence  ",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.thrustArea.create).toHaveBeenCalledWith({
      data: { name: "Operational Excellence" },
    });
  });

  it("returns 409 when a thrust area with the same name already exists", async () => {
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(fakeArea1);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "Customer Focus",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
    expect(mockPrisma.thrustArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const req = makeRequest("POST", "/api/v1/thrust-areas", {});
    const res = await postThrustArea(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const req = makeRequest("POST", "/api/v1/thrust-areas", { name: "   " });
    const res = await postThrustArea(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "New Area",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an Employee", async () => {
    mockAuth.mockResolvedValueOnce(employeeSession() as never);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "New Area",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(403);
    expect(mockPrisma.thrustArea.create).not.toHaveBeenCalled();
  });

  it("returns 403 when called by a Manager", async () => {
    mockAuth.mockResolvedValueOnce(managerSession() as never);

    const req = makeRequest("POST", "/api/v1/thrust-areas", {
      name: "New Area",
    });
    const res = await postThrustArea(req);

    expect(res.status).toBe(403);
    expect(mockPrisma.thrustArea.create).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/v1/thrust-areas/:id ──────────────────────────────────────────

describe("DELETE /api/v1/thrust-areas/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("deletes an unreferenced thrust area and returns 200", async () => {
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(fakeArea2); // Innovation, 0 goals
    (mockPrisma.goal.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.thrustArea.delete as jest.Mock).mockResolvedValue(fakeArea2);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/area-2");
    const res = await deleteThrustArea(req, { params: { id: "area-2" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.thrustArea.delete).toHaveBeenCalledWith({
      where: { id: "area-2" },
    });
  });

  it("returns 409 when the thrust area is referenced by at least one Goal", async () => {
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(fakeArea1); // Customer Focus, 3 goals
    (mockPrisma.goal.count as jest.Mock).mockResolvedValue(3);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/area-1");
    const res = await deleteThrustArea(req, { params: { id: "area-1" } });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot delete/i);
    expect(body.error).toMatch(/3 goals/i);
    expect(mockPrisma.thrustArea.delete).not.toHaveBeenCalled();
  });

  it("returns 409 with singular 'goal' when exactly 1 Goal references the area", async () => {
    const areaWithOneGoal = { id: "area-5", name: "People Development" };
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(areaWithOneGoal);
    (mockPrisma.goal.count as jest.Mock).mockResolvedValue(1);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/area-5");
    const res = await deleteThrustArea(req, { params: { id: "area-5" } });

    expect(res.status).toBe(409);
    const body = await res.json();
    // Should say "1 goal" (singular), not "1 goals"
    expect(body.error).toMatch(/1 goal(?!s)/);
    expect(mockPrisma.thrustArea.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the thrust area does not exist", async () => {
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/nonexistent");
    const res = await deleteThrustArea(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
    expect(mockPrisma.thrustArea.delete).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/area-1");
    const res = await deleteThrustArea(req, { params: { id: "area-1" } });

    expect(res.status).toBe(401);
    expect(mockPrisma.thrustArea.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when called by an Employee", async () => {
    mockAuth.mockResolvedValueOnce(employeeSession() as never);

    const req = makeRequest("DELETE", "/api/v1/thrust-areas/area-2");
    const res = await deleteThrustArea(req, { params: { id: "area-2" } });

    expect(res.status).toBe(403);
    expect(mockPrisma.thrustArea.delete).not.toHaveBeenCalled();
  });

  it("returns 400 when id param is missing", async () => {
    const req = makeRequest("DELETE", "/api/v1/thrust-areas/");
    const res = await deleteThrustArea(req, { params: {} });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });
});
