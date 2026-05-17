/**
 * POST /api/v1/goal-sheets/:id/goals  — add a goal to a DRAFT sheet
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { UoM } from "@prisma/client";

const VALID_UOM: UoM[] = [
  "NUMERIC_MIN",
  "NUMERIC_MAX",
  "PERCENTAGE_MIN",
  "PERCENTAGE_MAX",
  "TIMELINE",
  "ZERO_BASED",
];

// ─── POST /api/v1/goal-sheets/:id/goals ───────────────────────────────────────

export const POST = withEmployee(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    // Load the sheet
    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, managerId: true } },
        goals: true,
      },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    // Ownership check
    const isOwn = sheet.employeeId === userId;
    const isManagerOfEmployee =
      role === "MANAGER" && sheet.employee.managerId === userId;
    const isAdmin = role === "ADMIN";

    if (!isOwn && !isManagerOfEmployee && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only DRAFT sheets can be modified
    if (sheet.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot add goals to a sheet with status "${sheet.status}". Only DRAFT sheets can be modified.`,
        },
        { status: 422 }
      );
    }

    // Max 8 goals
    if (sheet.goals.length >= 8) {
      return NextResponse.json(
        { error: "Goal sheet already has the maximum of 8 goals" },
        { status: 422 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { thrustAreaId, title, description, uom, target, weightage } =
      body as {
        thrustAreaId?: string;
        title?: string;
        description?: string;
        uom?: string;
        target?: string;
        weightage?: number;
      };

    // ── Validation ────────────────────────────────────────────────────────────

    if (!thrustAreaId || typeof thrustAreaId !== "string") {
      return NextResponse.json(
        { error: "thrustAreaId is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Goal title is required" },
        { status: 400 }
      );
    }
    if (title.trim().length > 200) {
      return NextResponse.json(
        { error: "Goal title must not exceed 200 characters" },
        { status: 400 }
      );
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Goal description is required" },
        { status: 400 }
      );
    }
    if (description.trim().length > 1000) {
      return NextResponse.json(
        { error: "Goal description must not exceed 1000 characters" },
        { status: 400 }
      );
    }

    if (!uom || !VALID_UOM.includes(uom as UoM)) {
      return NextResponse.json(
        {
          error: `uom must be one of: ${VALID_UOM.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!target || typeof target !== "string" || target.trim().length === 0) {
      return NextResponse.json(
        { error: "Goal target is required" },
        { status: 400 }
      );
    }

    if (
      weightage === undefined ||
      weightage === null ||
      typeof weightage !== "number" ||
      !Number.isInteger(weightage)
    ) {
      return NextResponse.json(
        { error: "Weightage must be an integer" },
        { status: 400 }
      );
    }

    if (weightage < 10) {
      return NextResponse.json(
        { error: "Weightage must be at least 10%" },
        { status: 400 }
      );
    }

    if (weightage > 100) {
      return NextResponse.json(
        { error: "Weightage must not exceed 100%" },
        { status: 400 }
      );
    }

    // Verify thrust area exists
    const thrustArea = await prisma.thrustArea.findUnique({
      where: { id: thrustAreaId },
    });
    if (!thrustArea) {
      return NextResponse.json(
        { error: "Thrust area not found" },
        { status: 404 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        goalSheetId: id,
        thrustAreaId,
        title: title.trim(),
        description: description.trim(),
        uom: uom as UoM,
        target: target.trim(),
        weightage,
      },
      include: {
        thrustArea: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ goal }, { status: 201 });
  }
);
