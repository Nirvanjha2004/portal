/**
 * Tests for Task 5: Performance Cycle & Check-in Window Management (Admin)
 *
 * Covers:
 *  - Creating a cycle generates 5 default CheckInWindow records
 *  - Activating a second cycle deactivates the first
 *  - GET /api/v1/cycles lists all cycles
 *  - PUT /api/v1/cycles/:id updates a cycle
 *  - GET /api/v1/cycles/:id/windows lists windows for a cycle
 *  - PUT /api/v1/cycles/:id/windows/:windowId updates window dates
 *  - getActiveWindow returns the correct window for a given date
 *
 * Prisma is fully mocked — no running database required.
 */

import { NextRequest } from "next/server";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    performanceCycle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    checkInWindow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
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

// ── Import route handlers after mocks ────────────────────────────────────────
import {
  GET as getCycles,
  POST as postCycle,
  buildDefaultWindows,
} from "@/app/api/v1/cycles/route";
import { GET as getCycle, PUT as putCycle } from "@/app/api/v1/cycles/[id]/route";
import { GET as getWindows } from "@/app/api/v1/cycles/[id]/windows/route";
import { PUT as putWindow } from "@/app/api/v1/cycles/[id]/windows/[windowId]/route";
import { getActiveWindow } from "@/lib/cycle-helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const fakeCycle1 = {
  id: "cycle-1",
  name: "FY 2025",
  startDate: new Date("2025-04-01"),
  endDate: new Date("2026-03-31"),
  isActive: true,
  createdAt: new Date("2025-01-01"),
  windows: [],
  _count: { goalSheets: 0 },
};

const fakeCycle2 = {
  id: "cycle-2",
  name: "FY 2026",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2027-03-31"),
  isActive: false,
  createdAt: new Date("2025-06-01"),
  windows: [],
  _count: { goalSheets: 0 },
};

// ── buildDefaultWindows unit tests ────────────────────────────────────────────

describe("buildDefaultWindows", () => {
  it("generates exactly 5 windows", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    expect(windows).toHaveLength(5);
  });

  it("generates windows for all 5 quarters", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const quarters = windows.map((w) => w.quarter);
    expect(quarters).toContain("GOAL_SETTING");
    expect(quarters).toContain("Q1");
    expect(quarters).toContain("Q2");
    expect(quarters).toContain("Q3");
    expect(quarters).toContain("Q4");
  });

  it("sets GOAL_SETTING window to Apr 1 – May 1 of the start year", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const gs = windows.find((w) => w.quarter === "GOAL_SETTING")!;
    expect(gs.opensAt.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(gs.opensAt.getUTCDate()).toBe(1);
    expect(gs.closesAt.getUTCMonth()).toBe(4); // May
    expect(gs.closesAt.getUTCDate()).toBe(1);
  });

  it("sets Q1 window to Jul 1 – Jul 31 of the start year", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const q1 = windows.find((w) => w.quarter === "Q1")!;
    expect(q1.opensAt.getUTCMonth()).toBe(6); // July
    expect(q1.opensAt.getUTCDate()).toBe(1);
    expect(q1.closesAt.getUTCMonth()).toBe(6);
    expect(q1.closesAt.getUTCDate()).toBe(31);
  });

  it("sets Q2 window to Oct 1 – Oct 31 of the start year", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const q2 = windows.find((w) => w.quarter === "Q2")!;
    expect(q2.opensAt.getUTCMonth()).toBe(9); // October
    expect(q2.opensAt.getUTCDate()).toBe(1);
    expect(q2.closesAt.getUTCMonth()).toBe(9);
    expect(q2.closesAt.getUTCDate()).toBe(31);
  });

  it("sets Q3 window to Jan 1 – Jan 31 of the NEXT year", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const q3 = windows.find((w) => w.quarter === "Q3")!;
    expect(q3.opensAt.getUTCFullYear()).toBe(2026);
    expect(q3.opensAt.getUTCMonth()).toBe(0); // January
    expect(q3.opensAt.getUTCDate()).toBe(1);
    expect(q3.closesAt.getUTCMonth()).toBe(0);
    expect(q3.closesAt.getUTCDate()).toBe(31);
  });

  it("sets Q4 window to Mar 1 – Apr 15 of the NEXT year", () => {
    const windows = buildDefaultWindows("cycle-1", new Date("2025-04-01"));
    const q4 = windows.find((w) => w.quarter === "Q4")!;
    expect(q4.opensAt.getUTCFullYear()).toBe(2026);
    expect(q4.opensAt.getUTCMonth()).toBe(2); // March
    expect(q4.opensAt.getUTCDate()).toBe(1);
    expect(q4.closesAt.getUTCMonth()).toBe(3); // April
    expect(q4.closesAt.getUTCDate()).toBe(15);
  });

  it("sets cycleId on all windows", () => {
    const windows = buildDefaultWindows("cycle-abc", new Date("2025-04-01"));
    expect(windows.every((w) => w.cycleId === "cycle-abc")).toBe(true);
  });
});

