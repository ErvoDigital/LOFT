import { useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import * as usersApi from "../api/users.js";
import { apiErrorMessage } from "../api/client.js";
import { pickImageFile } from "../lib/documentImageUpload.js";
import { resizeImageToDataUrl } from "../lib/avatarImage.js";
import Avatar from "../components/common/Avatar.jsx";
import GoogleSignInButton from "../components/common/GoogleSignInButton.jsx";
import ChangePasswordModal from "../components/profile/ChangePasswordModal.jsx";
import AppearanceSettings from "../components/profile/AppearanceSettings.jsx";
import { displayColor } from "../lib/colors.js";

const COLORS = ["#134A3C", "#1F9B7D", "#E76F51", "#E9A23B", "#5EEAD4", "#C44569", "#3F6B52", "#C17538"];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.avatarColor ? displayColor(user.avatarColor) : COLORS[0]);
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

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg("");
    setProfileError("");
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile({ name, avatarColor: color });
      setUser(updated);
      setProfileMsg("Profile updated.");
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800 dark:text-ink-100">Profile</h2>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={name} color={color} size={56} src={user?.avatarUrl} />
            <button
              type="button"
              onClick={changeAvatar}
              disabled={avatarSaving}
              title="Change photo"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ink-800 text-white shadow-sm hover:bg-ink-700 disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{user?.email}</p>
            <p className="text-xs text-ink-400">{name}</p>
            {user?.avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarSaving}
                className="mt-1.5 text-xs font-medium text-ink-400 hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        {avatarError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{avatarError}</p>}
        <form onSubmit={saveProfile} className="space-y-3">
          {profileMsg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{profileMsg}</p>}
          {profileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{profileError}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Nickname</label>
            <input className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Avatar color</label>
            <p className="mb-2 text-xs text-ink-400">Used for your initials when you don't have a photo.</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-ink-800 ring-offset-2" : ""}`}
                />
              ))}
            </div>
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary">
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      <AppearanceSettings />

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800 dark:text-ink-100">Sign-in methods</h2>

        <div className="mb-5 flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 dark:border-ink-700">
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">Google</p>
            <p className="text-xs text-ink-400">
              {user?.googleLinked ? "Connected — you can sign in with Google." : "Not connected."}
            </p>
          </div>
          {user?.googleLinked ? (
            <button
              type="button"
              onClick={disconnectGoogle}
              disabled={unlinking || !user?.hasPassword}
              title={!user?.hasPassword ? "Set a password below first, so you don't lose access" : undefined}
              className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-300 disabled:no-underline dark:text-red-400"
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
        {googleMsg && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{googleMsg}</p>}
        {googleError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{googleError}</p>}

        <div className="max-w-sm space-y-3">
          <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{user?.hasPassword ? "Password" : "Set a password"}</p>
          {!user?.hasPassword && (
            <p className="text-xs text-ink-400">
              Your account currently only signs in with Google. Set a password to be able to sign in with your email too.
            </p>
          )}
          {passwordMsg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{passwordMsg}</p>}
          <button type="button" onClick={() => setPasswordModalOpen(true)} className="btn-primary">
            {user?.hasPassword ? "Change password" : "Set a password"}
          </button>
        </div>
      </div>

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
    </div>
  );
}
