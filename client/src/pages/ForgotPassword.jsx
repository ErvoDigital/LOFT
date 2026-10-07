import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import * as authApi from "../api/auth.js";
import { apiErrorMessage } from "../api/client.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
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
          <p className="text-sm text-ink-600 dark:text-ink-200">If an account exists for {email}, a reset link has been sent. Check your inbox and spam folder.</p>
          <Link to="/login" className="btn-secondary w-full">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link to="/login" className="block text-center text-sm font-medium text-ink-500 hover:text-ink-700 dark:hover:text-ink-100">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
