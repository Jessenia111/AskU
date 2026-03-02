import "dotenv/config";
import nodemailer from "nodemailer";

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function smtpConfigured() {
  return (
    !!getEnv("SMTP_HOST") &&
    !!getEnv("SMTP_PORT") &&
    !!getEnv("SMTP_USER") &&
    !!getEnv("SMTP_PASS") &&
    !!getEnv("SMTP_FROM")
  );
}

let cachedTransporter: nodemailer.Transporter | null = null;

function createTransporter() {
  const host = getEnv("SMTP_HOST");
  const port = Number(getEnv("SMTP_PORT"));
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();

    if (process.env.NODE_ENV !== "production") {
      console.log("[SMTP] configured:", smtpConfigured());
      console.log("[SMTP] host:", getEnv("SMTP_HOST"));
      console.log("[SMTP] port:", getEnv("SMTP_PORT"));
      console.log("[SMTP] user:", getEnv("SMTP_USER") ? "***set***" : "***missing***");
      console.log("[SMTP] from:", getEnv("SMTP_FROM"));
    }

    // Быстрая проверка соединения/логина (сразу покажет 535)
    await cachedTransporter.verify();
  }

  return cachedTransporter;
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  const from = getEnv("SMTP_FROM");
  const appName = getEnv("APP_NAME") || "AskU";

  const transporter = await getTransporter();

  await transporter.sendMail({
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
}