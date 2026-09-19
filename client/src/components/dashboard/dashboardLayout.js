import { verticalCompactor } from "react-grid-layout";

// The customizable dashboard's model: which widgets exist, where they sit by
// default, and how a user's arrangement is stored.
//
// Positions are react-grid-layout units: 12 columns across, and rows of
// ROW_PX pixels. Rows are that fine because the grid has no margins of its
// own. Each item pads itself by ITEM_GUTTER instead, so a card's height can
// track its content almost to the pixel.
export const COLS = 12;
export const ROW_PX = 4;
export const ITEM_GUTTER = 12;

// Below this container width the widgets stack in one column in saved order
// and can't be dragged, since twelve columns would be too narrow to aim at.
export const GRID_MIN_WIDTH = 900;
// At or above this width the default puts lists in a right-hand rail.
const WIDE_MIN_WIDTH = 1400;

export const rows = (px) => Math.ceil((px + ITEM_GUTTER * 2) / ROW_PX);

// `fit` widgets are summaries whose height always matches their content, so
// only their width can change. The rest are list panels that scroll inside
// whatever height the user gives them.
export const WIDGETS = [
  { id: "overview", title: "Overview", description: "Greeting and your next 14 days", fit: true, minW: 5, radius: "rounded-3xl" },
  { id: "metrics", title: "At a glance", description: "Due today, overdue, meetings and open tasks", fit: true, minW: 4 },
  { id: "clashes", title: "Clashes", description: "Appears only when two things collide", fit: true, minW: 4 },
  { id: "agenda", title: "Coming up", description: "Meetings and deadlines, day by day", minW: 3, minH: rows(200) },
  { id: "priorities", title: "Your priorities", description: "Tasks assigned to you, most urgent first", minW: 3, minH: rows(200) },
  { id: "workspaces", title: "Workspaces", description: "Each workspace and what it needs from you", minW: 3, minH: rows(150) },
  { id: "activity", title: "Recent activity", description: "Latest messages across your workspaces", minW: 3, minH: rows(150) },
  { id: "files", title: "Documents & files", description: "Recently updated files, searchable", minW: 3, minH: rows(180) },
];

export const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

const place = (i, x, y, w, heightPx) => ({ i, x, y, w, h: rows(heightPx) });

// Fit widgets' heights here are only first guesses; they're measured once
// they render. The y values just set the order, since the grid packs items
// upward.
const WIDE = [
  place("overview", 0, 0, 9, 276),
  place("metrics", 0, 1, 9, 134),
  place("clashes", 0, 2, 9, 180),
  place("agenda", 0, 3, 5, 500),
  place("priorities", 5, 3, 4, 500),
  place("workspaces", 9, 0, 3, 250),
  place("activity", 9, 1, 3, 290),
  place("files", 9, 2, 3, 420),
];

const MEDIUM = [
  place("overview", 0, 0, 12, 410),
  place("metrics", 0, 1, 12, 134),
  place("clashes", 0, 2, 12, 180),
  place("agenda", 0, 3, 8, 500),
  place("priorities", 8, 3, 4, 500),
  place("workspaces", 0, 4, 4, 330),
  place("activity", 4, 4, 4, 330),
  place("files", 8, 4, 4, 330),
];

// Until a user saves an arrangement, the default follows the screen it's
// shown on. Once saved, their layout is used at every width.
export function defaultLayout(width) {
  const items = width >= WIDE_MIN_WIDTH ? WIDE : MEDIUM;
  return { items: verticalCompactor.compact(items.map((it) => ({ ...it })), COLS), hidden: [] };
}

// Per device, like the theme color, and per user, so a shared computer keeps
// everyone's arrangement apart. v1 = 12 columns of 4px rows; a change to
// either needs a new version rather than a reinterpretation of old saves.
const STORE_VERSION = 1;
const storageKey = (userId) => `loft:dashboard-layout:${userId}`;

function clampItem(item) {
  const spec = WIDGET_BY_ID[item.i];
  const w = Math.min(Math.max(Math.round(item.w) || spec.minW, spec.minW), COLS);
  return {
    i: item.i,
    w,
    x: Math.min(Math.max(Math.round(item.x) || 0, 0), COLS - w),
    y: Math.max(Math.round(item.y) || 0, 0),
    h: Math.max(Math.round(item.h) || 1, spec.minH || 1),
  };
}

// Tolerates saves from older builds: unknown widgets are dropped, and
// widgets added since then join at the bottom.
function normalize(stored, width) {
  const seen = new Set();
  const items = [];
  for (const it of stored.items || []) {
    if (!WIDGET_BY_ID[it?.i] || seen.has(it.i)) continue;
    seen.add(it.i);
    items.push(clampItem(it));
  }
  const floor = items.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  for (const it of defaultLayout(width).items) {
    if (!seen.has(it.i)) items.push({ ...it, y: floor + it.y });
  }
  const hidden = (stored.hidden || []).filter((id) => WIDGET_BY_ID[id]);
  return { items, hidden: [...new Set(hidden)] };
}

export function loadLayout(userId, width) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored?.v !== STORE_VERSION) return null;
    return normalize(stored, width);
  } catch {
    return null;
  }
}

export function saveLayout(userId, layout) {
  if (!userId) return;
  const items = layout.items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ v: STORE_VERSION, items, hidden: layout.hidden }));
  } catch {
    // Storage full or blocked. The layout still applies for this visit.
  }
}

// The reading order when widgets stack in one column: top to bottom, then
// left to right.
export function stackOrder(items) {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

const overlapsX = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;

// Keyboard moves and resizes, for anyone not using a pointer. Up and Down
// swap places with the nearest widget above or below; Left and Right shift
// one column. With Shift they resize instead: one column, or 40px of height.
// The compactor settles everything afterwards, the same way it does after a
// drag.
export function nudge(layout, id, key, resize) {
  const items = layout.map((it) => ({ ...it }));
  const me = items.find((it) => it.i === id);
  if (!me) return layout;
  const spec = WIDGET_BY_ID[id];

  if (resize) {
    if (key === "ArrowLeft") me.w = Math.max(me.w - 1, spec.minW);
    if (key === "ArrowRight") me.w = Math.min(me.w + 1, COLS - me.x);
    if (!spec.fit) {
      const step = 40 / ROW_PX;
      if (key === "ArrowUp") me.h = Math.max(me.h - step, spec.minH || 1);
      if (key === "ArrowDown") me.h += step;
    }
  } else if (key === "ArrowLeft" || key === "ArrowRight") {
    me.x = Math.min(Math.max(me.x + (key === "ArrowLeft" ? -1 : 1), 0), COLS - me.w);
  } else {
    const others = items.filter((it) => it !== me && overlapsX(it, me));
    if (key === "ArrowUp") {
      const above = others.filter((it) => it.y < me.y).sort((a, b) => b.y - a.y)[0];
      if (!above) return layout;
      // A tie on y would fall back to x order, so the one moving up gets the
      // lower value and the compactor pushes the other below it.
      me.y = above.y;
      above.y = above.y + 1;
    } else {
      const below = others.filter((it) => it.y > me.y).sort((a, b) => a.y - b.y)[0];
      if (!below) return layout;
      below.y = me.y;
      me.y = me.y + 1;
    }
  }
  return verticalCompactor.compact(items, COLS);
}
