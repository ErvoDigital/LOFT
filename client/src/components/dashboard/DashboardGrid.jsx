import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { EyeOff, GripVertical } from "lucide-react";
import { COLS, ROW_PX, WIDGET_BY_ID, nudge, rows, stackOrder } from "./dashboardLayout.js";

const GRID_CONFIG = { cols: COLS, rowHeight: ROW_PX, margin: [0, 0], containerPadding: [0, 0] };
const RESIZE_HANDLES = ["se"];
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export const MOVE_HINT_ID = "dashboard-move-hint";

const strip = ({ i, x, y, w, h }) => ({ i, x, y, w, h });

// Reports a fit widget's natural height in grid rows. The wrapper has no
// height of its own, so the widget inside lays out at its content height
// whatever size the grid cell is.
function FitMeasure({ id, onRows, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const report = () => onRows(id, rows(el.offsetHeight));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onRows]);
  return <div ref={ref}>{children}</div>;
}

// Laid over each widget while editing: the whole frame is the drag surface,
// the name chip doubles as the keyboard handle, and Hide removes the widget.
// Both chips sit on the dashed border, over the card's own top padding, so
// they don't cover what's inside.
function EditFrame({ spec, onHide, onKeyDown }) {
  return (
    <div
      className={`absolute inset-0 z-10 cursor-grab border-2 border-dashed border-brand-400/70 bg-brand-500/[0.06] active:cursor-grabbing dark:border-brand-400/50 ${
        spec.radius || "rounded-2xl"
      }`}
    >
      <button
        type="button"
        onKeyDown={onKeyDown}
        aria-describedby={MOVE_HINT_ID}
        className="absolute -top-3 left-4 inline-flex max-w-[calc(100%-7.5rem)] cursor-grab items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-800 shadow-glass ring-1 ring-ink-900/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing dark:bg-ink-800 dark:text-ink-100 dark:ring-white/10"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        <span className="sr-only">Move </span>
        <span className="truncate">{spec.title}</span>
      </button>
      <button
        type="button"
        onClick={onHide}
        className="dash-no-drag absolute -top-3 right-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 shadow-glass ring-1 ring-ink-900/[0.08] transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-ink-800 dark:text-ink-300 dark:ring-white/10 dark:hover:text-red-400"
      >
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        Hide<span className="sr-only"> {spec.title}</span>
      </button>
    </div>
  );
}

// The dashboard's widget area. On a wide enough container it's a
// react-grid-layout grid that can be dragged and resized while `editing`;
// narrower than that, the same widgets stack in reading order.
export default function DashboardGrid({ width, gridMode, items, editing, render, onChange, onHide, onAnnounce }) {
  const [fitRows, setFitRows] = useState({});
  // Heights measured mid-drag are held back until the drop, since feeding
  // the grid a new layout while it's tracking a pointer resets the gesture.
  const interacting = useRef(false);
  const pending = useRef(null);

  const reportRows = useCallback((id, count) => {
    if (interacting.current) {
      pending.current = { ...pending.current, [id]: count };
      return;
    }
    setFitRows((prev) => (prev[id] === count ? prev : { ...prev, [id]: count }));
  }, []);

  const startInteraction = useCallback(() => {
    interacting.current = true;
  }, []);
  const stopInteraction = useCallback(() => {
    interacting.current = false;
    if (!pending.current) return;
    const held = pending.current;
    pending.current = null;
    setFitRows((prev) => ({ ...prev, ...held }));
  }, []);

  const layout = useMemo(
    () =>
      items.map((it) => {
        const spec = WIDGET_BY_ID[it.i];
        if (spec.fit) {
          const h = fitRows[it.i] ?? it.h;
          return { ...it, h, minW: spec.minW, minH: h, maxH: h, resizeHandles: ["e"] };
        }
        return { ...it, minW: spec.minW, minH: spec.minH, resizeHandles: RESIZE_HANDLES };
      }),
    [items, fitRows]
  );

  const dragConfig = useMemo(() => ({ enabled: editing, cancel: ".dash-no-drag" }), [editing]);
  const resizeConfig = useMemo(() => ({ enabled: editing, handles: RESIZE_HANDLES }), [editing]);

  // Outside editing the grid still repacks (a fit widget grows, the clash
  // panel comes and goes), but only an edit changes what's saved.
  const handleLayoutChange = useCallback(
    (next) => {
      if (editing) onChange(next.map(strip));
    },
    [editing, onChange]
  );

  const handleKey = (id) => (e) => {
    if (!ARROWS.has(e.key)) return;
    e.preventDefault();
    const next = nudge(layout, id, e.key, e.shiftKey).map(strip);
    onChange(next);
    onAnnounce?.(`${WIDGET_BY_ID[id].title} ${e.shiftKey ? "resized" : "moved"}`);
  };

  if (!gridMode) {
    return (
      <div className="space-y-6 p-3">
        {stackOrder(items).map((it) => (
          <div key={it.i}>{render(it.i, editing)}</div>
        ))}
      </div>
    );
  }

  return (
    <ReactGridLayout
      width={width}
      layout={layout}
      gridConfig={GRID_CONFIG}
      dragConfig={dragConfig}
      resizeConfig={resizeConfig}
      compactor={verticalCompactor}
      onLayoutChange={handleLayoutChange}
      onDragStart={startInteraction}
      onDragStop={stopInteraction}
      onResizeStart={startInteraction}
      onResizeStop={stopInteraction}
      className={`dash-grid${editing ? " is-editing" : ""}`}
    >
      {layout.map((it) => {
        const spec = WIDGET_BY_ID[it.i];
        const body = render(it.i, editing);
        return (
          <div key={it.i} className="dash-item">
            <div className="dash-frame relative h-full">
              {/* inert while editing: links and inputs underneath would
                  otherwise steal the drag or take keyboard focus. */}
              <div
                className={`h-full transition-opacity ${editing ? "select-none opacity-70" : ""}`}
                {...(editing ? { inert: "" } : {})}
              >
                {spec.fit ? (
                  <FitMeasure id={it.i} onRows={reportRows}>
                    {body}
                  </FitMeasure>
                ) : (
                  body
                )}
              </div>
              {editing && <EditFrame spec={spec} onHide={() => onHide(it.i)} onKeyDown={handleKey(it.i)} />}
            </div>
          </div>
        );
      })}
    </ReactGridLayout>
  );
}
