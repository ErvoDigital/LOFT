import { useState } from "react";

const MAX = 8;
const CELLS = Array.from({ length: MAX * MAX }, (_, i) => ({ row: Math.floor(i / MAX) + 1, col: (i % MAX) + 1 }));

export default function TableGridPicker({ onInsert }) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  return (
    <div className="p-2">
      <div className="grid grid-cols-8 gap-0.5">
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
