import { useState } from "react";

const MAX = 8;
const CELLS = Array.from({ length: MAX * MAX }, (_, i) => ({ row: Math.floor(i / MAX) + 1, col: (i % MAX) + 1 }));

export default function TableGridPicker({ onInsert }) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  return (
    <div className="p-2">
      {/* Fixed-size columns, not grid-cols-8's `fr` tracks — `fr` can't
          resolve a size inside this flyout's shrink-to-fit width (it's
          `position: absolute` with no explicit width), so tracks collapsed
          to ~2px and the fixed 16px cells overlapped instead of tiling. */}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(8, 1rem)" }}>
        {CELLS.map(({ row, col }) => {
          const active = row <= hover.rows && col <= hover.cols;
          return (
            <div
              key={`${row}-${col}`}
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onClick={() => onInsert(row, col)}
              className={`h-4 w-4 cursor-pointer border ${active ? "border-brand-500 bg-brand-100" : "border-ink-200 bg-white"}`}
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-xs text-ink-400">{hover.rows > 0 ? `${hover.rows} × ${hover.cols}` : "Insert table"}</p>
    </div>
  );
}
