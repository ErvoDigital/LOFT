import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { resendTwoFactor } from "../../api/auth.js";
import { apiErrorMessage } from "../../api/client.js";

export default function TwoFactorForm({ challenge, onVerified, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendAfter * 1000);
  const [now, setNow] = useState(Date.now());
  const { verifyTwoFactor } = useAuth();
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = new Date(challenge.expiresAt).getTime() <= now;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyTwoFactor(challenge.challengeId, code);
      onVerified();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await resendTwoFactor(challenge.challengeId);
      setResendAt(Date.now() + result.resendAfter * 1000);
      setNow(Date.now());
      setCode("");
      setNotice("A new code has been sent. Use the code in the latest email.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-ink-600 dark:text-ink-200">Enter the 6-digit code emailed to {challenge.email}. Check your spam folder too.</p>
      {challenge.emailWarning && <p role="status" className="text-sm text-amber-600">{challenge.emailWarning}</p>}
      {notice && <p role="status" className="text-sm text-brand-600 dark:text-brand-400">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      {expired && <p role="alert" className="text-sm text-red-600">This code has expired. Go back and sign in again to receive a new one.</p>}
      <div>
        <label htmlFor="sign-in-code" className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Verification code</label>
        <input
          id="sign-in-code" className="input text-center text-lg tracking-[0.5em]"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          required autoFocus disabled={busy || expired}
        />
      </div>
      <button type="submit" disabled={busy || expired || code.length !== 6} className="btn-primary w-full">
        {busy ? "Please wait…" : "Verify and sign in"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" disabled={busy || expired || seconds > 0} onClick={resend} className="font-medium text-brand-600 disabled:opacity-50 dark:text-brand-400">
          {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="text-ink-500">Back to sign in</button>
      </div>
      <p className="text-xs text-ink-500">Codes expire after 10 minutes. Account access starts after verification.</p>
    </form>
  );
}
