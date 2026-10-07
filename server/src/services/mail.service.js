import nodemailer from "nodemailer";
import { ApiError } from "../utils/ApiError.js";
import { logStructuredError } from "../utils/logger.js";

let transporter = null;
let transportKey = null;
let injectedTransport = null;

export function mailConfig() {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  // Google displays app passwords in groups separated by spaces.
  const pass = /^(smtp\.gmail\.com|smtp\.googlemail\.com)$/i.test(host)
    ? (process.env.SMTP_PASS || "").replace(/\s/g, "")
    : process.env.SMTP_PASS || "";
  const port = Number(process.env.SMTP_PORT?.trim() || 587);
  return { host, user, pass, port };
}

export function isMailConfigured() {
  const { host, user, pass, port } = mailConfig();
  return Boolean(host && user && pass && Number.isInteger(port) && port > 0 && port <= 65535);
}

function getTransporter() {
  if (!isMailConfigured()) {
    throw new ApiError(503, "Email is unavailable. Please ask the administrator to check the SMTP settings.");
  }
  if (injectedTransport) return injectedTransport;
  const { host, user, pass, port } = mailConfig();
  const key = JSON.stringify({ host, user, pass, port });
  if (!transporter || transportKey !== key) {
    transporter?.close();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    transportKey = key;
  }
  return transporter;
}

// Tests replace the connection while retaining delivery-result checks.
export function setMailTransport(fake) {
  injectedTransport = fake;
}

export function closeMailTransport() {
  transporter?.close();
  transporter = null;
  transportKey = null;
}

function mailFailure(error) {
  if (error instanceof ApiError) return error;
  logStructuredError("mail.delivery_failed", {
    code: error?.code || "UNKNOWN",
    command: error?.command,
    responseCode: error?.responseCode,
  });
  return new ApiError(503, "The email could not be sent. Please try again or contact the administrator.");
}

export async function verifyMailConnection() {
  try {
    return await getTransporter().verify();
  } catch (error) {
    throw mailFailure(error);
  }
}

export function senderIdentity() {
  const configured = process.env.MAIL_FROM?.trim() || mailConfig().user;
  const address = configured.match(/<([^<>]+)>/)?.[1]?.trim() || configured;
  const reply = process.env.MAIL_REPLY_TO?.trim();
  return {
    from: { name: "Loft", address },
    ...(reply ? { replyTo: { name: "Loft", address: reply.match(/<([^<>]+)>/)?.[1]?.trim() || reply } } : {}),
  };
}

export async function sendMail({ to, subject, text, html }) {
  try {
    const result = await getTransporter().sendMail({ ...senderIdentity(), to, subject, text, html });
    // A resolved promise can still contain rejected recipients.
    if (!result?.accepted?.length || result.rejected?.length) {
      throw Object.assign(new Error("SMTP rejected the recipient"), { code: "ERECIPIENT" });
    }
    return result;
  } catch (error) {
    throw mailFailure(error);
  }
}

// Where links in an email point: the web client, not this API.
export function clientUrl(path = "") {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").trim().replace(/\/+$/, "");
  return `${base}${path}`;
}