// ── POST /api/v1/cycles ───────────────────────────────────────────────────────

describe("POST /api/v1/cycles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("creates a cycle with 5 default windows and returns 201", async () => {
    const newCycle = {
      ...fakeCycle1,
      windows: buildDefaultWindows("cycle-1", new Date("2025-04-01")),
    };

    // $transaction mock: calls the callback with a tx object
    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        const tx = {
          performanceCycle: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue(fakeCycle1),
            findUnique: jest.fn().mockResolvedValue(newCycle),
          },
          checkInWindow: {
            createMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
        };
        return callback(tx as unknown as typeof mockPrisma);
      }
    );

    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2025",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });
    const res = await postCycle(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cycle).toBeDefined();
    expect(body.cycle.windows).toHaveLength(5);
  });

  it("deactivates existing active cycle when isActive=true", async () => {
    const newCycle = { ...fakeCycle2, isActive: true, windows: [] };
    let updateManyCalled = false;

    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        const tx = {
          performanceCycle: {
            updateMany: jest.fn().mockImplementation(() => {
              updateManyCalled = true;
              return Promise.resolve({ count: 1 });
            }),
            create: jest.fn().mockResolvedValue(fakeCycle2),
            findUnique: jest.fn().mockResolvedValue(newCycle),
          },
          checkInWindow: {
            createMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
        };
        return callback(tx as unknown as typeof mockPrisma);
      }
    );

    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2026",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isActive: true,
    });
    const res = await postCycle(req);

    expect(res.status).toBe(201);
    expect(updateManyCalled).toBe(true);
  });

  it("does NOT call updateMany when isActive is not set", async () => {
    const newCycle = { ...fakeCycle1, isActive: false, windows: [] };
    let updateManyCalled = false;

    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        const tx = {
          performanceCycle: {
            updateMany: jest.fn().mockImplementation(() => {
              updateManyCalled = true;
              return Promise.resolve({ count: 0 });
            }),
            create: jest.fn().mockResolvedValue(fakeCycle1),
            findUnique: jest.fn().mockResolvedValue(newCycle),
          },
          checkInWindow: {
            createMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
        };
        return callback(tx as unknown as typeof mockPrisma);
      }
    );

    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2025",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });
    await postCycle(req);

    expect(updateManyCalled).toBe(false);
  });

  it("returns 400 when name is missing", async () => {
    const req = makeRequest("POST", "/api/v1/cycles", {
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });
    const res = await postCycle(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it("returns 400 when startDate is missing", async () => {
    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2025",
      endDate: "2026-03-31",
    });
    const res = await postCycle(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when endDate is before startDate", async () => {
    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2025",
      startDate: "2026-03-31",
      endDate: "2025-04-01",
    });
    const res = await postCycle(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/endDate/i);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const req = makeRequest("POST", "/api/v1/cycles", {
      name: "FY 2025",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });
    const res = await postCycle(req);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/cycles ────────────────────────────────────────────────────────

describe("GET /api/v1/cycles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("returns a list of cycles", async () => {
    (mockPrisma.performanceCycle.findMany as jest.Mock).mockResolvedValue([
      fakeCycle1,
      fakeCycle2,
    ]);

    const req = makeRequest("GET", "/api/v1/cycles");
    const res = await getCycles(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cycles).toHaveLength(2);
    expect(body.cycles[0].name).toBe("FY 2025");
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const req = makeRequest("GET", "/api/v1/cycles");
    const res = await getCycles(req);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/cycles/:id — activate deactivates others ─────────────────────

describe("PUT /api/v1/cycles/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("activating a second cycle deactivates the first", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle2
    );

    let deactivateCalled = false;
    let deactivateFilter: unknown;

    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        const tx = {
          performanceCycle: {
            updateMany: jest.fn().mockImplementation((args: unknown) => {
              deactivateCalled = true;
              deactivateFilter = args;
              return Promise.resolve({ count: 1 });
            }),
            update: jest.fn().mockResolvedValue({
              ...fakeCycle2,
              isActive: true,
              windows: [],
            }),
          },
        };
        return callback(tx as unknown as typeof mockPrisma);
      }
    );

    const req = makeRequest("PUT", "/api/v1/cycles/cycle-2", { isActive: true });
    const res = await putCycle(req, { params: { id: "cycle-2" } });

    expect(res.status).toBe(200);
    expect(deactivateCalled).toBe(true);
    // Should have excluded the cycle being activated from the deactivation
    expect(deactivateFilter).toMatchObject({
      where: { isActive: true, id: { not: "cycle-2" } },
      data: { isActive: false },
    });
  });

  it("returns 404 when cycle does not exist", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("PUT", "/api/v1/cycles/nonexistent", {
      name: "Updated",
    });
    const res = await putCycle(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
  });

  it("returns 400 when no updatable fields are provided", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );

    const req = makeRequest("PUT", "/api/v1/cycles/cycle-1", {});
    const res = await putCycle(req, { params: { id: "cycle-1" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no updatable fields/i);
  });

  it("updates cycle name without touching isActive", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );

    let transactionCalled = false;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        transactionCalled = true;
        const tx = {
          performanceCycle: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue({
              ...fakeCycle1,
              name: "FY 2025 Updated",
              windows: [],
            }),
          },
        };
        return callback(tx as unknown as typeof mockPrisma);
      }
    );

    const req = makeRequest("PUT", "/api/v1/cycles/cycle-1", {
      name: "FY 2025 Updated",
    });
    const res = await putCycle(req, { params: { id: "cycle-1" } });

    expect(res.status).toBe(200);
    expect(transactionCalled).toBe(true);
    const body = await res.json();
    expect(body.cycle.name).toBe("FY 2025 Updated");
  });
});

