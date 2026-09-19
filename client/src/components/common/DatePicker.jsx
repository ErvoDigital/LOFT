import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, CalendarDays } from "lucide-react";
import useFloatingPanel from "./useFloatingPanel.js";
import { ChoiceDots, OPEN_RING, TRIGGER } from "./Select.jsx";

// Themed replacements for <input type="date">, "datetime-local" and "month".
// The native pickers are drawn by the browser: they ignore dark mode and the
// theme color, and navigate with arrow glyphs the design system doesn't use.
// These keep the native value strings ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm"), so
// callers' state and API code stay as they were.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; // Sunday first, like MonthGrid
const TIME_STEP = 15;

const pad = (n) => String(n).padStart(2, "0");
const toDateValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function parseTime(value) {
  const m = /T(\d{2}):(\d{2})/.exec(value || "");
  return m ? { h: +m[1], m: +m[2] } : null;
}

const sameDay = (a, b) => !!a && !!b && a.toDateString() === b.toDateString();
const sameMonth = (a, b) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Same day-of-month in another month, clamped (Jan 31 + 1 month = Feb 28).
function shiftMonth(d, n) {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
}

const monthLabel = (d, month = "long") =>
  d.toLocaleDateString([], { month, ...(month === "long" ? { year: "numeric" } : {}) });
const timeLabel = ({ h, m }) => new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function formatDate(d) {
  const opts = { weekday: "short", month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString([], opts);
}

// ---- Shared pieces --------------------------------------------------------------

const NAV_BUTTON =
  "rounded-lg px-2 py-1 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-300 dark:hover:bg-white/[0.08] dark:hover:text-ink-50";

const FOOTER_BUTTON =
  "rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300";

const CELL_FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-800";

function cellTone({ selected, current, dim }) {
  if (selected) return "brand-mark font-semibold text-white shadow-glow-sm";
  if (current) return "font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300";
  if (dim) return "text-ink-400 hover:bg-ink-900/[0.04] dark:text-ink-500 dark:hover:bg-white/[0.05]";
  return "text-ink-800 hover:bg-ink-900/[0.06] dark:text-ink-100 dark:hover:bg-white/[0.08]";
}

// Neighbouring months/years are named, not pointed at: the design system has
// no arrow glyphs, and "Aug · Oct" says exactly where each button goes.
function NavPair({ prev, next, prevLabel, nextLabel, onPrev, onNext }) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={NAV_BUTTON}>
        {prev}
      </button>
      <span className="text-ink-300 dark:text-ink-600" aria-hidden="true">
        ·
      </span>
      <button type="button" onClick={onNext} aria-label={nextLabel} className={NAV_BUTTON}>
        {next}
      </button>
    </div>
  );
}

function FieldTrigger({ triggerRef, id, open, onToggle, Icon, text, placeholder, className, disabled, ariaLabel }) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !open) {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`${TRIGGER.md} ${open ? OPEN_RING : ""} ${className}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${open ? "text-brand-600 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"}`} />
      <span className={`min-w-0 flex-1 truncate ${text ? "" : "text-ink-500 dark:text-ink-400"}`}>{text || placeholder}</span>
    </button>
  );
}

// Lets `required` keep working: the browser validates this invisible twin and
// anchors its "fill out this field" bubble at the field's corner.
function RequiredTwin({ value }) {
  return (
    <input
      tabIndex={-1}
      aria-hidden="true"
      required
      value={value || ""}
      onChange={() => {}}
      className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
    />
  );
}

function PickerPanel({ open, onClose, triggerRef, align, label, relayoutKey, children }) {
  const panelRef = useRef(null);
  const { style, place } = useFloatingPanel({ open, triggerRef, panelRef, onClose, align });

  // Content switches (days ↔ months) can change the panel's size.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, relayoutKey, place]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={style}
      onKeyDown={(e) => {
        // Only the picker closes — the Modal listens for Escape on document.
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose(true);
        }
      }}
      onBlur={(e) => {
        // Tabbing out closes it; clicks on the panel's own padding (no
        // relatedTarget) don't.
        const to = e.relatedTarget;
        if (to && !e.currentTarget.contains(to) && !triggerRef.current?.contains(to)) onClose();
      }}
      className="dropdown-panel fixed z-[60] !bg-white p-3 ring-1 ring-ink-900/[0.06] motion-safe:animate-[fade-in_0.12s_ease-out] dark:!bg-ink-800 dark:ring-0"
    >
      {children}
    </div>,
    document.body
  );
}

