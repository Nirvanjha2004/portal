/**
 * Tests for Task 7: Goal Sheet CRUD (Employee)
 *
 * Covers:
 *  - POST /api/v1/goal-sheets — create DRAFT sheet, 409 on duplicate, 422 no active cycle
 *  - GET  /api/v1/goal-sheets — own sheets for Employee, team sheets for Manager
 *  - GET  /api/v1/goal-sheets/:id — ownership enforcement
 *  - PUT  /api/v1/goal-sheets/:id — blocked if not DRAFT
 *  - POST /api/v1/goal-sheets/:sheetId/goals — add goal, max 8 enforcement
 *  - PUT  /api/v1/goal-sheets/:sheetId/goals/:id — update goal, read-only guard
 *  - DELETE /api/v1/goal-sheets/:sheetId/goals/:id — remove goal
 *
 * Prisma is fully mocked — no running database required.
 */

import { NextRequest } from "next/server";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    goalSheet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    goal: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    performanceCycle: {
      findFirst: jest.fn(),
    },
    thrustArea: {
      findUnique: jest.fn(),
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
  GET as getGoalSheets,
  POST as postGoalSheet,
} from "@/app/api/v1/goal-sheets/route";
import {
  GET as getGoalSheet,
  PUT as putGoalSheet,
} from "@/app/api/v1/goal-sheets/[id]/route";
import { POST as postGoal } from "@/app/api/v1/goal-sheets/[id]/goals/route";
import {
  PUT as putGoal,
  DELETE as deleteGoal,
} from "@/app/api/v1/goal-sheets/[id]/goals/[goalId]/route";

// ── Session helpers ───────────────────────────────────────────────────────────

