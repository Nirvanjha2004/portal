/**
 * Weightage validation for Goal Sheets.
 *
 * Rules (from BRD / Requirement 3):
 *   1. Total weightage across all goals must equal exactly 100%.
 *   2. Each individual goal must have a weightage of at least 10%.
 *   3. A goal sheet must contain no more than 8 goals.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

interface GoalLike {
  weightage: number;
  title?: string;
}

/**
 * Validates the weightage rules for a set of goals.
 * Throws `ValidationError` if any rule is violated.
 */
export function validateWeightage(goals: GoalLike[]): void {
  if (goals.length > 8) {
    throw new ValidationError(
      `Goal sheet has ${goals.length} goals, maximum is 8`
    );
  }

  for (const goal of goals) {
    if (goal.weightage < 10) {
      const label = goal.title ? `"${goal.title}"` : "A goal";
      throw new ValidationError(
        `${label} has weightage ${goal.weightage}%, minimum is 10%`
      );
    }
  }

  const total = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (total !== 100) {
    throw new ValidationError(
      `Total weightage is ${total}%, must be 100%`
    );
  }
}
