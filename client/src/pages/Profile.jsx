import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import * as usersApi from "../api/users.js";
import { apiErrorMessage } from "../api/client.js";
import Avatar from "../components/common/Avatar.jsx";

const COLORS = ["#5B5BD6", "#2A9D8F", "#E76F51", "#E9A23B", "#3D8BFD", "#C44569", "#3F6B52", "#C17538"];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.avatarColor || COLORS[0]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  async function savePassword(e) {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordError("");
    setSavingPassword(true);
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      setPasswordMsg("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(apiErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Profile</h2>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={name} color={color} size={56} src={user?.avatarUrl} />
          <div>
            <p className="text-sm font-medium text-ink-700">{user?.email}</p>
            <p className="text-xs text-ink-400">Email cannot be changed</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="space-y-3">
          {profileMsg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{profileMsg}</p>}
          {profileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{profileError}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Full name</label>
            <input className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Avatar color</label>
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

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Change password</h2>
        <form onSubmit={savePassword} className="max-w-sm space-y-3">
          {passwordMsg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{passwordMsg}</p>}
          {passwordError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{passwordError}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Current password</label>
            <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">New password</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </div>
          <button type="submit" disabled={savingPassword} className="btn-primary">
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