function employeeSession(id = "emp-1") {
  return {
    user: { id, email: "emp@example.com", name: "Employee", role: "EMPLOYEE" },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function managerSession(id = "mgr-1") {
  return {
    user: { id, email: "mgr@example.com", name: "Manager", role: "MANAGER" },
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

const activeCycle = {
  id: "cycle-1",
  name: "FY 2025",
  isActive: true,
  startDate: new Date("2025-04-01"),
  endDate: new Date("2026-03-31"),
};

const thrustArea = { id: "ta-1", name: "Innovation" };

const draftSheet = {
  id: "sheet-1",
  employeeId: "emp-1",
  cycleId: "cycle-1",
  status: "DRAFT",
  lockDate: null,
  reworkComment: null,
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  employee: { id: "emp-1", name: "Employee", email: "emp@example.com", managerId: "mgr-1" },
  cycle: { id: "cycle-1", name: "FY 2025", isActive: true },
  goals: [],
  _count: { goals: 0 },
};

const sampleGoal = {
  id: "goal-1",
  goalSheetId: "sheet-1",
  thrustAreaId: "ta-1",
  title: "Increase test coverage",
  description: "Raise unit test coverage to 80%",
  uom: "PERCENTAGE_MIN",
  target: "80",
  weightage: 100,
  isShared: false,
  isReadOnly: false,
  sharedGoalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  thrustArea,
};

// ── POST /api/v1/goal-sheets ──────────────────────────────────────────────────

describe("POST /api/v1/goal-sheets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession() as never);
  });

  it("creates a DRAFT goal sheet and returns 201", async () => {
    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue(activeCycle);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.goalSheet.create as jest.Mock).mockResolvedValue({
      ...draftSheet,
      goals: [],
    });

    const req = makeRequest("POST", "/api/v1/goal-sheets");
    const res = await postGoalSheet(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("DRAFT");
    expect(body.goalSheet.employeeId).toBe("emp-1");
  });

  it("returns 409 when a sheet already exists for this employee in the active cycle", async () => {
    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue(activeCycle);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets");
    const res = await postGoalSheet(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.goalSheetId).toBe("sheet-1");
    expect(mockPrisma.goalSheet.create).not.toHaveBeenCalled();
  });

  it("returns 422 when there is no active performance cycle", async () => {
    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("POST", "/api/v1/goal-sheets");
    const res = await postGoalSheet(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no active performance cycle/i);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const req = makeRequest("POST", "/api/v1/goal-sheets");
    const res = await postGoalSheet(req);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/goal-sheets ───────────────────────────────────────────────────

describe("GET /api/v1/goal-sheets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns own sheets for an Employee", async () => {
    mockAuth.mockResolvedValue(employeeSession() as never);
    (mockPrisma.goalSheet.findMany as jest.Mock).mockResolvedValue([draftSheet]);

    const req = makeRequest("GET", "/api/v1/goal-sheets");
    const res = await getGoalSheets(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheets).toHaveLength(1);
    expect(body.goalSheets[0].id).toBe("sheet-1");
  });

  it("returns team sheets for a Manager", async () => {
    mockAuth.mockResolvedValue(managerSession() as never);
    const teamSheet = { ...draftSheet, id: "sheet-2", employeeId: "emp-2" };
    // Manager gets two calls: team sheets + own sheets
    (mockPrisma.goalSheet.findMany as jest.Mock)
      .mockResolvedValueOnce([teamSheet])
      .mockResolvedValueOnce([]);

    const req = makeRequest("GET", "/api/v1/goal-sheets");
    const res = await getGoalSheets(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheets.length).toBeGreaterThanOrEqual(1);
  });
});

// ── GET /api/v1/goal-sheets/:id ───────────────────────────────────────────────

describe("GET /api/v1/goal-sheets/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the sheet for the owning employee", async () => {
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("GET", "/api/v1/goal-sheets/sheet-1");
    const res = await getGoalSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.id).toBe("sheet-1");
  });

  it("returns 403 when an Employee tries to access another employee's sheet", async () => {
    mockAuth.mockResolvedValue(employeeSession("emp-99") as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet); // owned by emp-1

    const req = makeRequest("GET", "/api/v1/goal-sheets/sheet-1");
    const res = await getGoalSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(403);
  });

  it("returns the sheet for the manager of the employee", async () => {
    mockAuth.mockResolvedValue(managerSession("mgr-1") as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet); // employee.managerId = mgr-1

    const req = makeRequest("GET", "/api/v1/goal-sheets/sheet-1");
    const res = await getGoalSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
  });

  it("returns 404 when sheet does not exist", async () => {
    mockAuth.mockResolvedValue(employeeSession() as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("GET", "/api/v1/goal-sheets/nonexistent");
    const res = await getGoalSheet(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/v1/goal-sheets/:id ───────────────────────────────────────────────

describe("PUT /api/v1/goal-sheets/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
  });

  it("updates a DRAFT sheet and status remains DRAFT", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    const updated = { ...draftSheet, reworkComment: "Updated comment" };
    (mockPrisma.goalSheet.update as jest.Mock).mockResolvedValue(updated);

    const req = makeRequest("PUT", "/api/v1/goal-sheets/sheet-1", {
      reworkComment: "Updated comment",
    });
    const res = await putGoalSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("DRAFT");
  });

  it("returns 422 when trying to update a non-DRAFT sheet", async () => {
    const approvedSheet = { ...draftSheet, status: "APPROVED" };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(approvedSheet);

    const req = makeRequest("PUT", "/api/v1/goal-sheets/sheet-1", {
      reworkComment: "test",
    });
    const res = await putGoalSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
    expect(mockPrisma.goalSheet.update).not.toHaveBeenCalled();
  });
});

// ── POST /api/v1/goal-sheets/:sheetId/goals ───────────────────────────────────

describe("POST /api/v1/goal-sheets/:sheetId/goals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
  });

  it("adds a goal to a DRAFT sheet and returns 201", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    (mockPrisma.thrustArea.findUnique as jest.Mock).mockResolvedValue(thrustArea);
    (mockPrisma.goal.create as jest.Mock).mockResolvedValue(sampleGoal);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/goals", {
      thrustAreaId: "ta-1",
      title: "Increase test coverage",
      description: "Raise unit test coverage to 80%",
      uom: "PERCENTAGE_MIN",
      target: "80",
      weightage: 100,
    });
    const res = await postGoal(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goal.title).toBe("Increase test coverage");
    expect(body.goal.weightage).toBe(100);
  });

  it("returns 422 when sheet already has 8 goals", async () => {
    const fullSheet = {
      ...draftSheet,
      goals: Array(8).fill(sampleGoal),
    };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(fullSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/goals", {
      thrustAreaId: "ta-1",
      title: "9th goal",
      description: "Should be rejected",
      uom: "NUMERIC_MIN",
      target: "10",
      weightage: 10,
    });
    const res = await postGoal(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/maximum of 8/i);
    expect(mockPrisma.goal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when weightage is below 10", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/goals", {
      thrustAreaId: "ta-1",
      title: "Low weight goal",
      description: "desc",
      uom: "NUMERIC_MIN",
      target: "10",
      weightage: 5,
    });
    const res = await postGoal(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 10/i);
  });

  it("returns 422 when sheet is not DRAFT", async () => {
    const approvedSheet = { ...draftSheet, status: "APPROVED", goals: [] };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(approvedSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/goals", {
      thrustAreaId: "ta-1",
      title: "Goal",
      description: "desc",
      uom: "NUMERIC_MIN",
      target: "10",
      weightage: 100,
    });
    const res = await postGoal(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
  });
});

