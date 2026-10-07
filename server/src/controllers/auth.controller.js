import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyGoogleCredential } from "../utils/googleAuth.js";
import { publicUser } from "../utils/publicUser.js";
import { fullName, splitName } from "../utils/userName.js";
import { clientUrl, isMailConfigured, sendMail } from "../services/mail.service.js";
import { buildPasswordResetEmail, buildWelcomeEmail } from "../utils/emailTemplates.js";
import { challengeResponse, issueEmailChallenge, verifyEmailChallenge } from "../services/emailChallenge.service.js";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(40).optional(),
    lastName: z.string().trim().max(40).optional(),
    // Clients from before first/last name were split out send one combined name.
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().email(),
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(8).max(200),
  })
  .refine((d) => d.firstName || d.name, { message: "First name is required", path: ["firstName"] });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleSchema = z.object({ credential: z.string().min(1) });

const forgotSchema = z.object({ email: z.string().email() });

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

const challengeSchema = z.object({ challengeId: z.string().length(32) });
const verifyChallengeSchema = challengeSchema.extend({ code: z.string().regex(/^\d{6}$/) });

function requireMail() {
  if (!isMailConfigured()) throw new ApiError(503, "Email is unavailable. Please ask the administrator to check the SMTP settings.");
}

async function welcomeEmail(user) {
  try {
    await sendMail({ to: user.email, ...buildWelcomeEmail({ name: user.name, email: user.email }) });
    return { welcomeEmailSent: true };
  } catch {
    return { welcomeEmailSent: false, emailWarning: "Your account was created, but the welcome email could not be sent." };
  }
}

export async function register(req, res) {
  const { firstName, lastName, name, email, phone, password } = registerSchema.parse(req.body);
  const nameParts = firstName ? { firstName, lastName: lastName || null } : splitName(name);

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, "An account with this email already exists");
  requireMail();

  const passwordHash = await hashPassword(password);
  const colors = ["#134A3C", "#1F9B7D", "#E76F51", "#E9A23B", "#5EEAD4", "#C44569"];
  const user = await prisma.user.create({
    data: {
      ...nameParts,
      name: fullName(nameParts),
      email: email.toLowerCase(),
      phone: phone || null,
      passwordHash,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    },
  });

  const challenge = await issueEmailChallenge(user, "LOGIN");
  const welcome = await welcomeEmail(user);
  res.status(201).json({ ...challengeResponse(challenge, user.email), ...welcome });
}

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new ApiError(401, "Invalid email or password");

  if (!user.passwordHash) {
    throw new ApiError(400, "This account uses Google sign-in. Continue with Google instead.");
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const challenge = await issueEmailChallenge(user, "LOGIN");
  res.json(challengeResponse(challenge, user.email));
}

export async function googleAuth(req, res) {
  const { credential } = googleSchema.parse(req.body);
  const payload = await verifyGoogleCredential(credential);
  if (!payload.email_verified) throw new ApiError(400, "Please verify your Google account email before signing in.");
  const email = payload.email.toLowerCase();
  requireMail();
  let created = false;

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user && payload.email_verified) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, avatarUrl: user.avatarUrl || payload.picture || null },
      });
    }
  }

  if (!user) {
    const colors = ["#134A3C", "#1F9B7D", "#E76F51", "#E9A23B", "#5EEAD4", "#C44569"];
    const nameParts = payload.given_name
      ? { firstName: payload.given_name, lastName: payload.family_name || null }
      : splitName(payload.name || email.split("@")[0]);
    user = await prisma.user.create({
      data: {
        ...nameParts,
        name: fullName(nameParts),
        email,
        googleId: payload.sub,
        avatarUrl: payload.picture || null,
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
      },
    });
    created = true;
  }

  const challenge = await issueEmailChallenge(user, "LOGIN");
  const welcome = created ? await welcomeEmail(user) : {};
  res.json({ ...challengeResponse(challenge, user.email), ...welcome });
}

export async function verifyTwoFactor(req, res) {
  const { challengeId, code } = verifyChallengeSchema.parse(req.body);
  const challenge = await verifyEmailChallenge({ id: challengeId, purpose: "LOGIN", code });
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user) throw new ApiError(400, "This sign-in request is no longer valid.");
  res.json({ token: signToken({ sub: user.id }), user: publicUser(user) });
}

export async function resendTwoFactor(req, res) {
  const { challengeId } = challengeSchema.parse(req.body);
  const existing = await prisma.emailChallenge.findUnique({ where: { id: challengeId } });
  if (!existing || existing.purpose !== "LOGIN") throw new ApiError(400, "This sign-in request is no longer valid.");
  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) throw new ApiError(400, "This sign-in request is no longer valid.");
  const challenge = await issueEmailChallenge(user, "LOGIN", { resend: true, challengeId });
  res.json(challengeResponse(challenge, user.email));
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
}

// Recovery credentials are delivered only to the account's email address.
export async function forgotPassword(req, res) {
  const { email } = forgotSchema.parse(req.body);
  requireMail();
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    return res.json({ message: "If that email exists, a password reset link has been sent." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: crypto.createHash("sha256").update(resetToken).digest("hex"), resetTokenExpiry },
  });

  try {
    await sendMail({
      to: user.email,
      ...buildPasswordResetEmail({
        name: user.name, email: user.email,
        link: clientUrl(`/reset-password?token=${encodeURIComponent(resetToken)}`),
      }),
    });
  } catch (error) {
    await prisma.user.updateMany({
      where: { id: user.id, resetToken: crypto.createHash("sha256").update(resetToken).digest("hex") },
      data: { resetToken: null, resetTokenExpiry: null },
    });
    throw error;
  }
  res.json({ message: "If that email exists, a password reset link has been sent." });
}

export async function resetPassword(req, res) {
  const { token, password } = resetSchema.parse(req.body);

  const user = await prisma.user.findFirst({
    where: { resetToken: crypto.createHash("sha256").update(token).digest("hex"), resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or has expired");

  const passwordHash = await hashPassword(password);
  const changed = await prisma.user.updateMany({
    where: { id: user.id, resetToken: user.resetToken, resetTokenExpiry: { gt: new Date() } },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });
  if (!changed.count) throw new ApiError(400, "Reset link is invalid or has expired");
  await prisma.emailChallenge.deleteMany({ where: { userId: user.id } });

  res.json({ message: "Password updated. You can now log in." });
}
