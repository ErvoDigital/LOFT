import { GoogleLogin } from "@react-oauth/google";
import { apiErrorMessage } from "../../api/client.js";

// Wraps @react-oauth/google's button for both sign-in/sign-up (onCredential
// = loginWithGoogle/register flow) and linking Google to an already logged
// in account (onCredential = usersApi.linkGoogle) — the caller decides what
// the credential is used for, this just handles the button and errors.
export default function GoogleSignInButton({ onCredential, onSuccess, onError, divider = true }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {divider && (
        <div className="flex w-full items-center gap-3 text-xs text-ink-400">
          <div className="h-px flex-1 bg-ink-100" />
          or
          <div className="h-px flex-1 bg-ink-100" />
        </div>
      )}
      <div className="w-full [&>div]:!w-full">
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            try {
              const result = await onCredential(credentialResponse.credential);
              onSuccess?.(result);
            } catch (err) {
              onError?.(apiErrorMessage(err) || "Google sign-in failed. Please try again.");
            }
          }}
          onError={() => onError?.("Google sign-in failed. Please try again.")}
          width="100%"
          logo_alignment="center"
        />
      </div>
    </div>
  );
}
