import nodemailer from "nodemailer";

// Outgoing email over SMTP. Gmail (with an app password), Resend, Brevo,
// SendGrid and Mailgun all accept SMTP, so switching providers is only a
// change to the SMTP_* variables in .env.example. Without them LOFT still
// runs: isMailConfigured() is false, and callers fall back to what works
// without email (in-app notifications, links an admin can copy).
let transporter = null;

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 is TLS from the first byte; 587 upgrades with STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

// Tests swap in a fake that records messages instead of opening a socket.
export function setMailTransport(fake) {
  transporter = fake;
}

export async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) throw new Error("Email is not configured on this server");
  const from = process.env.MAIL_FROM || `LOFT <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({ from, to, subject, text, html });
}

// Where links in an email point: the web client, not this API.
export function clientUrl(path = "") {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").trim().replace(/\/+$/, "");
  return `${base}${path}`;
}
