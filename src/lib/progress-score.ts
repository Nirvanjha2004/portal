/**
 * Progress Score Computation
 *
 * Computes a score in [0, 100] representing how well a goal's achievement
 * meets its target, depending on the Unit of Measure (UoM) type.
 *
 * Handles edge cases:
 *   - NUMERIC_MIN / PERCENTAGE_MIN with target = 0 returns null
 *   - NUMERIC_MAX / PERCENTAGE_MAX with achievement = 0 returns 0
 *   - TIMELINE: score = 100 iff completion <= deadline, else 0
 *   - ZERO_BASED: score = 100 iff achievement = 0, else 0
 */

import type { UoM } from "@prisma/client";

/**
 * Computes a progress score for a goal.
 *
 * @param uom - The Unit of Measure type
 * @param target - The target value (as string, will be parsed)
 * @param achievement - The achieved value (as string, will be parsed)
 * @returns A number in [0, 100], or null if the score cannot be computed
 * @throws Error if inputs are invalid
 */
export function computeProgressScore(
  uom: UoM,
  target: string,
  achievement: string
): number | null {
  const targetNum = parseFloat(target);
  const achievementNum = parseFloat(achievement);

  if (isNaN(targetNum) || isNaN(achievementNum)) {
    throw new Error("Target and achievement must be numeric or parseable");
  }

  switch (uom) {
    case "NUMERIC_MIN":
    case "PERCENTAGE_MIN": {
      // Goal: achieve at least `target`
      // Score = min(achievement / target, 100) * 100
      // If target = 0, return null (edge case)
      if (targetNum === 0) {
        return null;
      }
      const ratio = achievementNum / targetNum;
      return Math.min(ratio, 1) * 100;
    }

    case "NUMERIC_MAX":
    case "PERCENTAGE_MAX": {
      // Goal: keep achievement at most `target`
      // Score = max(1 - achievement / target, 0) * 100
      // If achievement = 0, score = 100
      if (achievementNum === 0) {
        return 100;
      }
      const ratio = achievementNum / targetNum;
      return Math.max(1 - ratio, 0) * 100;
    }

    case "TIMELINE": {
      // Goal: complete within `target` days
      // For simplicity: interpret achievement as days taken
      // Score = 100 if achievement <= target, else 0
      return achievementNum <= targetNum ? 100 : 0;
    }

    case "ZERO_BASED": {
      // Goal: achieve zero/none
      // Score = 100 if achievement = 0, else 0
      return achievementNum === 0 ? 100 : 0;
    }

    default:
      throw new Error(`Unknown UoM: ${uom}`);
  }
}
