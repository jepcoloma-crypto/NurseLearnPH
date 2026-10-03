import { config } from "../config/index.js";

const SHELL = `<!DOCTYPE html>
<html>
  <body style="margin:0;background:#f4f7fb;padding:24px;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td>
            <h2 style="margin:0 0 4px;color:#0f766e;font-size:20px;">NurseLearn PH</h2>
            {{BODY}}
          </td></tr>
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:12px;">Nursing Competency &amp; Learning Platform — Philippines</p>
      </td></tr>
    </table>
  </body>
</html>`;

function shell(body: string): string {
  return SHELL.replace("{{BODY}}", body);
}

function name(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

export function verificationEmail(
  user: { firstName: string; lastName: string },
  url: string,
  expiresInHours = 24
): string {
  return shell(`
    <h3 style="margin:16px 0 8px;color:#1e293b;font-size:17px;">Verify your email address</h3>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi ${name(user)}, thanks for signing up for NurseLearn PH.
      Please confirm that <strong>${user.firstName}</strong> is the right
      person to receive account emails by clicking the button below.
    </p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${url}" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">
        Verify my email
      </a>
    </p>
    <p style="color:#64748b;font-size:13px;line-height:1.6;">
      This link expires in ${expiresInHours} hours and can only be used once.
      If the button doesn't work, paste this link into your browser:
      <br /><span style="word-break:break-all;color:#0f766e;">${url}</span>
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `);
}

export function accountApprovedEmail(user: {
  firstName: string;
  lastName: string;
}): string {
  return shell(`
    <h3 style="margin:16px 0 8px;color:#1e293b;font-size:17px;">Your account is active</h3>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi ${name(user)}, your NurseLearn PH account has been approved.
      You can now sign in with your username and start using the platform.
    </p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${config.CLIENT_URL}/login" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">
        Sign in
      </a>
    </p>
  `);
}

export function accountRejectedEmail(
  user: { firstName: string; lastName: string },
  reason?: string
): string {
  return shell(`
    <h3 style="margin:16px 0 8px;color:#1e293b;font-size:17px;">Account not approved</h3>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi ${name(user)}, your NurseLearn PH account application was not approved.
    </p>
    ${
      reason
        ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>`
        : ""
    }
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      If you believe this was a mistake or you would like to correct your
      details and re-apply, please contact the program administrator.
    </p>
  `);
}
