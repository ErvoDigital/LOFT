import { useId, useRef, useState } from "react";

function displayValue(field, value) {
  const label = (item) => field.options?.find((option) => option.value === item)?.label || item;
  if (Array.isArray(value)) return value.map((item) => `${label(item)} (${item})`).join(", ");
  if (field.name === "tier") return label(value);
  if (field.type === "datetime-local") return `${new Date(value).toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
  return field.options ? `${label(value)} (${value})` : value;
}

export default function AssistantDetailForm({ request, disabled, onChange, onSubmit }) {
  const id = useId();
  const submittingRef = useRef(false);
  const values = request.values || {};
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = disabled || submitting;
  const update = (name, value) => { onChange(name, value); setError(""); };

  async function submit(event) {
    event.preventDefault();
    if (busy || submittingRef.current || request.submitted) return;
    const fields = request.fields;
    if (fields.some((field) => field.required && !(Array.isArray(values[field.name]) ? values[field.name].length : values[field.name]?.trim()))) {
      setError("Please complete the requested details."); return;
    }
    if (fields.some((field) => field.type === "datetime-local" && values[field.name] && !Number.isFinite(new Date(values[field.name]).getTime()))) {
      setError("Please enter a valid date and time."); return;
    }
    if (values.startTime && values.endTime && new Date(values.endTime) <= new Date(values.startTime)) {
      setError("End time must be after start time."); return;
    }
    const message = `Details for ${request.kind === "event" ? "the meeting" : request.kind === "task" ? "the task" : "your question"}:\n` + fields
      .filter((field) => values[field.name]?.length)
      .map((field) => `${field.label}: ${displayValue(field, values[field.name])}`).join("\n");
    if (message.length > 4000) { setError("Please shorten these details before sending."); return; }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (await onSubmit(message) === false) setError("Your details could not be sent. Please try again.");
    } catch { setError("Your details could not be sent. Please try again."); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (request.submitted) return <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-left text-sm text-brand-800 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-200">Details sent to Lofty.</p>;

  return (
    <form onSubmit={submit} aria-label="Details for Lofty" className="min-w-0 space-y-3 rounded-xl border border-ink-200 bg-white p-3 text-left text-sm dark:border-ink-700 dark:bg-ink-800">
      <p className="font-semibold">{request.prompt}</p>
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        {request.fields.map((field) => {
          const inputId = `${id}-${field.name}`;
          const value = values[field.name] ?? (field.type === "multiselect" ? [] : "");
          return field.type === "multiselect" ? (
            <fieldset key={field.name} className="min-w-0 rounded-lg border border-ink-200 p-2 dark:border-ink-700">
              <legend className="px-1 text-xs font-semibold">{field.label}</legend>
              <div className="max-h-44 overflow-y-auto overscroll-contain">
                {field.options?.map((option) => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 px-1">
                  <input type="checkbox" checked={value.includes(option.value)} onChange={({ target }) => update(field.name, target.checked ? [...value, option.value] : value.filter((item) => item !== option.value))} />
                  <span className="min-w-0 break-words">{option.label}</span>
                </label>)}
              </div>
            </fieldset>
          ) : (
            <div key={field.name} className="min-w-0 space-y-1">
              <label htmlFor={inputId} className="block text-xs font-semibold">{field.label}</label>
              {field.type === "select" ? (
                <select id={inputId} className="input min-h-11 w-full min-w-0 !text-base" required={field.required} value={value} onChange={({ target }) => update(field.name, target.value)}>
                  <option value="">Choose {field.label.toLowerCase()}</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === "textarea" ? (
                <textarea id={inputId} className="input min-h-24 w-full min-w-0 resize-y !text-base" rows={3} required={field.required} maxLength={field.maxLength} value={value} onChange={({ target }) => update(field.name, target.value)} />
              ) : (
                <input id={inputId} type={field.type} className="input min-h-11 w-full min-w-0 !text-base" required={field.required} maxLength={field.maxLength} value={value} onChange={({ target }) => update(field.name, target.value)} />
              )}
            </div>
          );
        })}
        <p className="text-xs text-ink-500 dark:text-ink-400">Send these details to prepare a preview. Review it and click Confirm to save.</p>
        <button type="submit" className="btn-primary min-h-11">{submitting ? "Sending…" : "Send details"}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}
