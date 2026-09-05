import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import * as authApi from "../api/auth.js";
import { apiErrorMessage } from "../api/client.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSent(true);
      if (res.resetToken) setDevToken(res.resetToken);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send you a link to get back in">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-600">If an account exists for {email}, a reset link has been generated.</p>
          {devToken && (
            <div className="rounded-lg bg-accent-50 px-3 py-2 text-left text-xs text-accent-600">
              <p className="mb-1 font-medium">Dev mode — no email service configured:</p>
              <button
                className="font-medium text-brand-600 hover:underline"
                onClick={() => navigate(`/reset-password?token=${devToken}`)}
              >
                Click here to continue to reset
              </button>
            </div>
          )}
          <Link to="/login" className="btn-secondary w-full">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link to="/login" className="block text-center text-sm font-medium text-ink-500 hover:text-ink-700">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