// Moves DOM focus to the `data-focus` cell after keyboard navigation, and on
// first open once the panel has been placed (it's hidden until then).
function useRovingFocus(containerRef, deps, { initial = true } = {}) {
  const pending = useRef(initial ? "initial" : false);
  useEffect(() => {
    if (!pending.current) return;
    const run = () => containerRef.current?.querySelector('[data-focus="true"]')?.focus();
    if (pending.current === "initial") requestAnimationFrame(run);
    else run();
    pending.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return () => (pending.current = true);
}

// ---- Month grid (month picker, and the calendar's month/year view) --------------

function MonthGrid({ year, selected, onPick, onYear, focusMonth, setFocusMonth }) {
  const ref = useRef(null);
  const requestFocus = useRovingFocus(ref, [focusMonth, year]);
  const today = new Date();

  function onKeyDown(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = focusMonth + step;
    requestFocus();
    if (next < 0 || next > 11) {
      onYear(next < 0 ? -1 : 1);
      setFocusMonth((next + 12) % 12);
    } else setFocusMonth(next);
  }

  return (
    <div className="w-[17rem]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="px-1 text-sm font-semibold text-ink-900 dark:text-ink-50">{year}</p>
        <NavPair
          prev={year - 1}
          next={year + 1}
          prevLabel={`Previous year, ${year - 1}`}
          nextLabel={`Next year, ${year + 1}`}
          onPrev={() => onYear(-1)}
          onNext={() => onYear(1)}
        />
      </div>
      <div ref={ref} role="grid" aria-label={String(year)} className="grid grid-cols-3 gap-1.5" onKeyDown={onKeyDown}>
        {Array.from({ length: 12 }, (_, m) => {
          const date = new Date(year, m, 1);
          const isSelected = sameMonth(date, selected);
          const isCurrent = sameMonth(date, today);
          return (
            <button
              key={m}
              type="button"
              role="gridcell"
              tabIndex={m === focusMonth ? 0 : -1}
              data-focus={m === focusMonth}
              aria-selected={isSelected}
              aria-current={isCurrent ? "date" : undefined}
              aria-label={monthLabel(date)}
              onClick={() => onPick(date)}
              className={`relative flex h-11 items-center justify-center rounded-xl text-sm transition-colors ${CELL_FOCUS} ${cellTone({
                selected: isSelected,
                current: isCurrent,
              })}`}
            >
              {date.toLocaleDateString([], { month: "short" })}
              {isCurrent && !isSelected && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Calendar -------------------------------------------------------------------

function Calendar({ selected, onSelect, onViewChange }) {
  const [focusDay, setFocusDay] = useState(() => selected || new Date());
  const [view, setView] = useState("days");
  const gridRef = useRef(null);
  const requestFocus = useRovingFocus(gridRef, [focusDay, view]);
  const today = new Date();

  useEffect(() => onViewChange?.(view), [view, onViewChange]);

  if (view === "months") {
    return (
      <MonthGrid
        year={focusDay.getFullYear()}
        selected={selected}
        focusMonth={focusDay.getMonth()}
        setFocusMonth={(m) =>
          setFocusDay((d) => shiftMonth(d, (typeof m === "function" ? m(d.getMonth()) : m) - d.getMonth()))
        }
        onYear={(delta) => setFocusDay((d) => shiftMonth(d, delta * 12))}
        onPick={(month) => {
          requestFocus();
          setFocusDay((d) => shiftMonth(d, (month.getFullYear() - d.getFullYear()) * 12 + month.getMonth() - d.getMonth()));
          setView("days");
        }}
      />
    );
  }

  const first = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const prev = shiftMonth(focusDay, -1);
  const next = shiftMonth(focusDay, 1);

  function onKeyDown(e) {
    const days = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let target;
    if (days !== undefined) target = addDays(focusDay, days);
    else if (e.key === "PageUp") target = shiftMonth(focusDay, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") target = shiftMonth(focusDay, e.shiftKey ? 12 : 1);
    else if (e.key === "Home") target = addDays(focusDay, -focusDay.getDay());
    else if (e.key === "End") target = addDays(focusDay, 6 - focusDay.getDay());
    else return;
    e.preventDefault();
    requestFocus();
    setFocusDay(target);
  }

  return (
    <div className="w-[17rem]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            requestFocus();
            setView("months");
          }}
          aria-label={`${monthLabel(focusDay)}, choose another month`}
          className={`-ml-1 flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-900/[0.06] dark:text-ink-50 dark:hover:bg-white/[0.08] ${CELL_FOCUS}`}
        >
          {monthLabel(focusDay)}
          <ChoiceDots open={false} />
        </button>
        <NavPair
          prev={prev.toLocaleDateString([], { month: "short" })}
          next={next.toLocaleDateString([], { month: "short" })}
          prevLabel={`Previous month, ${monthLabel(prev)}`}
          nextLabel={`Next month, ${monthLabel(next)}`}
          onPrev={() => setFocusDay(prev)}
          onNext={() => setFocusDay(next)}
        />
      </div>

      <div ref={gridRef} role="grid" aria-label={monthLabel(focusDay)} onKeyDown={onKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              role="columnheader"
              className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400"
            >
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].toISOString()} role="row" className="grid grid-cols-7">
            {week.map((day) => {
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const isFocus = sameDay(day, focusDay);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  tabIndex={isFocus ? 0 : -1}
                  data-focus={isFocus}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  onClick={() => {
                    setFocusDay(day);
                    onSelect(day);
                  }}
                  className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm tabular-nums transition-colors ${CELL_FOCUS} ${cellTone(
                    { selected: isSelected, current: isToday, dim: !sameMonth(day, focusDay) }
                  )}`}
                >
                  {day.getDate()}
                  {isToday && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Time column ----------------------------------------------------------------

function TimeColumn({ value, onPick }) {
  const listRef = useRef(null);
  const slots = useMemo(() => {
    const list = [];
    for (let t = 0; t < 24 * 60; t += TIME_STEP) list.push({ h: Math.floor(t / 60), m: t % 60 });
    // Keep an off-grid saved time (10:07) pickable rather than silently rounding it.
    if (value && value.m % TIME_STEP) {
      list.push(value);
      list.sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    }
    return list;
  }, [value]);
  const isSelected = (s) => !!value && s.h === value.h && s.m === value.m;

  // Centre the chosen time on open. scrollTop rather than scrollIntoView,
  // which would also scroll the page while the panel is still being placed.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector('[aria-selected="true"]') || list?.querySelector('[data-slot="36"]'); // 9:00
    if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = [...listRef.current.querySelectorAll("button")];
    const i = buttons.indexOf(document.activeElement);
    buttons[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), buttons.length - 1)]?.focus();
  }

  return (
    <div className="flex w-[6.75rem] flex-col border-l border-ink-900/[0.07] pl-3 dark:border-white/[0.08]">
      <p className="mb-2 px-1 py-1 text-sm font-semibold text-ink-900 dark:text-ink-50">Time</p>
      {/* Absolutely filled so the 96 slots don't set the panel's height — the
          calendar beside it does. */}
      <div className="relative flex-1">
        <div
          ref={listRef}
          role="listbox"
          aria-label="Time"
          onKeyDown={onKeyDown}
          className="absolute inset-0 space-y-0.5 overflow-y-auto py-3 pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_14px,black_calc(100%-14px),transparent)]"
        >
          {slots.map((s, i) => (
            <button
              key={`${s.h}:${s.m}`}
              type="button"
              role="option"
              data-slot={i}
              aria-selected={isSelected(s)}
              tabIndex={isSelected(s) || (!value && i === 36) ? 0 : -1}
              onClick={() => onPick(s)}
              className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs tabular-nums transition-colors ${CELL_FOCUS} ${cellTone({
                selected: isSelected(s),
              })}`}
            >
              {timeLabel(s)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Public pickers ---------------------------------------------------------------

function usePickerState() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus === true) triggerRef.current?.focus();
  }, []);
  return { open, setOpen, triggerRef, close };
}

// value/onChange: "YYYY-MM-DD", or "" for none.
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  clearable = false,
  required = false,
  disabled = false,
  align = "start",
  className = "",
  "aria-label": ariaLabel,
}) {
  const { open, setOpen, triggerRef, close } = usePickerState();
  const [view, setView] = useState("days");
  const selected = parseDate(value);

  const pick = (day) => {
    onChange(toDateValue(day));
    close(true);
  };

  return (
    <div className="relative">
      <FieldTrigger
        triggerRef={triggerRef}
        id={id}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        Icon={CalendarDays}
        text={selected ? formatDate(selected) : ""}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        ariaLabel={ariaLabel}
      />
      {required && <RequiredTwin value={value} />}
      <PickerPanel open={open} onClose={close} triggerRef={triggerRef} align={align} label="Choose a date" relayoutKey={view}>
        <Calendar selected={selected} onSelect={pick} onViewChange={setView} />
        <div className="mt-2 flex items-center justify-between border-t border-ink-900/[0.07] pt-2 dark:border-white/[0.08]">
          {clearable && value ? (
            <button
              type="button"
              className={FOOTER_BUTTON}
              onClick={() => {
                onChange("");
                close(true);
              }}
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <button type="button" className={FOOTER_BUTTON} onClick={() => pick(new Date())}>
            Today
          </button>
        </div>
      </PickerPanel>
    </div>
  );
}

// value/onChange: "YYYY-MM-DDTHH:mm", the datetime-local format.
export function DateTimePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date and time",
  required = false,
  disabled = false,
  align = "start",
  className = "",
  "aria-label": ariaLabel,
}) {
  const { open, setOpen, triggerRef, close } = usePickerState();
  const [view, setView] = useState("days");
  const date = parseDate(value);
  const time = parseTime(value);
  const text = date && time ? `${formatDate(date)} · ${timeLabel(time)}` : "";

  const emit = (d, t) => onChange(`${toDateValue(d)}T${pad(t.h)}:${pad(t.m)}`);

  return (
    <div className="relative">
      <FieldTrigger
        triggerRef={triggerRef}
        id={id}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        Icon={CalendarClock}
        text={text}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        ariaLabel={ariaLabel}
      />
      {required && <RequiredTwin value={value} />}
      <PickerPanel
        open={open}
        onClose={close}
        triggerRef={triggerRef}
        align={align}
        label="Choose a date and time"
        relayoutKey={view}
      >
        <div className="flex gap-3">
          <Calendar selected={date} onSelect={(d) => emit(d, time || { h: 9, m: 0 })} onViewChange={setView} />
          {view === "days" && <TimeColumn value={time} onPick={(t) => emit(date || new Date(), t)} />}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink-900/[0.07] pt-2.5 dark:border-white/[0.08]">
          <p className="min-w-0 truncate px-1 text-xs font-medium text-ink-600 dark:text-ink-300">{text || "No time chosen"}</p>
          <button type="button" className="btn-primary shrink-0 !rounded-lg !px-3 !py-1.5 !text-xs" onClick={() => close(true)}>
            Done
          </button>
        </div>
      </PickerPanel>
    </div>
  );
}

// A page's month heading that opens a month grid. value/onChange: a Date on
// the first of the month. Inherits font size and colour from its parent, so
// it drops into an existing <h2>.
export function MonthPicker({ value, onChange, align = "start", className = "" }) {
  const { open, setOpen, triggerRef, close } = usePickerState();
  const [year, setYear] = useState(value.getFullYear());
  const [focusMonth, setFocusMonth] = useState(value.getMonth());

  const toggle = () => {
    if (!open) {
      setYear(value.getFullYear());
      setFocusMonth(value.getMonth());
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${monthLabel(value)}, choose another month`}
        onClick={toggle}
        className={`-mx-2 inline-flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-ink-900/[0.05] dark:hover:bg-white/[0.06] ${CELL_FOCUS} ${
          open ? "bg-ink-900/[0.05] dark:bg-white/[0.06]" : ""
        } ${className}`}
      >
        {monthLabel(value)}
        <ChoiceDots open={open} />
      </button>
      <PickerPanel open={open} onClose={close} triggerRef={triggerRef} align={align} label="Choose a month">
        <MonthGrid
          year={year}
          selected={value}
          focusMonth={focusMonth}
          setFocusMonth={setFocusMonth}
          onYear={(delta) => setYear((y) => y + delta)}
          onPick={(month) => {
            onChange(month);
            close(true);
          }}
        />
        <div className="mt-2 flex justify-end border-t border-ink-900/[0.07] pt-2 dark:border-white/[0.08]">
          <button
            type="button"
            className={FOOTER_BUTTON}
            onClick={() => {
              const now = new Date();
              onChange(new Date(now.getFullYear(), now.getMonth(), 1));
              close(true);
            }}
          >
            This month
          </button>
        </div>
      </PickerPanel>
    </>
  );
}
