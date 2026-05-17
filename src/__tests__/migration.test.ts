/**
 * Migration test — seeds one record of each model and reads it back.
 *
 * Prerequisites: a running PostgreSQL instance with DATABASE_URL set.
 * If the database is unavailable, the tests are skipped gracefully.
 *
 * Run with: npx jest --testPathPattern=migration --forceExit
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper: skip all tests if the DB is unreachable
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$connect();
    return true;
  } catch {
    return false;
  }
}

describe("Migration — seed and read-back for every model", () => {
  let dbAvailable = false;

  // IDs created during the test run — used for cross-model references
  let userId: string;
  let departmentId: string;
  let cycleId: string;
  let windowId: string;
  let thrustAreaId: string;
  let goalSheetId: string;
  let goalId: string;
  let sharedGoalId: string;
  let achievementId: string;
  let checkInId: string;
  let auditLogId: string;
  let notificationId: string;
  let escalationRuleId: string;
  let escalationLogId: string;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn(
        "⚠️  Database not available — migration tests will be skipped."
      );
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      // Clean up in reverse dependency order to respect FK constraints
      await prisma.escalationLog.deleteMany({});
      await prisma.escalationRule.deleteMany({});
      await prisma.notification.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.checkIn.deleteMany({});
      await prisma.quarterlyAchievement.deleteMany({});
      await prisma.goal.deleteMany({});
      await prisma.sharedGoal.deleteMany({});
      await prisma.goalSheet.deleteMany({});
      await prisma.checkInWindow.deleteMany({});
      await prisma.performanceCycle.deleteMany({});
      await prisma.thrustArea.deleteMany({});
      await prisma.user.deleteMany({ where: { email: { endsWith: "@migration-test.local" } } });
      await prisma.department.deleteMany({ where: { name: { startsWith: "MigTest-" } } });
    }
    await prisma.$disconnect();
  });

  // ── Department ────────────────────────────────────────────────────────────

  it("creates and reads a Department", async () => {
    if (!dbAvailable) return;

    const dept = await prisma.department.create({
      data: { name: "MigTest-Engineering" },
    });
    departmentId = dept.id;

    const found = await prisma.department.findUniqueOrThrow({
      where: { id: departmentId },
    });
    expect(found.name).toBe("MigTest-Engineering");
  });

  // ── User ──────────────────────────────────────────────────────────────────

  it("creates and reads a User", async () => {
    if (!dbAvailable) return;

    const user = await prisma.user.create({
      data: {
        email: "admin@migration-test.local",
        name: "Migration Admin",
        passwordHash: "$2b$10$placeholder_hash_for_test",
        role: "ADMIN",
        departmentId,
      },
    });
    userId = user.id;

    const found = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(found.email).toBe("admin@migration-test.local");
    expect(found.role).toBe("ADMIN");
    expect(found.departmentId).toBe(departmentId);
  });

  // ── PerformanceCycle ──────────────────────────────────────────────────────

  it("creates and reads a PerformanceCycle", async () => {
    if (!dbAvailable) return;

    const cycle = await prisma.performanceCycle.create({
      data: {
        name: "FY 2025-26",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2026-03-31"),
        isActive: true,
      },
    });
    cycleId = cycle.id;

    const found = await prisma.performanceCycle.findUniqueOrThrow({
      where: { id: cycleId },
    });
    expect(found.name).toBe("FY 2025-26");
    expect(found.isActive).toBe(true);
  });

  // ── CheckInWindow ─────────────────────────────────────────────────────────

  it("creates and reads a CheckInWindow", async () => {
    if (!dbAvailable) return;

    const window = await prisma.checkInWindow.create({
      data: {
        cycleId,
        quarter: "GOAL_SETTING",
        opensAt: new Date("2025-04-01"),
        closesAt: new Date("2025-04-30"),
      },
    });
    windowId = window.id;

    const found = await prisma.checkInWindow.findUniqueOrThrow({
      where: { id: windowId },
    });
    expect(found.quarter).toBe("GOAL_SETTING");
    expect(found.cycleId).toBe(cycleId);
  });

  // ── ThrustArea ────────────────────────────────────────────────────────────

  it("creates and reads a ThrustArea", async () => {
    if (!dbAvailable) return;

    const area = await prisma.thrustArea.create({
      data: { name: "MigTest-Innovation" },
    });
    thrustAreaId = area.id;

    const found = await prisma.thrustArea.findUniqueOrThrow({
      where: { id: thrustAreaId },
    });
    expect(found.name).toBe("MigTest-Innovation");
  });

  // ── GoalSheet ─────────────────────────────────────────────────────────────

  it("creates and reads a GoalSheet with @@unique([employeeId, cycleId])", async () => {
    if (!dbAvailable) return;

    const sheet = await prisma.goalSheet.create({
      data: {
        employeeId: userId,
        cycleId,
        status: "DRAFT",
      },
    });
    goalSheetId = sheet.id;

    const found = await prisma.goalSheet.findUniqueOrThrow({
      where: { id: goalSheetId },
    });
    expect(found.status).toBe("DRAFT");
    expect(found.employeeId).toBe(userId);

    // Verify the unique constraint: duplicate (employeeId, cycleId) must fail
    await expect(
      prisma.goalSheet.create({
        data: { employeeId: userId, cycleId, status: "DRAFT" },
      })
    ).rejects.toThrow();
  });

  // ── SharedGoal ────────────────────────────────────────────────────────────

  it("creates and reads a SharedGoal", async () => {
    if (!dbAvailable) return;

    const sg = await prisma.sharedGoal.create({
      data: {
        createdById: userId,
        thrustAreaId,
        title: "Shared Innovation Goal",
        description: "A goal shared across teams",
        uom: "PERCENTAGE_MIN",
        target: "80",
      },
    });
    sharedGoalId = sg.id;

    const found = await prisma.sharedGoal.findUniqueOrThrow({
      where: { id: sharedGoalId },
    });
    expect(found.title).toBe("Shared Innovation Goal");
    expect(found.uom).toBe("PERCENTAGE_MIN");
  });

  // ── Goal ──────────────────────────────────────────────────────────────────

  it("creates and reads a Goal", async () => {
    if (!dbAvailable) return;

    const goal = await prisma.goal.create({
      data: {
        goalSheetId,
        thrustAreaId,
        title: "Increase test coverage",
        description: "Raise unit test coverage to 80%",
        uom: "PERCENTAGE_MIN",
        target: "80",
        weightage: 100,
        isShared: false,
        isReadOnly: false,
        sharedGoalId,
      },
    });
    goalId = goal.id;

    const found = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(found.title).toBe("Increase test coverage");
    expect(found.weightage).toBe(100);
    expect(found.uom).toBe("PERCENTAGE_MIN");
  });

  // ── QuarterlyAchievement ──────────────────────────────────────────────────

  it("creates and reads a QuarterlyAchievement with @@unique([goalId, quarter])", async () => {
    if (!dbAvailable) return;

    const qa = await prisma.quarterlyAchievement.create({
      data: {
        goalId,
        quarter: "Q1",
        achievement: "65",
        status: "ON_TRACK",
        progressScore: 81.25,
      },
    });
    achievementId = qa.id;

    const found = await prisma.quarterlyAchievement.findUniqueOrThrow({
      where: { id: achievementId },
    });
    expect(found.quarter).toBe("Q1");
    expect(found.achievement).toBe("65");
    expect(found.progressScore).toBeCloseTo(81.25);

    // Verify the unique constraint: duplicate (goalId, quarter) must fail
    await expect(
      prisma.quarterlyAchievement.create({
        data: { goalId, quarter: "Q1", status: "NOT_STARTED" },
      })
    ).rejects.toThrow();
  });

  // ── CheckIn ───────────────────────────────────────────────────────────────

  it("creates and reads a CheckIn with @@unique([goalSheetId, quarter])", async () => {
    if (!dbAvailable) return;

    const ci = await prisma.checkIn.create({
      data: {
        goalSheetId,
        quarter: "Q1",
        managerId: userId,
        comment: "Good progress this quarter.",
        status: "MANAGER_REVIEWED",
        reviewedAt: new Date(),
      },
    });
    checkInId = ci.id;

    const found = await prisma.checkIn.findUniqueOrThrow({
      where: { id: checkInId },
    });
    expect(found.status).toBe("MANAGER_REVIEWED");
    expect(found.comment).toBe("Good progress this quarter.");

    // Verify the unique constraint: duplicate (goalSheetId, quarter) must fail
    await expect(
      prisma.checkIn.create({
        data: { goalSheetId, quarter: "Q1", status: "PENDING" },
      })
    ).rejects.toThrow();
  });

  // ── AuditLog ──────────────────────────────────────────────────────────────

  it("creates and reads an AuditLog", async () => {
    if (!dbAvailable) return;

    const log = await prisma.auditLog.create({
      data: {
        actorId: userId,
        goalId,
        field: "weightage",
        oldValue: "50",
        newValue: "100",
        reason: "Admin correction",
      },
    });
    auditLogId = log.id;

    const found = await prisma.auditLog.findUniqueOrThrow({
      where: { id: auditLogId },
    });
    expect(found.field).toBe("weightage");
    expect(found.oldValue).toBe("50");
    expect(found.newValue).toBe("100");
  });

  // ── Notification ──────────────────────────────────────────────────────────

  it("creates and reads a Notification", async () => {
    if (!dbAvailable) return;

    const notif = await prisma.notification.create({
      data: {
        recipientId: userId,
        type: "GOAL_SHEET_APPROVED",
        title: "Your goal sheet was approved",
        body: "Your goal sheet for FY 2025-26 has been approved by your manager.",
        deepLink: "/goals/sheet/123",
        isRead: false,
      },
    });
    notificationId = notif.id;

    const found = await prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    expect(found.type).toBe("GOAL_SHEET_APPROVED");
    expect(found.isRead).toBe(false);
    expect(found.deepLink).toBe("/goals/sheet/123");
  });

  // ── EscalationRule ────────────────────────────────────────────────────────

  it("creates and reads an EscalationRule", async () => {
    if (!dbAvailable) return;

    const rule = await prisma.escalationRule.create({
      data: {
        eventType: "OVERDUE_SUBMISSION",
        daysOverdue: 3,
        recipientRole: "ADMIN",
        isActive: true,
      },
    });
    escalationRuleId = rule.id;

    const found = await prisma.escalationRule.findUniqueOrThrow({
      where: { id: escalationRuleId },
    });
    expect(found.eventType).toBe("OVERDUE_SUBMISSION");
    expect(found.daysOverdue).toBe(3);
    expect(found.recipientRole).toBe("ADMIN");
  });

  // ── EscalationLog ─────────────────────────────────────────────────────────

  it("creates and reads an EscalationLog", async () => {
    if (!dbAvailable) return;

    const log = await prisma.escalationLog.create({
      data: {
        ruleId: escalationRuleId,
        actorId: userId,
        recipientId: userId,
        daysOverdue: 3,
      },
    });
    escalationLogId = log.id;

    const found = await prisma.escalationLog.findUniqueOrThrow({
      where: { id: escalationLogId },
    });
    expect(found.ruleId).toBe(escalationRuleId);
    expect(found.daysOverdue).toBe(3);
  });

  // ── Cross-model relation checks ───────────────────────────────────────────

  it("reads GoalSheet with nested goals and checkIns", async () => {
    if (!dbAvailable) return;

    const sheet = await prisma.goalSheet.findUniqueOrThrow({
      where: { id: goalSheetId },
      include: { goals: true, checkIns: true, employee: true, cycle: true },
    });

    expect(sheet.goals).toHaveLength(1);
    expect(sheet.goals[0].id).toBe(goalId);
    expect(sheet.checkIns).toHaveLength(1);
    expect(sheet.checkIns[0].id).toBe(checkInId);
    expect(sheet.employee.id).toBe(userId);
    expect(sheet.cycle.id).toBe(cycleId);
  });

  it("reads Goal with nested achievements and auditLogs", async () => {
    if (!dbAvailable) return;

    const goal = await prisma.goal.findUniqueOrThrow({
      where: { id: goalId },
      include: { achievements: true, auditLogs: true, thrustArea: true },
    });

    expect(goal.achievements).toHaveLength(1);
    expect(goal.achievements[0].id).toBe(achievementId);
    expect(goal.auditLogs).toHaveLength(1);
    expect(goal.auditLogs[0].id).toBe(auditLogId);
    expect(goal.thrustArea.id).toBe(thrustAreaId);
  });
});
