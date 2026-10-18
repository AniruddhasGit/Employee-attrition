import { buildUpstream, clientIpFrom } from "@/lib/upstream";

/** Same-origin proxy: the browser calls /api/* here and this forwards to the Retain API. */
async function forward(req: Request): Promise<Response> {
  // Read at request time, so one image runs anywhere. Production must say where the API is.
  const apiOrigin = process.env.API_ORIGIN ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:8010");
  if (!apiOrigin) {
    console.error("API_ORIGIN is not set; the web app cannot reach the API.");
    return Response.json({ detail: "Can't reach the model right now." }, { status: 502 });
  }
  const upstream = buildUpstream(req, apiOrigin, process.env.PROXY_SECRET ?? "", clientIpFrom(req.headers));
  let res: Response;
  try {
    res = await fetch(upstream, { cache: "no-store" });
  } catch {
    return Response.json({ detail: "Can't reach the model right now." }, { status: 502 });
  }
  const headers = new Headers();
  for (const name of ["content-type", "cache-control"]) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const cookie of res.headers.getSetCookie()) headers.append("set-cookie", cookie);
  const body = res.status === 204 || res.status === 304 ? null : await res.arrayBuffer();
  return new Response(body, { status: res.status, headers });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
