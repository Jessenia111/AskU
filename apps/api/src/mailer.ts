import "dotenv/config";
import nodemailer from "nodemailer";

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function smtpConfigured() {
  return !!(getEnv("SMTP_HOST") && getEnv("SMTP_USER") && getEnv("SMTP_PASS"));
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  const appName = getEnv("APP_NAME") || "AskU";

  const port = parseInt(getEnv("SMTP_PORT") || "587", 10);
  const transporter = nodemailer.createTransport({
    host: getEnv("SMTP_HOST"),
    port,
    secure: port === 465,
    family: 4, // force IPv4 — Railway does not support IPv6 outbound
    auth: {
      user: getEnv("SMTP_USER"),
      pass: getEnv("SMTP_PASS"),
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  const from = getEnv("SMTP_FROM") || `${appName} <${getEnv("SMTP_USER")}>`;

  const info = await transporter.sendMail({
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

  if (!info.messageId) throw new Error("Failed to send email");
}
