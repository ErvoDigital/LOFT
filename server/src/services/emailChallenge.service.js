import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { buildVerificationEmail } from "../utils/emailTemplates.js";
import { sendMail } from "./mail.service.js";

const TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(id, purpose, code) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${id}:${purpose}:${code}`).digest("hex");
}

function invalidCode() {
  return new ApiError(400, "That code is invalid or has expired. Please request a new code.");
}

export function challengeResponse(challenge, email) {
  const [local, domain] = email.split("@");
  return {
    twoFactorRequired: true,
    challengeId: challenge.id,
    email: `${local.slice(0, 1)}***@${domain}`,
    expiresAt: challenge.expiresAt,
    resendAfter: Math.max(0, Math.ceil((challenge.sentAt.getTime() + COOLDOWN_MS - Date.now()) / 1000)),
  };
}

export async function issueEmailChallenge(user, purpose, { resend = false, challengeId } = {}) {
  const existing = await prisma.emailChallenge.findUnique({ where: { userId_purpose: { userId: user.id, purpose } } });
  const now = new Date();
  const active = existing && existing.expiresAt > now;
  if (resend && (!active || existing.id !== challengeId)) throw invalidCode();
  if (active && existing.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect codes. Please try signing in again after the code expires.");
  }
  if (active && now - existing.sentAt < COOLDOWN_MS) {
    if (resend) throw new ApiError(429, "Please wait 60 seconds before requesting another code.");
    return existing;
  }

  const id = active ? existing.id : crypto.randomBytes(24).toString("base64url");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const data = {
    id, userId: user.id, purpose, codeHash: hashCode(id, purpose, code),
    expiresAt: active ? existing.expiresAt : new Date(now.getTime() + TTL_MS),
    sentAt: now,
    attempts: active ? existing.attempts : 0,
  };
  if (existing) {
    // Claim the send atomically so concurrent requests cannot bypass cooldowns.
    const claimed = await prisma.emailChallenge.updateMany({
      where: { id: existing.id, codeHash: existing.codeHash, sentAt: existing.sentAt, attempts: existing.attempts },
      data,
    });
    if (!claimed.count) throw new ApiError(429, "Another code request is in progress. Please try again shortly.");
  } else {
    try {
      await prisma.emailChallenge.create({ data });
    } catch (error) {
      if (error.code === "P2002") throw new ApiError(429, "Another code request is in progress. Please try again shortly.");
      throw error;
    }
  }
  try {
    await sendMail({
      to: user.email,
      ...buildVerificationEmail({
        name: user.name, email: user.email, code, purpose,
        expiresInMinutes: Math.max(1, Math.ceil((data.expiresAt - now) / 60000)),
      }),
    });
  } catch (error) {
    // Failed sends must not leave a usable code or throttle the next retry.
    // Preserve the attempt count when a resend fails, until the original expiry.
    if (active) {
      await prisma.emailChallenge.updateMany({
        where: { id, codeHash: data.codeHash },
        data: { codeHash: existing.codeHash, sentAt: existing.sentAt },
      });
    } else {
      await prisma.emailChallenge.deleteMany({ where: { id, codeHash: data.codeHash } });
    }
    throw error;
  }
  return data;
}

export async function verifyEmailChallenge({ id, userId, purpose, code, consume = true }) {
  const where = id ? { id } : { userId_purpose: { userId, purpose } };
  const challenge = await prisma.emailChallenge.findUnique({ where });
  if (!challenge || challenge.purpose !== purpose || (userId && challenge.userId !== userId) || challenge.expiresAt <= new Date()) {
    throw invalidCode();
  }
  // Reserve an attempt before comparing, including across concurrent requests.
  const claimed = await prisma.emailChallenge.updateMany({
    where: { id: challenge.id, codeHash: challenge.codeHash, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!claimed.count) throw new ApiError(429, "Too many attempts or the code has expired. Please request a new code after it expires.");
  const supplied = Buffer.from(hashCode(challenge.id, purpose, code), "hex");
  const stored = Buffer.from(challenge.codeHash, "hex");
  if (stored.length !== supplied.length || !crypto.timingSafeEqual(stored, supplied)) throw invalidCode();

  if (consume) {
    const removed = await prisma.emailChallenge.deleteMany({
      where: { id: challenge.id, codeHash: challenge.codeHash, expiresAt: { gt: new Date() }, attempts: { lte: MAX_ATTEMPTS } },
    });
    if (!removed.count) throw invalidCode();
  } else {
    await prisma.emailChallenge.updateMany({
      where: { id: challenge.id, codeHash: challenge.codeHash },
      data: { attempts: { decrement: 1 } },
    });
  }
  return challenge;
}
