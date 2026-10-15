import nodemailer from "nodemailer";
import { ApiError } from "../utils/ApiError.js";
import { logStructuredError } from "../utils/logger.js";

let transporter = null;
let transportKey = null;
let injectedTransport = null;
const BREVO_API_URL = "https://api.brevo.com/v3";
const BREVO_ERROR_CODES = new Set([
  "invalid_parameter", "missing_parameter", "out_of_range", "unauthorized",
  "permission_denied", "not_enough_credits", "duplicate_parameter",
  "duplicate_request", "method_not_allowed", "document_not_found",
  "account_under_validation", "bad_request", "rate_limit_exceeded",
]);

export function mailProvider() {
  return process.env.MAIL_PROVIDER?.trim().toLowerCase()
    || (process.env.BREVO_API_KEY?.trim() ? "brevo" : "smtp");
}

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
  if (mailProvider() === "brevo") {
    return Boolean(process.env.BREVO_API_KEY?.trim() && isEmailAddress(senderIdentity().from.address));
  }
  if (mailProvider() !== "smtp") return false;
  const { host, user, pass, port } = mailConfig();
  return Boolean(host && user && pass && Number.isInteger(port) && port > 0 && port <= 65535);
}

function getTransporter() {
  if (!isMailConfigured()) {
    throw new ApiError(503, "Email is unavailable. Please ask the administrator to check the email settings.");
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
    provider: mailProvider(),
    code: error?.code || "UNKNOWN",
    command: error?.command,
    responseCode: error?.responseCode,
  });
  return new ApiError(503, "The email could not be sent. Please try again or contact the administrator.");
}

export async function verifyMailConnection() {
  try {
    requireMailConfiguration();
    if (mailProvider() === "brevo") {
      const account = await brevoRequest("/account");
      if (account.relay?.enabled === false) {
        throw new ApiError(503, "Brevo transactional email is disabled. Enable it in your Brevo account.");
      }
      const { from } = senderIdentity();
      const result = await brevoRequest(`/senders?domain=${encodeURIComponent(from.address.split("@")[1])}`);
      const sender = result.senders?.find((entry) => entry.email?.toLowerCase() === from.address.toLowerCase());
      if (!sender?.active) {
        throw new ApiError(503, "The MAIL_FROM sender is not verified in Brevo. Add and verify it in your Brevo account.");
      }
      return true;
    }
    return await getTransporter().verify();
  } catch (error) {
    throw mailFailure(error);
  }
}

export function senderIdentity() {
  // API keys and SMTP relay login addresses are not sender identities.
  const configured = process.env.MAIL_FROM?.trim() || (mailProvider() === "smtp" ? mailConfig().user : "");
  const address = configured.match(/<([^<>]+)>/)?.[1]?.trim() || configured;
  const reply = process.env.MAIL_REPLY_TO?.trim();
  return {
    from: { name: "SyncTayo", address },
    ...(reply ? { replyTo: { name: "SyncTayo", address: reply.match(/<([^<>]+)>/)?.[1]?.trim() || reply } } : {}),
  };
}

function isEmailAddress(value) {
  return typeof value === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
}

function requireMailConfiguration() {
  if (!isMailConfigured()) {
    throw new ApiError(503, "Email is unavailable. Please ask the administrator to check the email settings.");
  }
}

async function brevoRequest(path, body) {
  let response;
  try {
    response = await fetch(`${BREVO_API_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY.trim(),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch (error) {
    throw Object.assign(new Error("Brevo request failed"), {
      code: ["TimeoutError", "AbortError"].includes(error?.name) ? "ETIMEDOUT" : "EBREVO_NETWORK",
    });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Provider messages can contain addresses or email content. Log codes only.
    throw Object.assign(new Error("Brevo rejected the request"), {
      code: BREVO_ERROR_CODES.has(result?.code) ? result.code : "EBREVO_API",
      responseCode: response.status,
    });
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw Object.assign(new Error("Invalid Brevo response"), { code: "EBREVO_RESPONSE", responseCode: response.status });
  }
  return result;
}

async function sendBrevoMail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).map((recipient) => {
    const email = typeof recipient === "string" ? recipient.trim() : recipient?.address;
    if (!isEmailAddress(email)) throw Object.assign(new Error("Invalid email recipient"), { code: "ERECIPIENT" });
    return { email, ...(recipient?.name ? { name: recipient.name } : {}) };
  });
  if (!recipients.length) throw Object.assign(new Error("No email recipients"), { code: "ERECIPIENT" });
  const { from, replyTo } = senderIdentity();
  const result = await brevoRequest("/smtp/email", {
    sender: { name: from.name, email: from.address },
    to: recipients,
    subject,
    textContent: text,
    htmlContent: html,
    ...(replyTo ? { replyTo: { name: replyTo.name, email: replyTo.address } } : {}),
  });
  // A successful HTTP response must identify the queued message.
  if (typeof result.messageId !== "string" || !result.messageId.trim()) {
    throw Object.assign(new Error("Brevo did not accept the message"), { code: "EBREVO_RESPONSE" });
  }
  return { messageId: result.messageId, accepted: recipients.map(({ email }) => email), rejected: [] };
}

export async function sendMail({ to, subject, text, html }) {
  try {
    requireMailConfiguration();
    if (mailProvider() === "brevo") return await sendBrevoMail({ to, subject, text, html });
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
