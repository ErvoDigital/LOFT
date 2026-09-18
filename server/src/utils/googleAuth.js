import { OAuth2Client } from "google-auth-library";
import { ApiError } from "./ApiError.js";

const client = new OAuth2Client();

// Bad credentials are a 400, not a 401: the client's axios interceptor treats
// any 401 as an expired session and signs the user out, which would log someone
// out for a failed "Connect Google" on their profile.
export async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  // verifyIdToken skips the audience check entirely when audience is unset,
  // which would accept an ID token Google issued to any other app.
  if (!audience) throw new ApiError(503, "Google sign-in isn't configured on this server");

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(400, "Invalid Google sign-in token");
  }

  if (!payload?.email) throw new ApiError(400, "Invalid Google sign-in token");
  return payload;
}
