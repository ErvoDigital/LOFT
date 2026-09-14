import { OAuth2Client } from "google-auth-library";
import { ApiError } from "./ApiError.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleCredential(credential) {
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid Google sign-in token");
  }

  if (!payload?.email) throw new ApiError(401, "Invalid Google sign-in token");
  return payload;
}
