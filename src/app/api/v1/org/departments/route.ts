/**
 * GET  /api/v1/org/departments  — list all departments (Admin only)
 * POST /api/v1/org/departments  — create a department (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(async (_req: NextRequest) => {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return NextResponse.json({ departments });
});

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
      { error: "Department name is required" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  // Check for duplicate
  const existing = await prisma.department.findUnique({
    where: { name: trimmedName },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Department "${trimmedName}" already exists` },
      { status: 409 }
    );
  }

  const department = await prisma.department.create({
    data: { name: trimmedName },
  });

  return NextResponse.json({ department }, { status: 201 });
});
