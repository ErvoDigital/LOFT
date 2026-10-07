import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/common/AuthLayout.jsx";
import GoogleSignInButton from "../components/common/GoogleSignInButton.jsx";
import PasswordInput from "../components/common/PasswordInput.jsx";
import TermsModal from "../components/common/TermsModal.jsx";
import TwoFactorForm from "../components/common/TwoFactorForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";

export default function Register() {
  const location = useLocation();
  const returnTo = location.state?.from || "/";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(location.state?.email || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      finishSignIn(await register(firstName.trim(), lastName.trim(), email, phone, password));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function finishSignIn(result) {
    if (result.twoFactorRequired) {
      setPassword("");
      setConfirmPassword("");
      setChallenge(result);
    } else {
      navigate(returnTo, { replace: true });
    }
  }

  if (challenge) return (
    <AuthLayout title="Verify your email" subtitle="Your account is ready. Confirm your email to continue.">
      <TwoFactorForm challenge={challenge} onVerified={() => navigate(returnTo, { replace: true })}
        onCancel={() => navigate("/login", { state: location.state })} />
    </AuthLayout>
  );

  return (
    <AuthLayout title="Sign up" subtitle="Let's get you all set up so you can access your workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">First Name</label>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Last Name</label>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Phone Number</label>
          <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          <p className="mt-1 text-xs text-ink-400">At least 8 characters.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-200">Confirm Password</label>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
        </div>
        <label className="flex items-start gap-2 text-sm text-ink-600 dark:text-ink-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => {}}
            onClick={(e) => {
              e.preventDefault();
              if (agreed) setAgreed(false);
              else setTermsOpen(true);
            }}
            required
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40 dark:border-ink-600"
          />
          I agree to the{" "}
          <button type="button" onClick={() => setTermsOpen(true)} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
            Terms
          </button>{" "}
          and{" "}
          <button type="button" onClick={() => setTermsOpen(true)} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
            Privacy Policy
          </button>
        </label>
        <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onAgree={() => setAgreed(true)} />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link to="/login" state={location.state} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          Login
        </Link>
      </p>
      <div className="my-5">
        <GoogleSignInButton
          onCredential={loginWithGoogle}
          onSuccess={finishSignIn}
          onError={setError}
        />
      </div>
    </AuthLayout>
  );
}
