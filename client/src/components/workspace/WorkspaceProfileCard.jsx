import { useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Check,
  Church,
  GraduationCap,
  ImagePlus,
  Lock,
  Plus,
  Shapes,
  Users,
} from "lucide-react";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";
import { pickImageFile } from "../../lib/documentImageUpload.js";
import { resizeImageToDataUrl } from "../../lib/avatarImage.js";
import { displayColor, textOn } from "../../lib/colors.js";
import WorkspaceMark from "../common/WorkspaceMark.jsx";

const TYPES = [
  { value: "school", label: "School", Icon: GraduationCap },
  { value: "work", label: "Work", Icon: Briefcase },
  { value: "org", label: "Organization", Icon: Building2 },
  { value: "church", label: "Church", Icon: Church },
  { value: "other", label: "Other", Icon: Shapes },
];

// The same choices as creating a workspace (layout/WorkspaceModal.jsx).
const COLORS = ["#134A3C", "#1F9B7D", "#5EEAD4", "#D97706", "#DB2777", "#8EA39D"];

const DESCRIPTION_MAX = 400;

const LABEL = "mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200";

function profileOf(workspace) {
  return {
    name: workspace.name,
    description: workspace.description || "",
    type: workspace.type || "other",
    color: displayColor(workspace.color),
    logoUrl: workspace.logoUrl || null,
  };
}

// The workspace's cover: its color falling into a deeper shade, a soft light
// in the top corner, and a dot grid fading in from the right.
function Cover({ color, TypeIcon }) {
  const c = displayColor(color);
  return (
    <div
      aria-hidden
      className="relative h-28 overflow-hidden transition-colors duration-300 lg:h-40"
      style={{ backgroundColor: c, backgroundImage: `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 55%, black) 100%)` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.28) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          maskImage: "linear-gradient(to left, black, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to left, black, transparent 75%)",
        }}
      />
      <div className="absolute -right-12 -top-20 h-52 w-52 rounded-full bg-white/25 blur-3xl" />
      <TypeIcon
        className="absolute -bottom-7 right-8 h-32 w-32 -rotate-12 lg:-bottom-10 lg:right-16 lg:h-48 lg:w-48"
        strokeWidth={1.25}
        style={{ color: textOn(c), opacity: 0.14 }}
      />
    </div>
  );
}

