import "../src/config/env.js";
import { clientUrl, closeMailTransport, mailProvider, sendMail, verifyMailConnection } from "../src/services/mail.service.js";
import { buildPasswordResetEmail, buildVerificationEmail, buildWelcomeEmail } from "../src/utils/emailTemplates.js";
import { buildInviteEmail } from "../src/utils/inviteEmail.js";

// Read-only unless --send is supplied. Test messages contain no usable tokens,
// invitations or verification codes and go only to the explicit test recipient.
try {
  const sending = process.argv.includes("--send");
  const toIndex = process.argv.indexOf("--to");
  const email = (toIndex < 0 ? process.env.MAIL_TEST_TO : process.argv[toIndex + 1])?.trim();
  if (sending && (!email || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email))) {
    throw new Error("Set MAIL_TEST_TO or supply --to recipient@example.com when using --send.");
  }
  await verifyMailConnection();
  console.log(`${mailProvider() === "brevo" ? "Brevo credentials and verified sender" : "SMTP connection, TLS and authentication"} verified.`);
  if (sending) {
    const name = "SyncTayo email test";
    const messages = [
      buildWelcomeEmail({ name, email }),
      buildPasswordResetEmail({ name, email, link: clientUrl("/") }),
      buildInviteEmail({ workspaceName: "Email test (no workspace invitation)", inviterName: name, email, link: clientUrl("/"), expiresInDays: 7 }),
      buildVerificationEmail({ name, email, code: "000000", purpose: "LOGIN" }),
      buildVerificationEmail({ name, email, code: "000000", purpose: "PASSWORD_CHANGE" }),
    ];
    for (const message of messages) {
      await sendMail({
        to: email,
        subject: `[SyncTayo email test] ${message.subject}`,
        text: `DELIVERY TEST ONLY. Links and codes in this email do not perform any account action.\n\n${message.text}`,
        html: message.html.replace(/(<body[^>]*>)/, '$1<p style="text-align:center;">DELIVERY TEST ONLY. Links and codes do not perform any account action.</p>'),
      });
      console.log(`Email provider accepted: ${message.subject}`);
    }
    console.log("All 5 test messages accepted for the test recipient. Check its inbox and spam folder.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closeMailTransport();
}
