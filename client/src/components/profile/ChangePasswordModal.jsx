import { useState, useEffect } from "react";
import Modal from "../common/Modal.jsx";
import * as usersApi from "../../api/users.js";
import { apiErrorMessage } from "../../api/client.js";

// Verify → set: a 6-digit code emailed to the account (see
// server/src/controllers/users.controller.js for why it's a separate flow
// from the current-password check) gates the new-password fields, which
// only appear once that code is confirmed.
export default function ChangePasswordModal({ open, onClose, onDone, email, hasPassword }) {
  const [step, setStep] = useState("sending"); // sending | verify | reset | done
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("sending");
    setError("");
    setCode("");
    setDevCode("");
    setNewPassword("");
    setConfirmPassword("");
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function sendCode() {
    setError("");
    setBusy(true);
    try {
      const res = await usersApi.sendPasswordChangeCode();
      setDevCode(res.code || "");
      setStep("verify");
    } catch (err) {
      setError(apiErrorMessage(err));
      setStep("verify");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await usersApi.verifyPasswordChangeCode(code);
      setStep("reset");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(e) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await usersApi.changePassword(code, newPassword);
      onDone(user);
      setStep("done");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={hasPassword ? "Change password" : "Set a password"}>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {step === "sending" && <p className="text-sm text-ink-500">Sending a verification code to {email}…</p>}

      {step === "verify" && (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-ink-500">Enter the 6-digit code we sent to {email}.</p>
          {devCode && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              No email provider is configured yet, so here's your code directly: <strong>{devCode}</strong>
            </p>
          )}
          <input
            className="input text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            inputMode="numeric"
            autoFocus
            required
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={sendCode} disabled={busy} className="text-xs font-medium text-brand-600 hover:underline">
              Resend code
            </button>
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary">
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={submitNewPassword} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">New password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Confirm password</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Saving…" : hasPassword ? "Update password" : "Set password"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-700">{hasPassword ? "Password updated." : "Password set."}</p>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