export default function WorkspaceProfileCard({ workspace, canEdit, onSaved }) {
  const [saved, setSaved] = useState(() => profileOf(workspace));
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  const changedKeys = Object.keys(draft).filter((key) => draft[key] !== saved[key]);
  const dirty = changedKeys.length > 0;
  const type = TYPES.find((t) => t.value === draft.type) || TYPES[TYPES.length - 1];
  const isCustomColor = !COLORS.some((c) => c.toLowerCase() === draft.color.toLowerCase());
  const memberCount = workspace.members?.length ?? workspace.memberCount ?? 0;
  const since = new Date(workspace.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });

  function update(changes) {
    setDraft((d) => ({ ...d, ...changes }));
    setJustSaved(false);
  }

  async function chooseLogo() {
    setError("");
    const file = await pickImageFile();
    if (!file) return;
    try {
      update({ logoUrl: await resizeImageToDataUrl(file, { type: "image/webp" }) });
    } catch (err) {
      setError(err.message || "Could not read that image.");
    }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const changes = Object.fromEntries(changedKeys.map((key) => [key, draft[key]]));
    if ("name" in changes) changes.name = changes.name.trim();
    if ("description" in changes) changes.description = changes.description.trim();
    try {
      const next = profileOf(await workspacesApi.updateWorkspace(workspace.id, changes));
      setSaved(next);
      setDraft(next);
      setJustSaved(true);
      onSaved?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <Cover color={draft.color} TypeIcon={type.Icon} />

      <div className="px-6 pb-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="relative -mt-10 shrink-0 lg:-mt-12">
            <WorkspaceMark
              name={draft.name}
              color={draft.color}
              logoUrl={draft.logoUrl}
              className="h-20 w-20 rounded-2xl text-2xl shadow-soft ring-4 ring-white dark:ring-ink-900 lg:h-24 lg:w-24 lg:text-3xl"
            />
            {canEdit && (
              <button
                type="button"
                onClick={chooseLogo}
                title={draft.logoUrl ? "Change logo" : "Upload a logo"}
                aria-label={draft.logoUrl ? "Change logo" : "Upload a logo"}
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-800 text-white shadow-sm transition-colors hover:bg-ink-700 dark:border-ink-900"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!canEdit && (
            <span className="chip mb-1" title="Only admins can change the workspace profile">
              <Lock className="h-3 w-3" /> View only
            </span>
          )}
        </div>

        <h2 className="mt-3 break-words text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 lg:text-2xl">
          {draft.name.trim() || "Untitled workspace"}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
          <span className="inline-flex items-center gap-1">
            <type.Icon className="h-3.5 w-3.5" /> {type.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Since {since}
          </span>
        </div>
        {draft.description.trim() && (
          <p className="mt-3 max-w-3xl whitespace-pre-line break-words text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {draft.description.trim()}
          </p>
        )}

        {!canEdit && (
          <p className="mt-5 border-t border-ink-100 pt-4 text-xs text-ink-500 dark:border-white/[0.06] dark:text-ink-400">
            Only workspace admins can change the name, logo, and look of this workspace.
          </p>
        )}

        {canEdit && (
          <form onSubmit={save} className="mt-6 space-y-5 border-t border-ink-100 pt-5 dark:border-white/[0.06]">
            <p className="section-label">Workspace profile</p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

            <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <label htmlFor="workspace-name" className={LABEL}>
                    Name
                  </label>
                  <input
                    id="workspace-name"
                    className="input"
                    value={draft.name}
                    onChange={(e) => update({ name: e.target.value })}
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label htmlFor="workspace-description" className="text-sm font-medium text-ink-600 dark:text-ink-200">
                      Description
                    </label>
                    <span className="text-xs tabular-nums text-ink-400">
                      {draft.description.length}/{DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="workspace-description"
                    className="input min-h-[76px] resize-y"
                    rows={3}
                    value={draft.description}
                    onChange={(e) => update({ description: e.target.value })}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="What's this workspace for?"
                  />
                </div>

                <div>
                  <p className={LABEL}>Logo</p>
                  <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">
                    Shown in the sidebar and workspace list. Square images work best; without one, the initials show on the
                    workspace color.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={chooseLogo} className="btn-secondary">
                      <ImagePlus className="h-4 w-4" /> {draft.logoUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    {draft.logoUrl && (
                      <button type="button" onClick={() => update({ logoUrl: null })} className="btn-ghost">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <p className={LABEL}>Type</p>
                  <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {TYPES.map(({ value, label, Icon }) => {
                      const selected = draft.type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => update({ type: value })}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                            selected
                              ? "border-brand-500/70 bg-brand-500/10 text-brand-700 dark:border-brand-400/50 dark:text-brand-300"
                              : "border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-800 dark:border-white/[0.08] dark:text-ink-400 dark:hover:border-white/[0.16] dark:hover:text-ink-100"
                          }`}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className={LABEL}>Color</p>
                  <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">Used for the cover, the initials, and accents on the workspace dashboard.</p>
                  <div role="radiogroup" aria-label="Color" className="flex flex-wrap items-center gap-2.5">
                    {COLORS.map((c) => {
                      const selected = draft.color.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={c}
                          onClick={() => update({ color: c })}
                          style={{ backgroundColor: c }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform dark:ring-offset-ink-900 ${
                            selected ? "ring-2 ring-ink-800 dark:ring-ink-100" : "hover:scale-110"
                          }`}
                        >
                          {selected && <Check className="h-4 w-4" strokeWidth={3} style={{ color: textOn(c) }} />}
                        </button>
                      );
                    })}

                    {/* The native picker sits invisibly over the swatch, so the browser
                        anchors its popup there and keyboard focus lands on a real input. */}
                    <label className="relative flex h-8 w-8 cursor-pointer" title="Custom color">
                      <input
                        type="color"
                        value={draft.color.toLowerCase()}
                        onChange={(e) => update({ color: e.target.value.toUpperCase() })}
                        aria-label="Custom color"
                        className="peer absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
                      />
                      <span
                        className={`pointer-events-none flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 dark:ring-offset-ink-900 ${
                          isCustomColor ? "ring-2 ring-ink-800 dark:ring-ink-100" : ""
                        }`}
                        style={{
                          background: isCustomColor
                            ? draft.color
                            : "conic-gradient(from 200deg, #e0457b, #e07a2e, #c9a227, #3f9b5a, #1f9b7d, #2479c9, #8b55d6, #e0457b)",
                        }}
                      >
                        {isCustomColor ? (
                          <Check className="h-4 w-4" strokeWidth={3} style={{ color: textOn(draft.color) }} />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-ink-800">
                            <Plus className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4 dark:border-white/[0.06]">
              <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400" aria-live="polite">
                {dirty ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes. The preview above shows them.
                  </>
                ) : justSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" strokeWidth={2.5} /> Changes saved
                  </>
                ) : (
                  "Edits preview above as you make them."
                )}
              </p>
              <div className="flex items-center gap-2">
                {dirty && (
                  <button type="button" onClick={() => setDraft(saved)} disabled={saving} className="btn-ghost">
                    Discard
                  </button>
                )}
                <button type="submit" disabled={!dirty || saving} className="btn-primary">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
