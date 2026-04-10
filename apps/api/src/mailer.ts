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
      reply_to: { email: from, name: appName },
      subject: `Your ${appName} login code: ${code}`,
      content: [
        {
          type: "text/plain",
          value: `Hello,\n\nYour ${appName} login code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.\n\n— ${appName} Team`,
        },
        {
          type: "text/html",
          value: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:36px 32px;border:1px solid #e4e4e7">
        <tr><td>
          <div style="font-size:22px;font-weight:700;color:#1e293b;margin-bottom:8px">${appName}</div>
          <div style="font-size:15px;color:#64748b;margin-bottom:28px">University of Tartu anonymous Q&amp;A platform</div>
          <div style="font-size:15px;color:#334155;margin-bottom:16px">Your login verification code:</div>
          <div style="font-size:36px;font-weight:800;letter-spacing:6px;color:#1e293b;background:#f1f5f9;border-radius:12px;padding:16px 24px;text-align:center;margin-bottom:20px">${code}</div>
          <div style="font-size:13px;color:#94a3b8;margin-bottom:28px">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</div>
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:12px;color:#94a3b8">This is an automated message from ${appName}. Please do not reply.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }
}
