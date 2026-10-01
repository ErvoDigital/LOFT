import { useEffect, useState } from "react";
import { Check, Lock, ShieldCheck, UserRound } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";
import { RoleBadge } from "../common/Badges.jsx";
import * as workspacesApi from "../../api/workspaces.js";
import { apiErrorMessage } from "../../api/client.js";
import { ABILITY_GROUPS, ACCESS_PRESETS, ALL_ABILITIES, ROLE_LABELS } from "../../lib/access.js";

const TITLE_MAX = 40;

const LEVELS = [
  {
    value: "MEMBER",
    label: "Member",
    description: "Their own tasks, files, documents and chat, plus the abilities ticked below.",
    Icon: UserRound,
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Everything, including who has access to the workspace and what they can do.",
    Icon: ShieldCheck,
  },
];

function sameSet(a, b) {
  return a.length === b.length && a.every((key) => b.includes(key));
}

// Settings → Members → Access: everything an admin decides about one member,
// in one place. Their title, whether they're an admin, and, for a member,
// which admin-only abilities they also hold. Nothing is saved until "Save
// access", so trying out a preset is free.
export default function MemberAccessModal({ open, onClose, workspace, member, currentUserId, onSaved }) {
  const [role, setRole] = useState("MEMBER");
  const [title, setTitle] = useState("");
  const [abilities, setAbilities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !member) return;
    setRole(member.role === "ADMIN" ? "ADMIN" : "MEMBER");
    setTitle(member.title || "");
    setAbilities(member.permissions || []);
    setError("");
  }, [open, member]);

  if (!member) return null;

  const isOwner = member.user.id === workspace.ownerId;
  const isSelf = member.user.id === currentUserId;
  const levelLocked = isOwner || isSelf;
  const isAdmin = role === "ADMIN";
  // Switching to Admin and back keeps what was ticked, so it's not lost.
  const granted = isAdmin ? ALL_ABILITIES : abilities;
  const activePreset = isAdmin ? null : ACCESS_PRESETS.find((p) => sameSet(p.abilities, abilities));
  const trimmedTitle = title.trim();
  const dirty =
    role !== (member.role === "ADMIN" ? "ADMIN" : "MEMBER") ||
    trimmedTitle !== (member.title || "") ||
    (!isAdmin && !sameSet(abilities, member.permissions || []));

  function toggle(key) {
    setAbilities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleGroup(group) {
    const keys = group.abilities.map((a) => a.key);
    const allOn = keys.every((k) => abilities.includes(k));
    setAbilities((prev) => (allOn ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])]));
  }

  // A preset also names the person after it, but only while the title is
  // empty or still another preset's name — never over one an admin typed.
  function applyPreset(preset) {
    setAbilities(preset.abilities);
    if (!trimmedTitle || ACCESS_PRESETS.some((p) => p.label === trimmedTitle)) {
      setTitle(preset.key === "member" ? "" : preset.label);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const saved = await workspacesApi.updateMemberAccess(workspace.id, member.id, {
        ...(levelLocked ? {} : { role }),
        title: trimmedTitle || null,
        permissions: isAdmin ? [] : abilities,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={member.user.name} color={member.user.avatarColor} src={member.user.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          Access for {member.user.name}
        </h2>
        <p className="truncate text-sm text-ink-500 dark:text-ink-400">{member.user.email}</p>
      </div>
      {/* Live preview of how they'll be labelled once saved. */}
      <span className="hidden shrink-0 sm:block">
        <RoleBadge role={role} title={trimmedTitle} />
      </span>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <p className="hidden text-sm text-ink-500 dark:text-ink-400 sm:block">
        {isAdmin ? (
          <>
            <span className="font-semibold text-ink-900 dark:text-ink-50">Admin</span>, so every ability
          </>
        ) : (
          <>
            <span className="font-semibold text-ink-900 dark:text-ink-50">{abilities.length}</span>{" "}
            {abilities.length === 1 ? "ability" : "abilities"} beyond a member
          </>
        )}
      </p>
      <div className="flex flex-1 justify-end gap-2 sm:flex-none">
        <button type="button" className="btn-ghost max-sm:flex-1" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary max-sm:flex-1" disabled={!dirty || saving} onClick={save}>
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : "Save access"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Access for ${member.user.name}`}
      header={header}
      footer={footer}
      width="max-w-3xl"
    >
      <div className="space-y-7">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

        <Section
          title={<label htmlFor="member-title">Title</label>}
          hint="Shown next to their name in Members and on their profile."
        >
          <div className="sm:max-w-sm">
            <input
              id="member-title"
              className="input"
              value={title}
              maxLength={TITLE_MAX}
              placeholder={ROLE_LABELS[role]}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-ink-400">
              For example Team lead or Content manager. Leave it empty to show their role.
            </p>
          </div>
        </Section>

        <Section
          title="Access level"
          hint="Admins can do everything. Members work on tasks, files and chat, plus the abilities you give them."
        >
          <div role="radiogroup" aria-label="Access level" className="grid gap-2.5 sm:grid-cols-2">
            {LEVELS.map((level) => (
              <LevelOption
                key={level.value}
                level={level}
                checked={role === level.value}
                disabled={levelLocked}
                onSelect={() => setRole(level.value)}
              />
            ))}
          </div>
          {levelLocked && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {isOwner ? "The workspace owner is always an admin." : "You can't change your own access level."}
            </p>
          )}
        </Section>

        <Section
          title="Abilities"
          hint={
            isAdmin
              ? "Admins hold every ability. Switch to Member to choose them one by one."
              : "Admin-only actions they can also take. Anything left unticked stays with the admins."
          }
          aside={
            <p className="shrink-0 text-xs text-ink-500 dark:text-ink-400">
              <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{granted.length}</span> of{" "}
              {ALL_ABILITIES.length} selected
            </p>
          }
        >
          {!isAdmin && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-ink-500 dark:text-ink-400">Start from</span>
              {ACCESS_PRESETS.map((preset) => {
                const active = activePreset?.key === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(preset)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-brand-500/60 bg-brand-500/10 text-brand-700 dark:border-brand-400/40 dark:text-brand-300"
                        : "border-ink-900/10 text-ink-600 hover:border-ink-900/20 hover:bg-ink-900/[0.04] dark:border-white/[0.1] dark:text-ink-300 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Two balanced columns from md up; each group stays in one piece. */}
          <div className="-mb-3 md:columns-2 md:gap-3">
            {ABILITY_GROUPS.map((group) => (
              <AbilityGroup
                key={group.key}
                group={group}
                granted={granted}
                disabled={isAdmin}
                onToggle={toggle}
                onToggleAll={() => toggleGroup(group)}
              />
            ))}
          </div>

          <p className="mt-3 flex items-center gap-2 rounded-xl bg-ink-900/[0.03] px-3.5 py-2.5 text-xs text-ink-500 dark:bg-white/[0.03] dark:text-ink-400">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Always admin-only: changing anyone's access level, title or abilities.
          </p>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, hint, aside, children }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function LevelOption({ level, checked, disabled, onSelect }) {
  const Icon = level.Icon;
  return (
    <label
      className={`relative flex items-start gap-3 rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/30 ${
        checked
          ? "border-brand-500/60 bg-brand-500/[0.07] dark:border-brand-400/40 dark:bg-brand-500/[0.1]"
          : "border-ink-900/10 hover:border-ink-900/20 hover:bg-ink-900/[0.02] dark:border-white/[0.08] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.03]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="access-level"
        value={level.value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          checked ? "brand-mark text-white" : "bg-ink-900/[0.05] text-ink-500 dark:bg-white/[0.06] dark:text-ink-300"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900 dark:text-ink-50">{level.label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{level.description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-brand-500" : "border-ink-300 dark:border-white/20"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-brand-500" />}
      </span>
    </label>
  );
}

function AbilityGroup({ group, granted, disabled, onToggle, onToggleAll }) {
  const Icon = group.Icon;
  const count = group.abilities.filter((a) => granted.includes(a.key)).length;
  const allOn = count === group.abilities.length;
  return (
    <div className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white/50 dark:border-white/[0.07] dark:bg-white/[0.02]">
      <div className="flex items-center gap-3 border-b border-ink-900/[0.06] px-4 py-3 dark:border-white/[0.06]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{group.name}</p>
          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{group.summary}</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-ink-400">
          {count}/{group.abilities.length}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={onToggleAll}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-900/[0.05] hover:text-brand-700 dark:text-ink-200 dark:hover:bg-white/[0.06] dark:hover:text-brand-300"
          >
            {allOn ? "Clear" : "Select all"}
          </button>
        )}
      </div>
      <ul className="divide-y divide-ink-900/[0.06] dark:divide-white/[0.05]">
        {group.abilities.map((ability) => (
          <li key={ability.key}>
            <label
              className={`flex gap-3 px-4 py-3 transition-colors ${
                disabled ? "cursor-default" : "cursor-pointer hover:bg-ink-900/[0.02] dark:hover:bg-white/[0.02]"
              }`}
            >
              <span className="relative mt-0.5 flex h-4 w-4 shrink-0">
                <input
                  type="checkbox"
                  checked={granted.includes(ability.key)}
                  disabled={disabled}
                  onChange={() => onToggle(ability.key)}
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded-[5px] border border-ink-400/80 bg-white transition-colors checked:border-transparent checked:bg-gradient-to-br checked:from-brand-500 checked:to-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-default disabled:opacity-60 dark:border-white/20 dark:bg-white/[0.04]"
                />
                <Check
                  className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{ability.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                  {ability.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