// ── GET /api/v1/cycles/:id/windows ───────────────────────────────────────────

describe("GET /api/v1/cycles/:id/windows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("returns windows for a cycle", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );
    const fakeWindows = buildDefaultWindows("cycle-1", new Date("2025-04-01")).map(
      (w, i) => ({ ...w, id: `window-${i}` })
    );
    (mockPrisma.checkInWindow.findMany as jest.Mock).mockResolvedValue(fakeWindows);

    const req = makeRequest("GET", "/api/v1/cycles/cycle-1/windows");
    const res = await getWindows(req, { params: { id: "cycle-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windows).toHaveLength(5);
  });

  it("returns 404 when cycle does not exist", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("GET", "/api/v1/cycles/nonexistent/windows");
    const res = await getWindows(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const req = makeRequest("GET", "/api/v1/cycles/cycle-1/windows");
    const res = await getWindows(req, { params: { id: "cycle-1" } });

    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/cycles/:id/windows/:windowId ──────────────────────────────────

describe("PUT /api/v1/cycles/:id/windows/:windowId", () => {
  const fakeWindow = {
    id: "window-1",
    cycleId: "cycle-1",
    quarter: "Q1",
    opensAt: new Date("2025-07-01"),
    closesAt: new Date("2025-07-31"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession() as never);
  });

  it("updates window opensAt and closesAt", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );
    (mockPrisma.checkInWindow.findFirst as jest.Mock).mockResolvedValue(fakeWindow);
    const updatedWindow = {
      ...fakeWindow,
      opensAt: new Date("2025-07-05"),
      closesAt: new Date("2025-08-05"),
    };
    (mockPrisma.checkInWindow.update as jest.Mock).mockResolvedValue(updatedWindow);

    const req = makeRequest(
      "PUT",
      "/api/v1/cycles/cycle-1/windows/window-1",
      {
        opensAt: "2025-07-05T00:00:00.000Z",
        closesAt: "2025-08-05T23:59:59.999Z",
      }
    );
    const res = await putWindow(req, {
      params: { id: "cycle-1", windowId: "window-1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.window).toBeDefined();
    expect(mockPrisma.checkInWindow.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "window-1" } })
    );
  });

  it("returns 400 when closesAt is before opensAt", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );
    (mockPrisma.checkInWindow.findFirst as jest.Mock).mockResolvedValue(fakeWindow);

    const req = makeRequest(
      "PUT",
      "/api/v1/cycles/cycle-1/windows/window-1",
      {
        opensAt: "2025-08-01T00:00:00.000Z",
        closesAt: "2025-07-01T00:00:00.000Z",
      }
    );
    const res = await putWindow(req, {
      params: { id: "cycle-1", windowId: "window-1" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/closesAt/i);
  });

  it("returns 404 when window does not belong to the cycle", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );
    (mockPrisma.checkInWindow.findFirst as jest.Mock).mockResolvedValue(null);

    const req = makeRequest(
      "PUT",
      "/api/v1/cycles/cycle-1/windows/wrong-window",
      { opensAt: "2025-07-05T00:00:00.000Z" }
    );
    const res = await putWindow(req, {
      params: { id: "cycle-1", windowId: "wrong-window" },
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 when no updatable fields are provided", async () => {
    (mockPrisma.performanceCycle.findUnique as jest.Mock).mockResolvedValue(
      fakeCycle1
    );
    (mockPrisma.checkInWindow.findFirst as jest.Mock).mockResolvedValue(fakeWindow);

    const req = makeRequest(
      "PUT",
      "/api/v1/cycles/cycle-1/windows/window-1",
      {}
    );
    const res = await putWindow(req, {
      params: { id: "cycle-1", windowId: "window-1" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no updatable fields/i);
  });
});

// ── getActiveWindow ───────────────────────────────────────────────────────────

describe("getActiveWindow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when there is no active cycle", async () => {
    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getActiveWindow();
    expect(result).toBeNull();
  });

  it("returns the window whose opensAt <= now <= closesAt", async () => {
    const now = new Date();
    const openWindow = {
      id: "window-q1",
      cycleId: "cycle-1",
      quarter: "Q1",
      opensAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // yesterday
      closesAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
    };
    const closedWindow = {
      id: "window-gs",
      cycleId: "cycle-1",
      quarter: "GOAL_SETTING",
      opensAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      closesAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    };

    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue({
      ...fakeCycle1,
      windows: [closedWindow, openWindow],
    });

    const result = await getActiveWindow();
    expect(result).not.toBeNull();
    expect(result!.id).toBe("window-q1");
    expect(result!.quarter).toBe("Q1");
  });

  it("returns null when active cycle has no currently open window", async () => {
    const now = new Date();
    const pastWindow = {
      id: "window-gs",
      cycleId: "cycle-1",
      quarter: "GOAL_SETTING",
      opensAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      closesAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
    const futureWindow = {
      id: "window-q1",
      cycleId: "cycle-1",
      quarter: "Q1",
      opensAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      closesAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
    };

    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue({
      ...fakeCycle1,
      windows: [pastWindow, futureWindow],
    });

    const result = await getActiveWindow();
    expect(result).toBeNull();
  });

  it("returns the window when now equals opensAt exactly", async () => {
    const now = new Date();
    const exactOpenWindow = {
      id: "window-q2",
      cycleId: "cycle-1",
      quarter: "Q2",
      opensAt: now,
      closesAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };

    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue({
      ...fakeCycle1,
      windows: [exactOpenWindow],
    });

    const result = await getActiveWindow();
    expect(result).not.toBeNull();
    expect(result!.quarter).toBe("Q2");
  });

  it("returns the window when now equals closesAt exactly", async () => {
    const now = new Date();
    const exactCloseWindow = {
      id: "window-q3",
      cycleId: "cycle-1",
      quarter: "Q3",
      opensAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      closesAt: now,
    };

    (mockPrisma.performanceCycle.findFirst as jest.Mock).mockResolvedValue({
      ...fakeCycle1,
      windows: [exactCloseWindow],
    });

    const result = await getActiveWindow();
    expect(result).not.toBeNull();
    expect(result!.quarter).toBe("Q3");
  });
});
