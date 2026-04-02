import "dotenv/config";
import { Resend } from "resend";

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function smtpConfigured() {
  return !!getEnv("RESEND_API_KEY");
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("RESEND_FROM") || "AskU <onboarding@resend.dev>";
  const appName = getEnv("APP_NAME") || "AskU";

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `${appName}: your verification code`,
    text: `Your verification code is: ${code}\n\nIt expires in 10 minutes.`,
    html: `
      <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
        <h2 style="margin:0 0 12px">${appName}</h2>
        <p>Your verification code:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:3px;margin:12px 0">${code}</div>
        <p style="color:#666">It expires in 10 minutes.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}