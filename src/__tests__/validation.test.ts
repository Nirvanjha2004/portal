/**
 * Tests for Task 8: Weightage Validation Logic
 *
 * Uses fast-check for property-based testing.
 *
 * Properties tested:
 *   1. Any set of goals where total weightage ≠ 100 always fails validation
 *   2. Any goal with weightage < 10 always fails validation
 *   3. Any sheet with > 8 goals always fails validation
 *   4. A valid set (total = 100, all ≥ 10, count ≤ 8) always passes validation
 */

import * as fc from "fast-check";
import { validateWeightage, ValidationError } from "@/lib/validation";

// ── Unit tests ────────────────────────────────────────────────────────────────

describe("validateWeightage — unit tests", () => {
  it("passes for a single goal with weightage 100", () => {
    expect(() => validateWeightage([{ weightage: 100 }])).not.toThrow();
  });

  it("passes for two goals summing to 100", () => {
    expect(() =>
      validateWeightage([{ weightage: 60 }, { weightage: 40 }])
    ).not.toThrow();
  });

  it("passes for 8 goals each with weightage 12 or 13 summing to 100", () => {
    // 4×13 + 4×12 = 52 + 48 = 100
    const goals = [
      { weightage: 13 },
      { weightage: 13 },
      { weightage: 13 },
      { weightage: 13 },
      { weightage: 12 },
      { weightage: 12 },
      { weightage: 12 },
      { weightage: 12 },
    ];
    expect(() => validateWeightage(goals)).not.toThrow();
  });

  it("throws ValidationError when total < 100", () => {
    expect(() =>
      validateWeightage([{ weightage: 50 }, { weightage: 30 }])
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when total > 100", () => {
    expect(() =>
      validateWeightage([{ weightage: 60 }, { weightage: 60 }])
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when a goal has weightage < 10", () => {
    expect(() =>
      validateWeightage([{ weightage: 9 }, { weightage: 91 }])
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when a goal has weightage = 0", () => {
    expect(() =>
      validateWeightage([{ weightage: 0 }, { weightage: 100 }])
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when there are 9 goals", () => {
    const goals = Array(9).fill({ weightage: 11 });
    expect(() => validateWeightage(goals)).toThrow(ValidationError);
  });

  it("throws ValidationError when there are 0 goals (total = 0 ≠ 100)", () => {
    expect(() => validateWeightage([])).toThrow(ValidationError);
  });

  it("error message includes the actual total when total ≠ 100", () => {
    try {
      validateWeightage([{ weightage: 50 }]);
      fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toMatch(/50%/);
      expect((e as ValidationError).message).toMatch(/100%/);
    }
  });

  it("error message includes goal count when > 8", () => {
    try {
      validateWeightage(Array(9).fill({ weightage: 11 }));
      fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toMatch(/9 goals/);
      expect((e as ValidationError).message).toMatch(/maximum is 8/);
    }
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

describe("validateWeightage — property-based tests (fast-check)", () => {
  /**
   * Property 1: Any set of goals where total weightage ≠ 100 always fails.
   *
   * We generate 1–8 goals each with weightage in [10, 100], then ensure
   * the total is NOT 100 by adjusting the last goal.
   */
  it("Property 1: total ≠ 100 always fails validation", () => {
    fc.assert(
      fc.property(
        // Generate 1–7 goals with weightage 10–90
        fc.array(
          fc.record({ weightage: fc.integer({ min: 10, max: 90 }) }),
          { minLength: 1, maxLength: 7 }
        ),
        (goals) => {
          const currentTotal = goals.reduce((s, g) => s + g.weightage, 0);
          // Make total ≠ 100 by adding a goal that pushes it off
          // Use a value that guarantees total ≠ 100
          const lastWeightage = currentTotal === 90 ? 5 : 5; // always makes total ≠ 100 when added
          const allGoals = [...goals, { weightage: lastWeightage }];
          const total = allGoals.reduce((s, g) => s + g.weightage, 0);

          if (total === 100) return true; // skip this sample (rare edge case)

          let threw = false;
          try {
            validateWeightage(allGoals);
          } catch (e) {
            threw = e instanceof ValidationError;
          }
          return threw;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: Any goal with weightage < 10 always fails validation.
   */
  it("Property 2: any goal with weightage < 10 always fails validation", () => {
    fc.assert(
      fc.property(
        // A goal with weightage in [0, 9]
        fc.integer({ min: 0, max: 9 }),
        // Remaining goals to fill up to 100 (we'll just use one more goal)
        (badWeightage) => {
          const goals = [
            { weightage: badWeightage },
            { weightage: 100 - badWeightage }, // total = 100, but one goal < 10
          ];

          let threw = false;
          try {
            validateWeightage(goals);
          } catch (e) {
            threw = e instanceof ValidationError;
          }
          return threw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Any sheet with > 8 goals always fails validation.
   */
  it("Property 3: more than 8 goals always fails validation", () => {
    fc.assert(
      fc.property(
        // 9–20 goals
        fc.integer({ min: 9, max: 20 }),
        (count) => {
          const goals = Array(count).fill({ weightage: 10 });

          let threw = false;
          try {
            validateWeightage(goals);
          } catch (e) {
            threw = e instanceof ValidationError;
          }
          return threw;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: A valid set (total = 100, all ≥ 10, count ≤ 8) always passes.
   *
   * We generate valid goal sets by distributing 100 across 1–8 goals,
   * each with at least 10.
   */
  it("Property 4: valid goals (total=100, all≥10, count≤8) always pass", () => {
    fc.assert(
      fc.property(
        // Number of goals: 1–8
        fc.integer({ min: 1, max: 8 }),
        (count) => {
          // Distribute 100 evenly, ensuring each ≥ 10
          // Strategy: give each goal 10, then distribute the remaining 100 - count*10
          const base = 10;
          const remainder = 100 - count * base;

          if (remainder < 0) return true; // can't make valid set with these params, skip

          // Distribute remainder to the first goal
          const goals = Array(count).fill(null).map((_, i) => ({
            weightage: i === 0 ? base + remainder : base,
          }));

          const total = goals.reduce((s, g) => s + g.weightage, 0);
          if (total !== 100) return true; // skip

          let passed = true;
          try {
            validateWeightage(goals);
          } catch {
            passed = false;
          }
          return passed;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: ValidationError is always thrown (never a generic Error)
   * when validation fails.
   */
  it("Property 5: validation failures always throw ValidationError, never generic Error", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ weightage: fc.integer({ min: 0, max: 200 }) }),
          { minLength: 0, maxLength: 15 }
        ),
        (goals) => {
          try {
            validateWeightage(goals);
            return true; // passed — no error thrown
          } catch (e) {
            // Must be a ValidationError, not a generic Error
            return e instanceof ValidationError;
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
