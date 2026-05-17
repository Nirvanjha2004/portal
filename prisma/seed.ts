/**
 * Prisma seed script
 *
 * Creates demo data for the Goal Setting & Tracking Portal.
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.notification.deleteMany({});
  await prisma.escalationLog.deleteMany({});
  await prisma.escalationRule.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.checkIn.deleteMany({});
  await prisma.quarterlyAchievement.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.sharedGoal.deleteMany({});
  await prisma.goalSheet.deleteMany({});
  await prisma.checkInWindow.deleteMany({});
  await prisma.performanceCycle.deleteMany({});
  await prisma.thrustArea.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  // Create departments
  const deptEngineering = await prisma.department.create({
    data: { name: "Engineering" },
  });

  const deptProduct = await prisma.department.create({
    data: { name: "Product" },
  });

  const deptSales = await prisma.department.create({
    data: { name: "Sales" },
  });

  console.log("✓ Created 3 departments");

  // Create admin user
  const adminPasswordHash = await bcryptjs.hash("Admin@123", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log("✓ Created admin user");

  // Create managers
  const managerPasswordHash = await bcryptjs.hash("Manager@123", 10);

  const manager1 = await prisma.user.create({
    data: {
      email: "manager1@demo.com",
      name: "Manager One",
      passwordHash: managerPasswordHash,
      role: "MANAGER",
      departmentId: deptEngineering.id,
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      email: "manager2@demo.com",
      name: "Manager Two",
      passwordHash: managerPasswordHash,
      role: "MANAGER",
      departmentId: deptProduct.id,
    },
  });

  const manager3 = await prisma.user.create({
    data: {
      email: "manager3@demo.com",
      name: "Manager Three",
      passwordHash: managerPasswordHash,
      role: "MANAGER",
      departmentId: deptSales.id,
    },
  });

  console.log("✓ Created 3 managers");

  // Create employees
  const employeePasswordHash = await bcryptjs.hash("Employee@123", 10);

  const employees = [];
  for (let i = 1; i <= 9; i++) {
    const managerId = [manager1.id, manager2.id, manager3.id][Math.floor((i - 1) / 3)];
    const departmentId = [deptEngineering.id, deptProduct.id, deptSales.id][Math.floor((i - 1) / 3)];

    const emp = await prisma.user.create({
      data: {
        email: `employee${i}@demo.com`,
        name: `Employee ${i}`,
        passwordHash: employeePasswordHash,
        role: "EMPLOYEE",
        managerId,
        departmentId,
      },
    });
    employees.push(emp);
  }

  console.log("✓ Created 9 employees");

  // Create active performance cycle
  const cycle = await prisma.performanceCycle.create({
    data: {
      name: "FY 2025",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
      windows: {
        create: [
          {
            quarter: "GOAL_SETTING",
            opensAt: new Date("2025-04-01"),
            closesAt: new Date("2025-05-01"),
          },
          {
            quarter: "Q1",
            opensAt: new Date("2025-07-01"),
            closesAt: new Date("2025-07-31"),
          },
          {
            quarter: "Q2",
            opensAt: new Date("2025-10-01"),
            closesAt: new Date("2025-10-31"),
          },
          {
            quarter: "Q3",
            opensAt: new Date("2026-01-01"),
            closesAt: new Date("2026-01-31"),
          },
          {
            quarter: "Q4",
            opensAt: new Date("2026-03-01"),
            closesAt: new Date("2026-04-15"),
          },
        ],
      },
    },
  });

  console.log("✓ Created performance cycle with 5 windows");

  // Create thrust areas
  const thrustAreas = await Promise.all([
    prisma.thrustArea.create({ data: { name: "Innovation & Technology" } }),
    prisma.thrustArea.create({ data: { name: "Customer Satisfaction" } }),
    prisma.thrustArea.create({ data: { name: "Operational Excellence" } }),
    prisma.thrustArea.create({ data: { name: "Team Development" } }),
    prisma.thrustArea.create({ data: { name: "Revenue Growth" } }),
  ]);

  console.log("✓ Created 5 thrust areas");

  // Create goal sheets in various states
  const sheet1 = await prisma.goalSheet.create({
    data: {
      employeeId: employees[0].id,
      cycleId: cycle.id,
      status: "DRAFT",
      goals: {
        create: [
          {
            thrustAreaId: thrustAreas[0].id,
            title: "Implement new testing framework",
            description: "Migrate to Jest and achieve 80% coverage",
            uom: "PERCENTAGE_MIN",
            target: "80",
            weightage: 40,
          },
          {
            thrustAreaId: thrustAreas[1].id,
            title: "Reduce bug reports by 25%",
            description: "Focus on code quality and pre-release testing",
            uom: "PERCENTAGE_MAX",
            target: "25",
            weightage: 35,
          },
          {
            thrustAreaId: thrustAreas[2].id,
            title: "Document API endpoints",
            description: "Complete OpenAPI documentation for all REST endpoints",
            uom: "NUMERIC_MIN",
            target: "50",
            weightage: 25,
          },
        ],
      },
    },
  });

  const sheet2 = await prisma.goalSheet.create({
    data: {
      employeeId: employees[1].id,
      cycleId: cycle.id,
      status: "PENDING_APPROVAL",
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      goals: {
        create: [
          {
            thrustAreaId: thrustAreas[1].id,
            title: "Improve NPS score",
            description: "Increase Net Promoter Score by 10 points",
            uom: "NUMERIC_MIN",
            target: "10",
            weightage: 50,
          },
          {
            thrustAreaId: thrustAreas[4].id,
            title: "Onboard 5 new enterprise customers",
            description: "Close 5 enterprise deals in this fiscal year",
            uom: "NUMERIC_MIN",
            target: "5",
            weightage: 50,
          },
        ],
      },
    },
  });

  const sheet3 = await prisma.goalSheet.create({
    data: {
      employeeId: employees[2].id,
      cycleId: cycle.id,
      status: "APPROVED",
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      lockDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      goals: {
        create: [
          {
            thrustAreaId: thrustAreas[3].id,
            title: "Mentor two junior engineers",
            description: "Provide guidance and conduct weekly 1-on-1s",
            uom: "NUMERIC_MIN",
            target: "2",
            weightage: 40,
          },
          {
            thrustAreaId: thrustAreas[0].id,
            title: "Lead architecture design for microservices",
            description: "Design and document microservices architecture",
            uom: "TIMELINE",
            target: "90",
            weightage: 60,
          },
        ],
      },
    },
  });

  console.log("✓ Created 3 goal sheets in various states");

  // Add sample achievements for Q1
  await prisma.quarterlyAchievement.create({
    data: {
      goalId: sheet3.goals[0].id,
      quarter: "Q1",
      achievement: "2",
      status: "COMPLETED",
      progressScore: 100,
    },
  });

  await prisma.quarterlyAchievement.create({
    data: {
      goalId: sheet3.goals[1].id,
      quarter: "Q1",
      achievement: "75",
      status: "ON_TRACK",
      progressScore: 83.33,
    },
  });

  console.log("✓ Created sample quarterly achievements");

  // Create a check-in record
  await prisma.checkIn.create({
    data: {
      goalSheetId: sheet3.id,
      quarter: "Q1",
      managerId: manager1.id,
      comment: "Great progress on mentoring. Keep up the excellent work!",
      status: "MANAGER_REVIEWED",
      reviewedAt: new Date(),
    },
  });

  console.log("✓ Created sample check-in");

  console.log("\n✅ Seeding complete!");
  console.log("\n📝 Demo login credentials:");
  console.log("  Admin:    admin@demo.com / Admin@123");
  console.log("  Manager:  manager1@demo.com / Manager@123");
  console.log("  Employee: employee1@demo.com / Employee@123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
