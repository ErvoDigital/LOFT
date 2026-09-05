import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import * as authApi from "../api/auth.js";
import { apiErrorMessage } from "../api/client.js";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose something you'll remember">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-600">Your password has been updated.</p>
          <button className="btn-primary w-full" onClick={() => navigate("/login")}>
            Continue to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {!token && <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-600">Missing reset token. Use the link from your email.</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">New password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading || !token} className="btn-primary w-full">
            {loading ? "Updating…" : "Update password"}
          </button>
          <Link to="/login" className="block text-center text-sm font-medium text-ink-500 hover:text-ink-700">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
