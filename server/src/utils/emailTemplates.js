import { clientUrl } from "../services/mail.service.js";
import { emailLayout, emailText, escapeHtml, paragraph } from "./emailLayout.js";

export function buildWelcomeEmail({ name, email, link = clientUrl("/") }) {
  const firstName = String(name || "there").trim().split(/\s+/)[0];
  const subject = "Welcome to Loft";
  const text = emailText([
    `Welcome to Loft, ${name || "there"}!`, "",
    "Your account is ready. Bring your team's tasks, calendar, documents, files and conversations together in one workspace.", "",
    "Finish signing in with the code in your verification email, then open Loft and start collaborating.", "",
    `Open Loft: ${link}`, "",
    "If you didn't create this account, reply to this email to let us know.",
  ], email);
  const html = emailLayout({
    title: `Welcome to Loft, ${firstName}`,
    preheader: "Your account is ready. Let's get your workspace organized.",
    category: "Welcome to your workspace",
    body: paragraph("Your account is ready. Bring your team's tasks, calendar, documents, files and conversations together in one workspace.")
      + paragraph("Finish signing in with the code in your verification email, then open Loft and start collaborating."),
    actionLabel: "Open Loft",
    actionLink: link,
    note: "If you didn't create this account, reply to this email to let us know.",
    email,
  });
  return { subject, text, html };
}

export function buildVerificationEmail({ name, email, code, purpose, expiresInMinutes = 10 }) {
  if (!["LOGIN", "PASSWORD_CHANGE"].includes(purpose)) throw new TypeError("Unknown verification email purpose.");
  if (!/^\d{6}$/.test(code)) throw new TypeError("Verification emails require a six-digit code.");
  const login = purpose === "LOGIN";
  const title = login ? "Verify your sign-in" : "Confirm your password change";
  const instruction = login ? "finish signing in to your Loft account" : "change your Loft account password";
  const expiry = `This code expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"} and can only be used once.`;
  const subject = login ? "Your Loft sign-in verification code" : "Your Loft password change verification code";
  const text = emailText([
    `Hi ${name || "there"},`, "", `Use this code to ${instruction}:`, "", code, "",
    expiry, "", "Never share this code with anyone. The Loft team will never ask you for it.",
    "If you didn't request this, you can ignore this email.",
  ], email);
  const html = emailLayout({
    title,
    preheader: `Your ${login ? "sign-in" : "password change"} verification code expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}.`,
    category: login ? "Account access" : "Account security",
    body: paragraph(`Hi ${escapeHtml(name || "there")}, enter this code to ${instruction}:`)
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F7F6" style="margin-top:24px;width:100%;background:#F4F7F6;border:1px solid #DCE5E2;border-radius:10px;"><tr><td align="center" style="padding:22px 12px;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;letter-spacing:8px;font-weight:700;color:#134A3C;">${escapeHtml(code)}</td></tr></table>`
      + paragraph(escapeHtml(expiry)),
    note: "Never share this code with anyone. The Loft team will never ask you for it.<br>If you didn't request this, you can ignore this email.",
    email,
  });
  return { subject, text, html };
}

export function buildPasswordResetEmail({ name, email, link, expiresInHours = 1 }) {
  const subject = "Reset your Loft password";
  const expiry = `This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"} and can only be used once.`;
  const text = emailText([
    `Hi ${name || "there"},`, "", "We received a request to reset your Loft password.", "",
    `Reset your password: ${link}`, "", expiry, "",
    "If you didn't request this, you can safely ignore this email. Your password stays the same until you choose a new one.",
  ], email);
  const html = emailLayout({
    title: "Reset your password",
    preheader: `Reset your Loft password. This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.`,
    category: "Account recovery",
    body: paragraph(`Hi ${escapeHtml(name || "there")}, we received a request to reset your Loft password.`)
      + paragraph("Choose a new password using the button below.")
      + paragraph(escapeHtml(expiry)),
    actionLabel: "Reset password",
    actionLink: link,
    note: "If you didn't request this, you can safely ignore this email. Your password stays the same until you choose a new one.",
    email,
  });
  return { subject, text, html };
}
