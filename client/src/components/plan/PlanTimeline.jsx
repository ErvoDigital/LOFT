import { Fragment } from "react";
import PlanDayGroup, { LANE_GRID } from "./PlanDayGroup.jsx";

// A stretch of days with nothing due, marked on the spine so skipping from
// Tomorrow to next Thursday reads as a gap rather than consecutive days.
function ClearDays({ count }) {
  return (
    <li className={`${LANE_GRID} items-center`}>
      <div className="hidden justify-center sm:flex" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-ink-300 dark:bg-ink-600" />
      </div>
      <p className="px-2 text-center text-xs font-medium text-ink-400 dark:text-ink-500 sm:text-left">
        {count} clear day{count === 1 ? "" : "s"}
      </p>
    </li>
  );
}

// Day by day, top to bottom: overdue, today, tomorrow, then each later date
// that has something due, then tasks with no due date.
export default function PlanTimeline({ lanes, ...laneProps }) {
  return (
    <ol className="relative space-y-4">
      {/* The spine the date tiles hang on, through the middle of the tile
          column. Phones have no tile column, so no spine either. */}
      <span
        className="pointer-events-none absolute bottom-8 left-8 top-8 hidden w-px bg-gradient-to-b from-brand-500/50 via-ink-900/10 to-ink-900/5 dark:via-white/10 dark:to-white/5 sm:block"
        aria-hidden="true"
      />
      {lanes.map((lane) => (
        <Fragment key={lane.key}>
          {lane.clearDays > 0 && <ClearDays count={lane.clearDays} />}
          <PlanDayGroup lane={lane} {...laneProps} />
        </Fragment>
      ))}
    </ol>
  );
}
