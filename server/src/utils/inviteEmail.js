import { emailLayout, emailText, escapeHtml, paragraph } from "./emailLayout.js";

export function buildInviteEmail({ workspaceName, inviterName, email, link, expiresInDays = 7 }) {
  const subject = `${inviterName} invited you to join ${workspaceName} on Loft`;
  const expiry = `This invitation expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"} and only works for ${email}.`;
  const text = emailText([
    `${inviterName} invited you to join ${workspaceName} on Loft.`, "",
    "Collaborate on tasks, meetings, documents, files and conversations with your team.", "",
    `Join the workspace: ${link}`, "",
    `Sign in or create a Loft account using ${email} to accept this invitation.`, "",
    expiry, "", "If you weren't expecting this invitation, you can ignore this email.",
  ], email);
  const html = emailLayout({
    title: `You're invited to ${workspaceName}`,
    preheader: `${inviterName} invited you to join ${workspaceName} on Loft.`,
    category: "Workspace invitation",
    body: paragraph(`<strong style="color:#0A0F0D;">${escapeHtml(inviterName)}</strong> invited you to their workspace on Loft.`)
      + paragraph("Collaborate on tasks, meetings, documents, files and conversations with your team.")
      + paragraph(`Sign in or create a Loft account using <strong style="color:#0A0F0D;">${escapeHtml(email)}</strong> to accept this invitation.`),
    actionLabel: "Accept invitation",
    actionLink: link,
    note: `${escapeHtml(expiry)}<br>If you weren't expecting this invitation, you can ignore this email.`,
    email,
  });
  return { subject, text, html };
}
