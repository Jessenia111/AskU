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

  // Forward all response headers (including Set-Cookie)
  const responseHeaders = new Headers(proxyResponse.headers);
  // Remove headers that Vercel Edge shouldn't forward
  responseHeaders.delete("transfer-encoding");

  return new Response(proxyResponse.body, {
    status: proxyResponse.status,
    statusText: proxyResponse.statusText,
    headers: responseHeaders,
  });
}
