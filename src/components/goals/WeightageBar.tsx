"use client";

/**
 * WeightageBar — shows a live running total of goal weightages.
 *
 * Colour coding:
 *   - Red   when total < 100
 *   - Green when total = 100
 *   - Red   when total > 100
 */

interface WeightageBarProps {
  /** Current sum of all goal weightages (0–∞) */
  total: number;
}

export default function WeightageBar({ total }: WeightageBarProps) {
  const clamped = Math.min(total, 100);
  const isExact = total === 100;
  const isOver = total > 100;

  const barColor = isExact
    ? "bg-green-500"
    : "bg-red-500";

  const textColor = isExact
    ? "text-green-700"
    : "text-red-700";

  const label = isExact
    ? "Total weightage: 100% ✓"
    : isOver
    ? `Total weightage: ${total}% — exceeds 100%`
    : `Total weightage: ${total}% — must reach 100%`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className={textColor}>{label}</span>
        <span className="text-muted-foreground text-xs">
          {isExact ? "" : `${100 - total > 0 ? `${100 - total}% remaining` : `${total - 100}% over`}`}
        </span>
      </div>

      {/* Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={total}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Weightage total: ${total}%`}
        />
      </div>

      {/* Over-limit indicator */}
      {isOver && (
        <p className="text-xs text-red-600" role="alert">
          Total weightage exceeds 100%. Please reduce goal weightages by{" "}
          {total - 100}%.
        </p>
      )}
    </div>
  );
}
