// The email an invitee receives. Email clients ignore stylesheets and most
// modern CSS, so the HTML is a single centered table with inline styles, and
// the gradient sits on top of a solid emerald for clients that drop it.
// Everything a person typed (names, the workspace name) is escaped.
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

export function buildInviteEmail({ workspaceName, inviterName, email, link, expiresInDays }) {
  const subject = `${inviterName} invited you to join ${workspaceName} on LOFT`;
  const expiry = `This invite expires in ${expiresInDays} days and only works for ${email}.`;

  const text = [
    `${inviterName} invited you to join ${workspaceName} on LOFT.`,
    "",
    `Join the workspace: ${link}`,
    "",
    expiry,
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0A0F0D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #DCE5E2;border-radius:16px;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <div style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;background:#134A3C;background-image:linear-gradient(135deg,#1F9B7D,#134A3C);color:#FFFFFF;font-weight:700;font-size:18px;">L</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;">
                <h1 style="margin:0;font-size:20px;line-height:28px;font-weight:600;color:#0A0F0D;">Join ${escapeHtml(workspaceName)} on LOFT</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#3D4D48;">
                  <strong style="color:#0A0F0D;">${escapeHtml(inviterName)}</strong> invited you to their workspace, where the team shares tasks, a calendar, documents, files and chat.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#134A3C;background-image:linear-gradient(135deg,#1F9B7D,#134A3C);color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">Join ${escapeHtml(workspaceName)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;font-size:13px;line-height:20px;color:#6B7D77;">
                <p style="margin:0;">${escapeHtml(expiry)}</p>
                <p style="margin:12px 0 0;">Button not working? Paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#1F9B7D;word-break:break-all;">${escapeHtml(link)}</a></p>
                <p style="margin:12px 0 0;">If you weren't expecting this, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
