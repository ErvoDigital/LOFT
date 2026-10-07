import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import GoogleSignInButton from "../components/common/GoogleSignInButton.jsx";
import PasswordInput from "../components/common/PasswordInput.jsx";
import TwoFactorForm from "../components/common/TwoFactorForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";

export default function Login() {
  const location = useLocation();
  // An invite link sends people here with where to come back to and the
  // address it was sent to, so that's the one filled in.
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      finishSignIn(await login(email, password));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function finishSignIn(result) {
    if (result.twoFactorRequired) {
      setPassword("");
      setChallenge(result);
    } else {
      navigate(location.state?.from || "/", { replace: true });
    }
  }

  if (challenge) return (
    <AuthLayout title="Verify your sign-in" subtitle="One more step to access your account">
      <TwoFactorForm challenge={challenge}
        onVerified={() => navigate(location.state?.from || "/", { replace: true })}
        onCancel={() => { setChallenge(null); setError(""); }} />
    </AuthLayout>
  );

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
          onSuccess={finishSignIn}
          onError={setError}
        />
      </div>
      <p className="mt-5 text-center text-sm text-ink-500">
        Don't have an account?{" "}
        <Link to="/register" state={location.state} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
