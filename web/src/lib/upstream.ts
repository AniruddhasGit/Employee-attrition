/**
 * Builds the request the web server sends to the API on the browser's behalf.
 *
 * The browser only ever talks to this site, so the session cookie is first-party everywhere
 * (iPhone Safari included). The API trusts the forwarded client IP only alongside the shared
 * secret, which comes from server config and never from the browser.
 */

const FORWARDED = ["cookie", "origin", "content-type", "accept"];

export function clientIpFrom(headers: Headers): string | null {
  for (const name of ["cf-connecting-ip", "true-client-ip"]) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? null;
}

export function buildUpstream(req: Request, apiOrigin: string, secret: string, clientIp: string | null): Request {
  const url = new URL(req.url);
  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (secret) headers.set("x-retain-proxy-secret", secret);
  if (clientIp) headers.set("x-retain-client-ip", clientIp);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  return new Request(`${apiOrigin.replace(/\/$/, "")}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Required by Node's fetch when streaming a request body.
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
  } as RequestInit);
}
