/**
 * Prisma client singleton.
 * Prevents multiple PrismaClient instances during hot-reloads in development.
 *
 * Includes middleware to log goal updates when the sheet is locked.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

/**
 * Middleware to log goal updates when the sheet is locked.
 * Writes AuditLog entries for each changed field.
 */
prisma.$use(async (params, next) => {
  if (params.model === "Goal" && params.action === "update") {
    // Get the current goal state
    const goal = await prisma.goal.findUnique({
      where: params.where,
      include: { goalSheet: true },
    });

    if (goal && goal.goalSheet.lockDate) {
      // Sheet is locked, so we'll log changes
      const result = await next(params);

      // Get the updated goal to compare
      const updated = await prisma.goal.findUnique({
        where: params.where,
      });

      if (updated) {
        // Create audit log entries for changed fields
        const data = params.args.data as Record<string, any>;

        const changedFields = Object.keys(data).filter((key) => {
          const oldValue = (goal as Record<string, any>)[key];
          const newValue = (updated as Record<string, any>)[key];
          return oldValue !== newValue;
        });

        if (changedFields.length > 0 && params.args._actorId) {
          const auditEntries = changedFields.map((field) => ({
            actorId: params.args._actorId,
            goalId: goal.id,
            field,
            oldValue: String((goal as Record<string, any>)[field] ?? ""),
            newValue: String((updated as Record<string, any>)[field] ?? ""),
          }));

          await prisma.auditLog.createMany({ data: auditEntries });
        }
      }

      return result;
    }
  }

  return next(params);
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export default prisma;
