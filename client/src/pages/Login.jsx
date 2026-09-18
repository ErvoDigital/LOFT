import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import GoogleSignInButton from "../components/common/GoogleSignInButton.jsx";
import PasswordInput from "../components/common/PasswordInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your LOFT workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-ink-600 dark:text-ink-200">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="my-5">
        <GoogleSignInButton
          onCredential={loginWithGoogle}
          onSuccess={() => navigate(location.state?.from || "/", { replace: true })}
          onError={setError}
        />
      </div>
      <p className="mt-5 text-center text-sm text-ink-500">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
