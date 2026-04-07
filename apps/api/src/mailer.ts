import "dotenv/config";

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function smtpConfigured() {
  return !!getEnv("SENDGRID_API_KEY");
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  const apiKey = getEnv("SENDGRID_API_KEY");
  const appName = getEnv("APP_NAME") || "AskU";
  const from = getEnv("SMTP_FROM") || getEnv("SMTP_USER") || "jtsenkman@gmail.com";

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: appName },
      subject: `${appName}: your verification code`,
      content: [
        {
          type: "text/plain",
          value: `Your verification code is: ${code}\n\nIt expires in 10 minutes.`,
        },
        {
          type: "text/html",
          value: `
            <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
              <h2 style="margin:0 0 12px">${appName}</h2>
              <p>Your verification code:</p>
              <div style="font-size:28px;font-weight:700;letter-spacing:3px;margin:12px 0">${code}</div>
              <p style="color:#666">It expires in 10 minutes.</p>
            </div>
          `,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }
}
