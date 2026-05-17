/**
 * Tests for Task 9: Manager Approval Workflow
 *
 * Covers:
 *  - POST /api/v1/goal-sheets/:id/submit  → PENDING_APPROVAL
 *  - POST /api/v1/goal-sheets/:id/approve → APPROVED + lockDate set
 *  - POST /api/v1/goal-sheets/:id/return  → RETURNED + comment stored
 *  - POST /api/v1/goal-sheets/:id/unlock  → DRAFT + audit entry created
 */

import { NextRequest } from "next/server";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    goalSheet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

// ── Import route handlers ─────────────────────────────────────────────────────
import { POST as submitSheet } from "@/app/api/v1/goal-sheets/[id]/submit/route";
import { POST as approveSheet } from "@/app/api/v1/goal-sheets/[id]/approve/route";
import { POST as returnSheet } from "@/app/api/v1/goal-sheets/[id]/return/route";
import { POST as unlockSheet } from "@/app/api/v1/goal-sheets/[id]/unlock/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function adminSession() {
  return {
    user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
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

const validGoals = [
  { id: "g1", weightage: 60, title: "Goal 1" },
  { id: "g2", weightage: 40, title: "Goal 2" },
];

const draftSheet = {
  id: "sheet-1",
  employeeId: "emp-1",
  cycleId: "cycle-1",
  status: "DRAFT",
  lockDate: null,
  reworkComment: null,
  submittedAt: null,
  employee: { id: "emp-1", managerId: "mgr-1" },
  goals: validGoals,
};

const pendingSheet = {
  ...draftSheet,
  status: "PENDING_APPROVAL",
  submittedAt: new Date(),
};

const approvedSheet = {
  ...draftSheet,
  status: "APPROVED",
  lockDate: new Date(),
};

// ── POST /api/v1/goal-sheets/:id/submit ───────────────────────────────────────

describe("POST /api/v1/goal-sheets/:id/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(employeeSession("emp-1") as never);
  });

  it("changes status to PENDING_APPROVAL and records submittedAt", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);
    const updated = { ...pendingSheet, cycle: { id: "c1", name: "FY25", isActive: true }, goals: [] };
    (mockPrisma.goalSheet.update as jest.Mock).mockResolvedValue(updated);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/submit");
    const res = await submitSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("PENDING_APPROVAL");
    expect(mockPrisma.goalSheet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_APPROVAL",
          submittedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns 422 when weightage validation fails (total ≠ 100)", async () => {
    const invalidSheet = {
      ...draftSheet,
      goals: [{ id: "g1", weightage: 50, title: "Goal 1" }], // total = 50
    };
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(invalidSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/submit");
    const res = await submitSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/50%/);
    expect(mockPrisma.goalSheet.update).not.toHaveBeenCalled();
  });

  it("returns 403 when a different employee tries to submit", async () => {
    mockAuth.mockResolvedValue(employeeSession("emp-99") as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/submit");
    const res = await submitSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(403);
  });

  it("returns 422 when sheet is already APPROVED", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(approvedSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/submit");
    const res = await submitSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
  });
});

// ── POST /api/v1/goal-sheets/:id/approve ─────────────────────────────────────

describe("POST /api/v1/goal-sheets/:id/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(managerSession("mgr-1") as never);
  });

  it("changes status to APPROVED and sets lockDate", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(pendingSheet);
    const updated = {
      ...approvedSheet,
      cycle: { id: "c1", name: "FY25", isActive: true },
      goals: [],
    };
    (mockPrisma.goalSheet.update as jest.Mock).mockResolvedValue(updated);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/approve");
    const res = await approveSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("APPROVED");
    expect(mockPrisma.goalSheet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          lockDate: expect.any(Date),
        }),
      })
    );
  });

  it("returns 403 when manager does not own the employee", async () => {
    mockAuth.mockResolvedValue(managerSession("mgr-99") as never);
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(pendingSheet); // employee.managerId = mgr-1

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/approve");
    const res = await approveSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(403);
    expect(mockPrisma.goalSheet.update).not.toHaveBeenCalled();
  });

  it("returns 422 when sheet is not PENDING_APPROVAL", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/approve");
    const res = await approveSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/approve");
    const res = await approveSheet(req, { params: { id: "sheet-1" } });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/goal-sheets/:id/return ──────────────────────────────────────

describe("POST /api/v1/goal-sheets/:id/return", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(managerSession("mgr-1") as never);
  });

  it("changes status to RETURNED and stores the rework comment", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(pendingSheet);
    const updated = {
      ...draftSheet,
      status: "RETURNED",
      reworkComment: "Please revise goal 2",
      cycle: { id: "c1", name: "FY25", isActive: true },
      goals: [],
    };
    (mockPrisma.goalSheet.update as jest.Mock).mockResolvedValue(updated);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/return", {
      comment: "Please revise goal 2",
    });
    const res = await returnSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("RETURNED");
    expect(mockPrisma.goalSheet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETURNED",
          reworkComment: "Please revise goal 2",
        }),
      })
    );
  });

  it("returns 400 when comment is missing", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(pendingSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/return", {});
    const res = await returnSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(400);
    expect(mockPrisma.goalSheet.update).not.toHaveBeenCalled();
  });

  it("returns 422 when sheet is not PENDING_APPROVAL", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/return", {
      comment: "Needs work",
    });
    const res = await returnSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
  });
});

// ── POST /api/v1/goal-sheets/:id/unlock ──────────────────────────────────────

describe("POST /api/v1/goal-sheets/:id/unlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("changes status to DRAFT, clears lockDate, and creates audit entries", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(approvedSheet);

    const unlockedSheet = {
      ...draftSheet,
      cycle: { id: "c1", name: "FY25", isActive: true },
      goals: [],
    };

    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (ops: unknown[]) => {
        // Return results for each operation in the transaction
        return [unlockedSheet, { count: 2 }];
      }
    );

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/unlock", {
      reason: "Employee requested correction",
    });
    const res = await unlockSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalSheet.status).toBe("DRAFT");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns 422 when sheet is not APPROVED", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(draftSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/unlock", {
      reason: "Test",
    });
    const res = await unlockSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(422);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is missing", async () => {
    (mockPrisma.goalSheet.findUnique as jest.Mock).mockResolvedValue(approvedSheet);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/unlock", {});
    const res = await unlockSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(400);
  });

  it("returns 403 when called by a Manager (Admin only)", async () => {
    mockAuth.mockResolvedValue(managerSession() as never);

    const req = makeRequest("POST", "/api/v1/goal-sheets/sheet-1/unlock", {
      reason: "Test",
    });
    const res = await unlockSheet(req, { params: { id: "sheet-1" } });

    expect(res.status).toBe(403);
  });
});
