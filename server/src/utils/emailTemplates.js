const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

function layout({ title, body, actionLabel, actionLink, footer }) {
  const action = actionLink
    ? `<tr>
      <td style="padding:24px 32px;">
        <a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#134A3C;background-image:linear-gradient(135deg,#1F9B7D,#134A3C);color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(actionLabel)}</a>
      </td>
    </tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0A0F0D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #DCE5E2;border-radius:16px;">
            <tr><td style="padding:32px 32px 8px;"><div style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;background:#134A3C;background-image:linear-gradient(135deg,#1F9B7D,#134A3C);color:#FFFFFF;font-weight:700;font-size:18px;">L</div></td></tr>
            <tr><td style="padding:16px 32px 0;"><h1 style="margin:0;font-size:20px;line-height:28px;font-weight:600;color:#0A0F0D;">${escapeHtml(title)}</h1>${body}</td></tr>
            ${action}
            <tr><td style="padding:0 32px 32px;font-size:13px;line-height:20px;color:#6B7D77;">${footer}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildWelcomeEmail({ name, email }) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  const subject = "Welcome to LOFT";
  const text = [
    `Welcome to LOFT, ${name}!`,
    "",
    "Your account is ready. LOFT brings your team's tasks, calendar, documents, files and chat together in one workspace.",
    "",
    "You can now sign in and start collaborating.",
    "",
    `This email was sent to ${email}.`,
  ].join("\n");
  const html = layout({
    title: `Welcome to LOFT, ${firstName}`,
    body: `<p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#3D4D48;">Your account is ready. LOFT brings your team's tasks, calendar, documents, files and chat together in one workspace.</p>`,
    footer: `<p style="margin:0;">You can now sign in and start collaborating.</p><p style="margin:12px 0 0;">This email was sent to ${escapeHtml(email)}.</p>`,
  });
  return { subject, text, html };
}

export function buildPasswordResetEmail({ name, email, link, expiresInHours = 1 }) {
  const subject = "Reset your LOFT password";
  const expiry = `This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.`;
  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your LOFT password.",
    "",
    `Reset your password: ${link}`,
    "",
    expiry,
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
  const html = layout({
    title: "Reset your LOFT password",
    body: `<p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#3D4D48;">Hi ${escapeHtml(name)}, we received a request to reset your LOFT password.</p>`,
    actionLabel: "Reset password",
    actionLink: link,
    footer: `<p style="margin:0;">${escapeHtml(expiry)}</p><p style="margin:12px 0 0;">Button not working? Paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#1F9B7D;word-break:break-all;">${escapeHtml(link)}</a></p><p style="margin:12px 0 0;">If you didn't request this, you can safely ignore this email.</p><p style="margin:12px 0 0;">This email was sent to ${escapeHtml(email)}.</p>`,
  });
  return { subject, text, html };
}
