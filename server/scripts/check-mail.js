import "../src/config/env.js";
import { clientUrl, closeMailTransport, mailConfig, sendMail, verifyMailConnection } from "../src/services/mail.service.js";
import { buildPasswordResetEmail, buildVerificationEmail, buildWelcomeEmail } from "../src/utils/emailTemplates.js";
import { buildInviteEmail } from "../src/utils/inviteEmail.js";

// Read-only unless --send is supplied. Test messages contain no usable tokens,
// invitations or verification codes and go only to the configured SMTP mailbox.
try {
  await verifyMailConnection();
  console.log("SMTP connection, TLS and authentication verified.");
  if (process.argv.includes("--send")) {
    const email = mailConfig().user;
    const name = "Loft SMTP test";
    const messages = [
      buildWelcomeEmail({ name, email }),
      buildPasswordResetEmail({ name, email, link: clientUrl("/") }),
      buildInviteEmail({ workspaceName: "SMTP test (no workspace invitation)", inviterName: name, email, link: clientUrl("/"), expiresInDays: 7 }),
      buildVerificationEmail({ name, email, code: "000000", purpose: "LOGIN" }),
      buildVerificationEmail({ name, email, code: "000000", purpose: "PASSWORD_CHANGE" }),
    ];
    for (const message of messages) {
      await sendMail({
        to: email,
        subject: `[Loft SMTP test] ${message.subject}`,
        text: `DELIVERY TEST ONLY. Links and codes in this email do not perform any account action.\n\n${message.text}`,
        html: message.html.replace(/(<body[^>]*>)/, '$1<p style="text-align:center;">DELIVERY TEST ONLY. Links and codes do not perform any account action.</p>'),
      });
      console.log(`SMTP accepted: ${message.subject}`);
    }
    console.log("All 5 test messages accepted for the configured SMTP mailbox. Check its inbox and spam folder.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closeMailTransport();
}
