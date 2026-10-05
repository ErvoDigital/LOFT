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

export async function register(req, res) {
  const { firstName, lastName, name, email, phone, password } = registerSchema.parse(req.body);
  const nameParts = firstName ? { firstName, lastName: lastName || null } : splitName(name);

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

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

  if (isMailConfigured()) {
    try {
      await sendMail({ to: user.email, ...buildWelcomeEmail({ name: user.name, email: user.email }) });
    } catch (err) {
      console.error(`welcome email to ${user.email} failed`, err);
    }
  }

  const token = signToken({ sub: user.id });
  res.status(201).json({ token, user: publicUser(user) });
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

  const token = signToken({ sub: user.id });
  res.json({ token, user: publicUser(user) });
}

export async function googleAuth(req, res) {
  const { credential } = googleSchema.parse(req.body);
  const payload = await verifyGoogleCredential(credential);
  const email = payload.email.toLowerCase();

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
  }

  const token = signToken({ sub: user.id });
  res.json({ token, user: publicUser(user) });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
}

// Password recovery: issues a reset token and emails it when SMTP is configured.
// Without email in development, return the token so the local flow remains testable.
export async function forgotPassword(req, res) {
  const { email } = forgotSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    return res.json({ message: "If that email exists, a reset link has been generated." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  const emailEnabled = isMailConfigured();
  if (emailEnabled) {
    try {
      await sendMail({
        to: user.email,
        ...buildPasswordResetEmail({
          name: user.name,
          email: user.email,
          link: clientUrl(`/reset-password?token=${encodeURIComponent(resetToken)}`),
        }),
      });
    } catch (err) {
      console.error(`password reset email to ${user.email} failed`, err);
    }
  }

  const devOnly = !emailEnabled && process.env.NODE_ENV !== "production" ? { resetToken } : {};
  res.json({ message: "If that email exists, a reset link has been generated.", ...devOnly });
}

export async function resetPassword(req, res) {
  const { token, password } = resetSchema.parse(req.body);

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or has expired");

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  res.json({ message: "Password updated. You can now log in." });
}
