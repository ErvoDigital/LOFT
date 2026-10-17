import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Camera,
  User,
  Palette,
  Shield,
  Users,
  Clock,
  Mail,
  Phone,
  Sparkles,
  Check,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Globe,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import * as usersApi from "../api/users.js";
import { apiErrorMessage } from "../api/client.js";
import { pickImageFile } from "../lib/documentImageUpload.js";
import { resizeImageToDataUrl } from "../lib/avatarImage.js";
import Avatar from "../components/common/Avatar.jsx";
import GoogleSignInButton from "../components/common/GoogleSignInButton.jsx";
import ChangePasswordModal from "../components/profile/ChangePasswordModal.jsx";
import AppearanceSettings from "../components/profile/AppearanceSettings.jsx";
import FollowsPanel from "../components/profile/FollowsPanel.jsx";
import MemberProfileModal from "../components/profile/MemberProfileModal.jsx";
import { displayColor, textOn, AVATAR_PALETTE, isValidHex } from "../lib/colors.js";
import { accentSeed } from "../lib/palette.js";
import { KAS_LANGUAGES } from "../lib/languages.js";

export { KAS_LANGUAGES };

function initialNameParts(user) {
  if (user?.firstName != null) return { firstName: user.firstName, lastName: user.lastName || "" };
  const [firstName = "", ...rest] = (user?.name || "").trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

const COMMON_PRONOUNS = ["they/them", "she/her", "he/him", "she/they", "he/they"];

const TIMEZONES = [
  { id: "Asia/Manila", label: "Manila, Philippines (GMT+8)" },
  { id: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { id: "Asia/Tokyo", label: "Tokyo, Japan (GMT+9)" },
  { id: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)" },
  { id: "Asia/Bangkok", label: "Bangkok, Thailand (GMT+7)" },
  { id: "Asia/Kolkata", label: "India Standard Time (GMT+5:30)" },
  { id: "Asia/Dubai", label: "Dubai, UAE (GMT+4)" },
  { id: "Europe/London", label: "London, UK (GMT/BST)" },
  { id: "Europe/Paris", label: "Paris, France (GMT+1/CEST)" },
  { id: "Europe/Berlin", label: "Berlin, Germany (GMT+1/CEST)" },
  { id: "America/New_York", label: "New York, USA (ET)" },
  { id: "America/Chicago", label: "Chicago, USA (CT)" },
  { id: "America/Denver", label: "Denver, USA (MT)" },
  { id: "America/Los_Angeles", label: "Los Angeles, USA (PT)" },
  { id: "Australia/Sydney", label: "Sydney, Australia (AEST)" },
  { id: "Pacific/Auckland", label: "Auckland, New Zealand (NZST)" },
  { id: "UTC", label: "UTC (Coordinated Universal Time)" },
];

function formatLocalTime(timeZone) {
  try {
    return new Intl.DateTimeFormat([], {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { accent } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  const [firstName, setFirstName] = useState(() => initialNameParts(user).firstName);
  const [lastName, setLastName] = useState(() => initialNameParts(user).lastName);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [pronouns, setPronouns] = useState(user?.pronouns || "");
  const [customPronouns, setCustomPronouns] = useState("");
  const [title, setTitle] = useState(user?.title || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [timezone, setTimezone] = useState(user?.timezone || "Asia/Manila");
  const [aiLanguage, setAiLanguage] = useState(() => {
    const raw = user?.aiLanguage || "English";
    const found = KAS_LANGUAGES.find((l) => l.id.toLowerCase() === raw.toLowerCase());
    return found ? found.id : "custom";
  });
  const [customLanguage, setCustomLanguage] = useState(() => {
    const raw = user?.aiLanguage || "English";
    const found = KAS_LANGUAGES.find((l) => l.id.toLowerCase() === raw.toLowerCase());
    return found ? "" : raw;
  });

  const [color, setColor] = useState(() => (user?.avatarColor ? displayColor(user.avatarColor) : AVATAR_PALETTE[0].hex));
  const [customAvatarHex, setCustomAvatarHex] = useState(color);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  const [googleMsg, setGoogleMsg] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [unlinking, setUnlinking] = useState(false);

  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMsg, setTwoFactorMsg] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Sync state whenever authenticated user row refreshes
  useEffect(() => {
    if (!user) return;
    const parts = initialNameParts(user);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setNickname(user.nickname || "");
    if (user.pronouns) {
      if (COMMON_PRONOUNS.includes(user.pronouns)) {
        setPronouns(user.pronouns);
      } else {
        setPronouns("custom");
        setCustomPronouns(user.pronouns);
      }
    }
    setTitle(user.title || "");
    setBio(user.bio || "");
    setPhone(user.phone || "");
    setTimezone(user.timezone || "Asia/Manila");
    if (user.aiLanguage) {
      const found = KAS_LANGUAGES.find((l) => l.id.toLowerCase() === user.aiLanguage.toLowerCase());
      if (found) {
        setAiLanguage(found.id);
        setCustomLanguage("");
      } else {
        setAiLanguage("custom");
        setCustomLanguage(user.aiLanguage);
      }
    } else {
      setAiLanguage("English");
      setCustomLanguage("");
    }
    if (user.avatarColor) {
      const hex = displayColor(user.avatarColor);
      setColor(hex);
      setCustomAvatarHex(hex);
    }
  }, [user]);

  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const effectivePronouns = pronouns === "custom" ? customPronouns.trim() : pronouns;
  const effectiveAiLanguage = aiLanguage === "custom" ? (customLanguage.trim() || "English") : (aiLanguage || "English");

  async function toggleTwoFactor() {
    setTwoFactorMsg("");
    setTwoFactorError("");
    setTwoFactorLoading(true);
    const nextState = !user?.twoFactorEnabled;
    try {
      const updated = await usersApi.updateProfile({ twoFactorEnabled: nextState });
      setUser(updated);
      setTwoFactorMsg(nextState ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
    } catch (err) {
      setTwoFactorError(apiErrorMessage(err));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function saveProfile(e) {
    if (e) e.preventDefault();
    setProfileMsg("");
    setProfileError("");
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile({
        name,
        firstName,
        lastName,
        nickname,
        pronouns: effectivePronouns || null,
        title: title.trim() || null,
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        timezone,
        avatarColor: color,
        aiLanguage: effectiveAiLanguage,
      });
      setUser(updated);
      setProfileMsg("Profile updated successfully.");
      setTimeout(() => setProfileMsg(""), 4000);
    } catch (err) {
      setProfileError(apiErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changeAvatar() {
    setAvatarError("");
    const file = await pickImageFile();
    if (!file) return;
    setAvatarSaving(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const updated = await usersApi.updateProfile({ avatarUrl: dataUrl });
      setUser(updated);
    } catch (err) {
      setAvatarError(err?.response ? apiErrorMessage(err) : err.message || "Could not update photo.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    setAvatarError("");
    setAvatarSaving(true);
    try {
      const updated = await usersApi.updateProfile({ avatarUrl: null });
      setUser(updated);
    } catch (err) {
      setAvatarError(apiErrorMessage(err));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function disconnectGoogle() {
    setGoogleMsg("");
    setGoogleError("");
    setUnlinking(true);
    try {
      const updated = await usersApi.unlinkGoogle();
      setUser(updated);
      setGoogleMsg("Google account disconnected.");
    } catch (err) {
      setGoogleError(apiErrorMessage(err));
    } finally {
      setUnlinking(false);
    }
  }

  function handleMatchThemeColor() {
    const themeHex = accentSeed(accent);
    setColor(themeHex);
    setCustomAvatarHex(themeHex);
  }

  function handleCustomHexChange(hex) {
    setCustomAvatarHex(hex);
    if (isValidHex(hex)) {
      setColor(hex.toUpperCase());
    }
  }

  const TABS = [
    { id: "profile", label: "Profile & Identity", Icon: User },
    { id: "appearance", label: "Colors & Appearance", Icon: Palette },
    { id: "security", label: "Security & Access", Icon: Shield },
    { id: "network", label: "Network & Follows", Icon: Users },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">Profile & Settings</h1>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Manage your personal profile, color personalization, team presence, and account security.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-soft transition-all hover:border-brand-400 hover:text-brand-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-200 dark:hover:text-brand-300"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Preview public profile
        </button>
      </div>

      {/* Modern Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Profile navigation"
        className="flex overflow-x-auto rounded-2xl border border-ink-200/80 bg-white/60 p-1.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.03] scrollbar-none"
      >
        {TABS.map(({ id, label, Icon }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSearchParams({ tab: id })}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                selected
                  ? "bg-white text-ink-900 shadow-soft ring-1 ring-black/5 dark:bg-white/[0.12] dark:text-ink-50 dark:ring-white/10"
                  : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <Icon className={`h-4 w-4 ${selected ? "text-brand-600 dark:text-brand-300" : ""}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Profile & Identity */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Public Profile Hero Preview Card */}
          <div className="relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft dark:border-white/[0.08] dark:bg-ink-900">
            {/* Ambient decorative banner tinted with the user's avatar color */}
            <div
              className="h-24 w-full transition-colors duration-300"
              style={{
                background: `linear-gradient(135deg, ${color}35 0%, ${color}10 100%)`,
              }}
            />
            <div className="relative -mt-12 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative shrink-0">
                    <div className="rounded-full ring-4 ring-white dark:ring-ink-900 shadow-soft">
                      <Avatar name={name || "Your Name"} color={color} size={76} src={user?.avatarUrl} />
                    </div>
                    <button
                      type="button"
                      onClick={changeAvatar}
                      disabled={avatarSaving}
                      title="Upload photo"
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-900 text-white shadow-sm hover:bg-brand-600 dark:border-ink-900 dark:bg-ink-700 dark:hover:bg-brand-500"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50">
                        {name || "Your Name"}
                      </h2>
                      {effectivePronouns && (
                        <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 dark:bg-white/10 dark:text-ink-300">
                          {effectivePronouns}
                        </span>
                      )}
                    </div>
                    {title ? (
                      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">{title}</p>
                    ) : (
                      <p className="text-xs text-ink-400 italic">No job title added yet</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {user?.avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={avatarSaving}
                      className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-ink-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Remove photo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    View modal
                  </button>
                </div>
              </div>

              {/* Bio & Contact chips preview */}
              <div className="mt-4 border-t border-ink-100 pt-3.5 dark:border-white/[0.06]">
                {bio ? (
                  <p className="text-xs leading-relaxed text-ink-600 dark:text-ink-300">{bio}</p>
                ) : (
                  <p className="text-xs text-ink-400 italic">Add a short bio to let your team know what you focus on.</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500 dark:text-ink-400">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-ink-400" /> {user?.email}
                  </span>
                  {phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-ink-400" /> {phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-ink-400" />
                    <span>{formatLocalTime(timezone) || "Local time"} ({timezone})</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Preferred language to converse with Kas">
                    <Sparkles className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Kas: {effectiveAiLanguage}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {avatarError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {avatarError}
            </p>
          )}

          {/* Avatar Color Personalization Studio */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3 dark:border-ink-700/60">
              <div>
                <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                  Avatar Color & Initials Studio
                </h3>
                <p className="mt-0.5 text-xs text-ink-400">
                  This color identifies you across initials, mentions, calendar slots, and comments when no photo is used.
                </p>
              </div>

              <button
                type="button"
                onClick={handleMatchThemeColor}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-400/40 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300"
                title="Match current theme accent"
              >
                <Sparkles className="h-3.5 w-3.5" /> Match theme color
              </button>
            </div>

            {/* Live Size & Contrast Preview */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-ink-200/80 bg-ink-50/50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Avatar name={name || "You"} color={color} size={28} />
                <Avatar name={name || "You"} color={color} size={42} />
                <Avatar name={name || "You"} color={color} size={56} />
              </div>
              <div className="border-l border-ink-200/80 pl-4 dark:border-white/10 text-xs space-y-1">
                <p className="font-semibold text-ink-800 dark:text-ink-100">Live preview</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  Hex: <span className="font-mono font-medium text-ink-800 dark:text-ink-100">{color}</span>
                </p>
                <span className="inline-block rounded bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-ink-700 dark:text-ink-300">
                  {textOn(color) === "#0A0F0D" ? "Dark text on light background" : "White text on dark background"}
                </span>
              </div>
            </div>

            {/* 16 Swatches */}
            <div>
              <p className="mb-2 text-xs font-medium text-ink-600 dark:text-ink-300">Curated Palette</p>
              <div className="grid grid-cols-8 gap-2.5 sm:grid-cols-8 md:grid-cols-16">
                {AVATAR_PALETTE.map((p) => {
                  const selected = color.toUpperCase() === p.hex.toUpperCase();
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      title={p.name}
                      onClick={() => {
                        setColor(p.hex);
                        setCustomAvatarHex(p.hex);
                      }}
                      style={{ backgroundColor: p.hex }}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                        selected ? "ring-2 ring-ink-900 ring-offset-2 dark:ring-white dark:ring-offset-ink-900" : ""
                      }`}
                    >
                      {selected && <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Avatar Color Input */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={isValidHex(customAvatarHex) ? customAvatarHex : "#134A3C"}
                  onChange={(e) => handleCustomHexChange(e.target.value.toUpperCase())}
                  className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  title="Pick custom avatar color"
                />
                <input
                  type="text"
                  value={customAvatarHex}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  placeholder="#134A3C"
                  maxLength={7}
                  className="input h-8 w-24 font-mono text-xs uppercase"
                />
              </div>
              <span className="text-[11px] text-ink-400">
                Pick any brand or personal color with full WCAG contrast auto-adjustment.
              </span>
            </div>
          </div>

          {/* Form Card: Personal Details */}
          <form onSubmit={saveProfile} className="card p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Personal Information</h3>

            {profileMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}
            {profileError && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {profileError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">First Name *</label>
                <input
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Last Name</label>
                <input
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={40}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Nickname / Display Name</label>
                <input
                  className="input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Alex"
                  maxLength={40}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Pronouns</label>
                <div className="flex gap-2">
                  <select
                    className="input capitalize"
                    value={COMMON_PRONOUNS.includes(pronouns) ? pronouns : pronouns ? "custom" : ""}
                    onChange={(e) => setPronouns(e.target.value)}
                  >
                    <option value="">Prefer not to share</option>
                    {COMMON_PRONOUNS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="custom">Custom…</option>
                  </select>
                  {pronouns === "custom" && (
                    <input
                      className="input w-36"
                      placeholder="e.g. ze/zir"
                      value={customPronouns}
                      onChange={(e) => setCustomPronouns(e.target.value)}
                      maxLength={30}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Job Title / Headline</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Product Designer, Lead Engineer"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +63 912 345 6789"
                  maxLength={30}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-ink-600 dark:text-ink-200">Bio / About</label>
                <span className="text-[11px] text-ink-400">{bio.length}/300</span>
              </div>
              <textarea
                className="input min-h-[72px] resize-y text-xs"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short summary of your responsibilities, goals, or hobbies with your teammates."
                maxLength={300}
                rows={3}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-200">Timezone & Local Time</label>
              <select
                className="input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label} {formatLocalTime(tz.id) ? `· ${formatLocalTime(tz.id)}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-400">
                Helps your workspace schedule meetings, estimate deadlines, and respect quiet hours.
              </p>
            </div>

            {/* AI Assistant (Kas) Language Preference */}
            <div className="rounded-2xl border border-ink-200/80 bg-gradient-to-br from-brand-50/50 via-white to-brand-50/20 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <label htmlFor="ai-language-select" className="text-xs font-semibold text-ink-800 dark:text-ink-100">
                      Kas AI Assistant Language
                    </label>
                    <span className="ml-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                      Default: English
                    </span>
                  </div>
                </div>
              </div>

              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                Choose the preferred language you want Kas to converse in when answering questions, analyzing plans, or speaking aloud via voice assistant.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id="ai-language-select"
                  className="input flex-1"
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value)}
                >
                  {KAS_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} — {l.native}
                    </option>
                  ))}
                  <option value="custom">Other / Custom language…</option>
                </select>

                {aiLanguage === "custom" && (
                  <input
                    type="text"
                    className="input sm:w-56"
                    placeholder="Enter language (e.g. Dutch)"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    maxLength={50}
                  />
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
                <Globe className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
                <span>
                  Kas will converse in <strong className="font-semibold text-ink-800 dark:text-ink-100">{effectiveAiLanguage}</strong>. You can still switch languages on the fly during any conversation.
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving changes…" : "Save profile changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Colors & Appearance */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <AppearanceSettings />
        </div>
      )}

      {/* TAB 3: Security & Access */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="card p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">Sign-in & Authentication</h2>

            {/* Google Account */}
            <div className="flex flex-col gap-3 rounded-xl border border-ink-100 p-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Google Account</p>
                <p className="text-xs text-ink-400">
                  {user?.googleLinked
                    ? "Connected — you can sign in with one click via Google."
                    : "Not connected — link your Google account for faster sign-in."}
                </p>
              </div>
              {user?.googleLinked ? (
                <button
                  type="button"
                  onClick={disconnectGoogle}
                  disabled={unlinking || !user?.hasPassword}
                  title={!user?.hasPassword ? "Set a password below first, so you don't lose access" : undefined}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  {unlinking ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <GoogleSignInButton
                  divider={false}
                  onCredential={usersApi.linkGoogle}
                  onSuccess={(updated) => {
                    setUser(updated);
                    setGoogleMsg("Google account connected.");
                  }}
                  onError={setGoogleError}
                />
              )}
            </div>
            {googleMsg && (
              <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {googleMsg}
              </p>
            )}
            {googleError && (
              <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {googleError}
              </p>
            )}

            {/* Two-Factor Authentication (2FA) */}
            <div className="flex flex-col gap-3 rounded-xl border border-ink-100 p-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Two-Factor Authentication (2FA)</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user?.twoFactorEnabled
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-400"
                    }`}
                  >
                    {user?.twoFactorEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {user?.twoFactorEnabled
                    ? "A 6-digit verification code is securely emailed to you when signing in."
                    : "Add an extra layer of protection to your account with email verification codes."}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTwoFactor}
                disabled={twoFactorLoading}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  user?.twoFactorEnabled
                    ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20"
                    : "btn-primary"
                } disabled:opacity-60`}
              >
                {twoFactorLoading ? "Updating…" : user?.twoFactorEnabled ? "Turn off 2FA" : "Enable 2FA"}
              </button>
            </div>
            {twoFactorMsg && (
              <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {twoFactorMsg}
              </p>
            )}
            {twoFactorError && (
              <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {twoFactorError}
              </p>
            )}

            {/* Password Section */}
            <div className="rounded-xl border border-ink-100 p-4 dark:border-white/[0.08]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                    {user?.hasPassword ? "Password" : "Set a Password"}
                  </p>
                  <p className="text-xs text-ink-400">
                    {user?.hasPassword
                      ? "Password set. You can sign in using your email and password."
                      : "Your account currently signs in with Google. Set a password to sign in with email too."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  className="btn-secondary text-xs shrink-0"
                >
                  {user?.hasPassword ? "Change password" : "Set password"}
                </button>
              </div>
            </div>
            {passwordMsg && (
              <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {passwordMsg}
              </p>
            )}

            {/* Account Metadata */}
            <div className="rounded-xl bg-ink-50/60 p-4 dark:bg-white/[0.03] text-xs space-y-1.5 text-ink-500 dark:text-ink-400">
              <p className="font-semibold text-ink-700 dark:text-ink-200">Account Details</p>
              <p>Email address: <span className="font-mono text-ink-800 dark:text-ink-100">{user?.email}</span></p>
              <p>User ID: <span className="font-mono text-[11px] text-ink-600 dark:text-ink-300">{user?.id}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Network & Follows */}
      {activeTab === "network" && (
        <div className="space-y-6">
          <FollowsPanel />
        </div>
      )}

      {/* Change / Set Password Modal */}
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onDone={(updated) => {
          const hadPassword = user?.hasPassword;
          setUser(updated);
          setPasswordMsg(hadPassword ? "Password updated." : "Password set.");
        }}
        email={user?.email}
        hasPassword={user?.hasPassword}
      />

      {/* Interactive Member Profile Preview Modal */}
      {user?.id && (
        <MemberProfileModal
          open={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}
