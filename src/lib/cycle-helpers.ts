/**
 * Cycle helper utilities.
 *
 * `getActiveWindow()` is used by submission/approval guards throughout the app
 * to determine whether a given check-in window is currently open.
 */
import prisma from "@/lib/prisma";
import type { CheckInWindow } from "@prisma/client";

/**
 * Returns the CheckInWindow from the active PerformanceCycle whose
 * opensAt <= now <= closesAt, or null if no such window exists.
 *
 * If there is no active cycle, or no window is currently open, returns null.
 */
export async function getActiveWindow(): Promise<CheckInWindow | null> {
  const now = new Date();

  // Find the active cycle
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
    include: {
      windows: true,
    },
  });

  if (!activeCycle) {
    return null;
  }

  // Find the window where now falls within [opensAt, closesAt]
  const openWindow = activeCycle.windows.find(
    (w) => w.opensAt <= now && now <= w.closesAt
  );

  return openWindow ?? null;
}
