/**
 * Vercel Edge Function — proxies all /api/* requests to Railway backend.
 * This allows the browser to make same-origin requests (no CORS, no Safari ITP issues).
 */
export const config = {
  runtime: "edge",
};

const RAILWAY_API = "https://asku-production.up.railway.app";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = `${RAILWAY_API}${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("host", "asku-production.up.railway.app");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const proxyResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? req.body : null,
    // @ts-expect-error duplex is required for streaming body in some runtimes
    duplex: hasBody ? "half" : undefined,
  });

  // Build response headers manually so Set-Cookie is not lost.
  // The Headers API silently drops Set-Cookie on iteration in some runtimes,
  // so we use getSetCookie() which is designed specifically for this.
  const responseHeaders = new Headers();

  for (const [key, value] of proxyResponse.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "transfer-encoding" || lower === "set-cookie") continue;
    responseHeaders.append(key, value);
  }

  // Forward every Set-Cookie header individually
  const cookies: string[] =
    typeof (proxyResponse.headers as any).getSetCookie === "function"
      ? (proxyResponse.headers as any).getSetCookie()
      : proxyResponse.headers.get("set-cookie")
        ? [proxyResponse.headers.get("set-cookie") as string]
        : [];

  for (const cookie of cookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(proxyResponse.body, {
    status: proxyResponse.status,
    statusText: proxyResponse.statusText,
    headers: responseHeaders,
  });
}
