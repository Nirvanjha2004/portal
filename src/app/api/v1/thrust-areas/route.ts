/**
 * GET  /api/v1/thrust-areas  — list all thrust areas (all authenticated roles)
 * POST /api/v1/thrust-areas  — create a thrust area (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin, withEmployee } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

// ─── GET /api/v1/thrust-areas ─────────────────────────────────────────────────

export const GET = withEmployee(async (_req: NextRequest) => {
  const thrustAreas = await prisma.thrustArea.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { goals: true } } },
  });

  return NextResponse.json({ thrustAreas });
});

// ─── POST /api/v1/thrust-areas ────────────────────────────────────────────────

export const POST = withAdmin(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Thrust area name is required" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  // Check for duplicate
  const existing = await prisma.thrustArea.findUnique({
    where: { name: trimmedName },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Thrust area "${trimmedName}" already exists` },
      { status: 409 }
    );
  }

  const thrustArea = await prisma.thrustArea.create({
    data: { name: trimmedName },
  });

  return NextResponse.json({ thrustArea }, { status: 201 });
});
