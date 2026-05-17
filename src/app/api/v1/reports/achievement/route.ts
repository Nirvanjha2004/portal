/**
 * GET /api/v1/reports/achievement
 *
 * Returns achievement report as CSV or XLSX.
 *
 * Query parameters:
 *   - format: 'csv' or 'xlsx' (default: csv)
 *   - cycleId: performance cycle ID (required)
 *
 * Report columns: Employee name, Department, Thrust Area, Goal Title, UoM, Target,
 * Q1–Q4 Achievement, Q1–Q4 Progress Score, Q1–Q4 Status
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const GET = withManager(async (req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const searchParams = req.nextUrl.searchParams;
  const format = searchParams.get("format") || "csv";
  const cycleId = searchParams.get("cycleId");

  if (!cycleId) {
    return NextResponse.json(
      { error: "cycleId is required" },
      { status: 400 }
    );
  }

  if (!["csv", "xlsx"].includes(format)) {
    return NextResponse.json(
      { error: "format must be 'csv' or 'xlsx'" },
      { status: 400 }
    );
  }

  // Load cycle and verify it exists
  const cycle = await prisma.performanceCycle.findUnique({
    where: { id: cycleId },
  });

  if (!cycle) {
    return NextResponse.json(
      { error: "Cycle not found" },
      { status: 404 }
    );
  }

  // Load goal sheets with achievements
  let where: any = { cycleId };

  if (role === "MANAGER") {
    where.employee = { managerId: userId };
  }

  const sheets = await prisma.goalSheet.findMany({
    where,
    include: {
      employee: {
        select: { id: true, name: true, department: { select: { name: true } } },
      },
      goals: {
        include: {
          thrustArea: { select: { name: true } },
          achievements: true,
        },
      },
    },
  });

  // Flatten to rows: one row per goal
  const rows: any[] = [];

  for (const sheet of sheets) {
    for (const goal of sheet.goals) {
      const baseRow = {
        employeeName: sheet.employee.name,
        department: sheet.employee.department?.name || "N/A",
        thrustArea: goal.thrustArea.name,
        goalTitle: goal.title,
        uom: goal.uom,
        target: goal.target,
      };

      // Add quarterly data
      for (const quarter of ["Q1", "Q2", "Q3", "Q4"]) {
        const achievement = goal.achievements.find(
          (a) => a.quarter === quarter
        );
        baseRow[`${quarter}_achievement`] = achievement?.achievement || "-";
        baseRow[`${quarter}_progressScore`] = achievement?.progressScore
          ? achievement.progressScore.toFixed(2)
          : "-";
        baseRow[`${quarter}_status`] = achievement?.status || "-";
      }

      rows.push(baseRow);
    }
  }

  // Generate CSV
  if (format === "csv") {
    const headers = [
      "Employee Name",
      "Department",
      "Thrust Area",
      "Goal Title",
      "UoM",
      "Target",
      "Q1 Achievement",
      "Q1 Progress Score",
      "Q1 Status",
      "Q2 Achievement",
      "Q2 Progress Score",
      "Q2 Status",
      "Q3 Achievement",
      "Q3 Progress Score",
      "Q3 Status",
      "Q4 Achievement",
      "Q4 Progress Score",
      "Q4 Status",
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => {
        const values = [
          row.employeeName,
          row.department,
          row.thrustArea,
          row.goalTitle,
          row.uom,
          row.target,
          row.Q1_achievement,
          row.Q1_progressScore,
          row.Q1_status,
          row.Q2_achievement,
          row.Q2_progressScore,
          row.Q2_status,
          row.Q3_achievement,
          row.Q3_progressScore,
          row.Q3_status,
          row.Q4_achievement,
          row.Q4_progressScore,
          row.Q4_status,
        ];
        return values.map((v) => `"${v}"`).join(",");
      }),
    ].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="achievement-report-${cycleId}.csv"`,
      },
    });
  }

  // For XLSX, we would need exceljs library
  // For now, return a simple JSON response indicating XLSX is not yet fully implemented
  return NextResponse.json({
    error:
      "XLSX format not yet implemented; use format=csv instead",
    format: "csv",
    cycleId,
    rowCount: rows.length,
  });
});
