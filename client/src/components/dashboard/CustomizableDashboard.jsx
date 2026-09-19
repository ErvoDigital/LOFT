import { useCallback, useMemo, useState } from "react";
import { useContainerWidth } from "react-grid-layout";
import { Check, LayoutDashboard, Pencil } from "lucide-react";
import DashboardGrid, { MOVE_HINT_ID } from "./DashboardGrid.jsx";
import WidgetPicker from "./WidgetPicker.jsx";
import { GRID_MIN_WIDTH, defaultLayout, loadLayout, saveLayout } from "./dashboardLayout.js";

function mergeItems(items, changed) {
  const byId = new Map(changed.map((it) => [it.i, it]));
  return items.map((it) => byId.get(it.i) || it);
}

function sameItems(a, b) {
  const byId = new Map(b.map((it) => [it.i, it]));
  return (
    a.length === b.length &&
    a.every((it) => {
      const o = byId.get(it.i);
      return o && o.x === it.x && o.y === it.y && o.w === it.w && o.h === it.h;
    })
  );
}

// The dashboard's widget area plus the controls that customize it: the
// Widgets menu (which widgets show) and Edit layout (drag, resize, then save
// or cancel). Choices are saved per user on this device.
//
// `render(id, editing)` draws a widget's content. `isAvailable(id, editing)`
// can drop a widget that has nothing to show right now; the Clashes widget
// uses it so it only takes space when there's a clash.
export default function CustomizableDashboard({ userId, render, isAvailable }) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const gridMode = width >= GRID_MIN_WIDTH;

  const [saved, setSaved] = useState(() => loadLayout(userId, window.innerWidth));
  const [draft, setDraft] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const editing = draft !== null;

  const fallback = useMemo(() => defaultLayout(width), [width]);
  const current = draft || saved || fallback;

  const visibleItems = useMemo(
    () => current.items.filter((it) => !current.hidden.includes(it.i) && isAvailable(it.i, editing)),
    [current, isAvailable, editing]
  );

  const commit = (next) => {
    setSaved(next);
    saveLayout(userId, next);
  };

  // Outside editing a visibility change saves straight away. While editing
  // it joins the draft, so Cancel undoes it along with everything else.
  const updateHidden = (fn) => {
    const apply = (layout) => ({ ...layout, hidden: fn(layout.hidden) });
    if (editing) setDraft(apply);
    else commit(apply(current));
  };
  const toggle = (id, isShown) => updateHidden((hidden) => (isShown ? [...hidden, id] : hidden.filter((h) => h !== id)));
  const showAll = () => updateHidden(() => []);

  const handleChange = useCallback((changed) => {
    setDraft((d) => {
      if (!d) return d;
      const items = mergeItems(d.items, changed);
      return sameItems(items, d.items) ? d : { ...d, items };
    });
  }, []);

  const startEditing = () => {
    setDraft({ items: current.items.map((it) => ({ ...it })), hidden: [...current.hidden] });
    setAnnouncement("Editing layout");
  };
  const save = () => {
    commit(draft);
    setDraft(null);
    setAnnouncement("Layout saved");
  };
  const cancel = () => {
    setDraft(null);
    setAnnouncement("Changes discarded");
  };
  const reset = () => {
    setDraft(defaultLayout(width));
    setAnnouncement("Layout reset to the default. Save to keep it.");
  };

  return (
    <div>
      {editing ? (
        <div className="sticky top-3 z-30 mb-1 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-brand-400/40 bg-white/90 px-4 py-3 shadow-glass-lg backdrop-blur-xl dark:border-brand-400/25 dark:bg-ink-900/90">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Editing layout</p>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              {gridMode
                ? "Drag a widget to move it. Drag the dotted corner or side grip to resize it."
                : "Widen the window to move and resize widgets. You can still choose which ones show."}
            </p>
            <p id={MOVE_HINT_ID} className="sr-only">
              Arrow keys move this widget. Shift plus arrow keys resize it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WidgetPicker hidden={current.hidden} onToggle={toggle} onShowAll={showAll} />
            <button type="button" onClick={reset} className="btn-ghost px-3 py-1.5 text-xs">
              Reset to default
            </button>
            <button type="button" onClick={cancel} className="btn-secondary px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="button" onClick={save} className="btn-primary px-3 py-1.5 text-xs">
              <Check className="h-3.5 w-3.5" /> Save layout
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
          <WidgetPicker hidden={current.hidden} onToggle={toggle} onShowAll={showAll} />
          {gridMode && (
            <button type="button" onClick={startEditing} className="btn-secondary px-3 py-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Edit layout
            </button>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* -mx-3 because every grid item pads itself by 12px: card edges then
          line up with the page's own padding. */}
      <div ref={containerRef} className="-mx-3">
        {mounted &&
          (visibleItems.length > 0 ? (
            <DashboardGrid
              width={width}
              gridMode={gridMode}
              items={visibleItems}
              editing={editing}
              render={render}
              onChange={handleChange}
              onHide={(id) => toggle(id, true)}
              onAnnounce={setAnnouncement}
            />
          ) : (
            <div className="m-3 card flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Nothing on your dashboard</p>
              <p className="mt-1 max-w-sm text-xs text-ink-500 dark:text-ink-400">
                Every widget is switched off. Turn some back on from Widgets, or bring them all back at once.
              </p>
              <button type="button" onClick={showAll} className="btn-secondary mt-4 px-3 py-1.5 text-xs">
                Show all widgets
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