// ── PUT /api/v1/goal-sheets/:id/goals/:goalId ──────────────────────────────

describe("PUT /api/v1/goal-sheets/:sheetId/goals/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
  });

  it("updates a goal in a DRAFT sheet", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    (mockPrisma.goal.findFirst as jest.Mock).mockResolvedValue(sampleGoal);
    const updated = { ...sampleGoal, weightage: 50 };
    (mockPrisma.goal.update as jest.Mock).mockResolvedValue(updated);

    const req = makeRequest("PUT", "/api/v1/goal-sheets/sheet-1/goals/goal-1", {
      weightage: 50,
    });
    const res = await putGoal(req, {
      params: { id: "sheet-1", goalId: "goal-1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal.weightage).toBe(50);
  });

  it("returns 403 when trying to modify title of a read-only (shared) goal", async () => {
    const readOnlyGoal = { ...sampleGoal, isReadOnly: true };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    (mockPrisma.goal.findFirst as jest.Mock).mockResolvedValue(readOnlyGoal);

    const req = makeRequest("PUT", "/api/v1/goal-sheets/sheet-1/goals/goal-1", {
      title: "New title",
    });
    const res = await putGoal(req, {
      params: { id: "sheet-1", goalId: "goal-1" },
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.goal.update).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/v1/goal-sheets/:id/goals/:goalId ────────────────────────────

describe("DELETE /api/v1/goal-sheets/:sheetId/goals/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
  });

  it("removes a goal from a DRAFT sheet", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    (mockPrisma.goal.findFirst as jest.Mock).mockResolvedValue(sampleGoal);
    (mockPrisma.goal.delete as jest.Mock).mockResolvedValue(sampleGoal);

    const req = makeRequest("DELETE", "/api/v1/goal-sheets/sheet-1/goals/goal-1");
    const res = await deleteGoal(req, {
      params: { id: "sheet-1", goalId: "goal-1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.goal.delete).toHaveBeenCalledWith({
      where: { id: "goal-1" },
    });
  });

  it("returns 403 when employee tries to delete another employee's goal", async () => {
    const otherSheet = {
      ...draftSheet,
      employeeId: "emp-99",
      employee: { id: "emp-99", managerId: "mgr-99" },
    };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(otherSheet);

    const req = makeRequest("DELETE", "/api/v1/goal-sheets/sheet-1/goals/goal-1");
    const res = await deleteGoal(req, {
      params: { id: "sheet-1", goalId: "goal-1" },
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.goal.delete).not.toHaveBeenCalled();
  });
});
