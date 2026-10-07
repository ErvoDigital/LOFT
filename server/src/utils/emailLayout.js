import { clientUrl } from "../services/mail.service.js";

export const escapeHtml = (value) => String(value ?? "").replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

export const paragraph = (content) =>
  `<p style="margin:16px 0 0;font-size:15px;line-height:25px;color:#3D4D48;">${content}</p>`;

export function emailLayout({ title, preheader, category, body, actionLabel, actionLink, note, email }) {
  const home = clientUrl("/");
  for (const link of [home, actionLink].filter(Boolean)) {
    if (!["http:", "https:"].includes(new URL(link).protocol)) throw new TypeError("Email links must use HTTP or HTTPS.");
  }
  const action = actionLink ? `<tr><td style="padding:28px 32px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#134A3C" style="background:#134A3C;border-radius:10px;text-align:center;">
      <a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:14px 24px;border:1px solid #134A3C;border-radius:10px;font-size:15px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;">${escapeHtml(actionLabel)}</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#6B7D77;">Button not working? Copy this link into your browser:<br>
      <a href="${escapeHtml(actionLink)}" style="color:#134A3C;text-decoration:underline;word-break:break-all;">${escapeHtml(actionLink)}</a>
    </p>
  </td></tr>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F7F6;font-family:Arial,Helvetica,sans-serif;color:#0A0F0D;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F7F6" style="width:100%;background:#F4F7F6;">
    <tr><td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid #DCE5E2;border-radius:16px;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #E8EEEB;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="40" height="40" align="center" bgcolor="#134A3C" style="width:40px;height:40px;background:#134A3C;border-radius:10px;color:#FFFFFF;font-size:22px;font-weight:700;">L</td>
            <td style="padding-left:12px;"><a href="${escapeHtml(home)}" style="font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#134A3C;text-decoration:none;">Loft</a><br><span style="font-size:11px;line-height:18px;color:#6B7D77;">Your workspace, in sync.</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0 0 10px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;color:#1F7A61;text-transform:uppercase;">${escapeHtml(category)}</p>
          <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:700;color:#0A0F0D;word-break:break-word;">${escapeHtml(title)}</h1>
          ${body}
        </td></tr>
        ${action}
        <tr><td style="padding:24px 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F7F6" style="width:100%;background:#F4F7F6;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:21px;color:#53665D;">${note}</td></tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #E8EEEB;font-size:12px;line-height:20px;color:#6B7D77;">
          <p style="margin:0;">Sent to ${escapeHtml(email)}.</p>
          <p style="margin:8px 0 0;">Need help? Reply to this email to reach the Loft team.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:18px 0 0;font-size:11px;line-height:18px;color:#87968F;">Loft &middot; A little more organized, together.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailText(lines, email) {
  return [...lines, "", `Sent to ${email}.`, "Need help? Reply to this email to reach the Loft team.", "", "Loft — Your workspace, in sync."].join("\n");
}
