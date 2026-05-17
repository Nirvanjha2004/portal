/**
 * RBAC tests for Task 3: Authentication & Role-Based Access Control
 *
 * Tests the `withRole` HOF directly by mocking the NextAuth `auth()` function.
 * No running server is required.
 *
 * Validates:
 *   - Unauthenticated request to a protected route returns 401
 *   - Employee token rejected on a Manager-only route returns 403
 *   - Correct role is granted access (200)
 *   - Admin can access routes restricted to any role
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole, withAdmin, withManager, withEmployee } from "@/lib/auth-helpers";

// ── Mock NextAuth auth() ──────────────────────────────────────────────────────
// We mock the entire `@/lib/auth` module so that `auth()` returns whatever
// session we configure per test, without touching the database or JWT.

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as jest.MockedFunction<typeof auth>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(path = "/api/v1/test"): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

/** A simple handler that always returns 200 OK. */
const okHandler = jest.fn(async () =>
  NextResponse.json({ ok: true }, { status: 200 })
);

/** Build a mock session for the given role. */
function sessionFor(role: "EMPLOYEE" | "MANAGER" | "ADMIN") {
  return {
    user: { id: "user-1", email: "test@example.com", name: "Test User", role },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("withRole HOF — authentication guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated (no session)", async () => {
    // auth() returns null → unauthenticated
    mockAuth.mockResolvedValueOnce(null as never);

    const handler = withRole(["ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthenticated");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when auth() returns a session without a user object", async () => {
    // Simulate a session with no user (edge case)
    mockAuth.mockResolvedValueOnce({ user: null, expires: "" } as never);

    const handler = withRole(["MANAGER"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthenticated");
    expect(okHandler).not.toHaveBeenCalled();
  });
});

describe("withRole HOF — authorisation guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when an Employee token is used on a Manager-only route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);

    const handler = withRole(["MANAGER", "ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("returns 403 when an Employee token is used on an Admin-only route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);

    const handler = withRole(["ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("returns 403 when a Manager token is used on an Admin-only route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("MANAGER") as never);

    const handler = withRole(["ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(okHandler).not.toHaveBeenCalled();
  });
});

describe("withRole HOF — access granted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the handler and returns 200 when the role matches exactly", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("MANAGER") as never);

    const handler = withRole(["MANAGER"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("allows Admin to access a Manager-only route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("ADMIN") as never);

    const handler = withRole(["MANAGER", "ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("allows Admin to access an Employee-only route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("ADMIN") as never);

    const handler = withRole(["EMPLOYEE", "MANAGER", "ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("allows Employee to access an Employee-accessible route", async () => {
    mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);

    const handler = withRole(["EMPLOYEE", "MANAGER", "ADMIN"], okHandler);
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });
});

describe("convenience wrappers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("withAdmin", () => {
    it("returns 403 for Employee", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);
      const res = await withAdmin(okHandler)(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 403 for Manager", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("MANAGER") as never);
      const res = await withAdmin(okHandler)(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 200 for Admin", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("ADMIN") as never);
      const res = await withAdmin(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });
  });

  describe("withManager", () => {
    it("returns 403 for Employee", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);
      const res = await withManager(okHandler)(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 200 for Manager", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("MANAGER") as never);
      const res = await withManager(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });

    it("returns 200 for Admin", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("ADMIN") as never);
      const res = await withManager(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });
  });

  describe("withEmployee", () => {
    it("returns 200 for Employee", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("EMPLOYEE") as never);
      const res = await withEmployee(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });

    it("returns 200 for Manager", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("MANAGER") as never);
      const res = await withEmployee(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });

    it("returns 200 for Admin", async () => {
      mockAuth.mockResolvedValueOnce(sessionFor("ADMIN") as never);
      const res = await withEmployee(okHandler)(makeRequest());
      expect(res.status).toBe(200);
    });
  });
});
