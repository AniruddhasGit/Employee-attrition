import { describe, expect, it } from "vitest";
import { buildUpstream as build, clientIpFrom } from "./upstream";

/** The upstream call as a Request, so tests can read it the way fetch will send it. */
async function buildUpstream(...args: Parameters<typeof build>) {
  const { url, init } = await build(...args);
  return new Request(url, init);
}

const API = "http://api.internal:8010";

function incoming(path: string, init: RequestInit = {}) {
  return new Request(`https://retain-web.example${path}`, init);
}

describe("buildUpstream", () => {
  it("targets the API with the same path and query", async () => {
    const req = await buildUpstream(incoming("/api/hr/people?search=tan&limit=5"), API, "s3cret", "1.2.3.4");
    expect(req.url).toBe(`${API}/api/hr/people?search=tan&limit=5`);
    expect(req.method).toBe("GET");
  });

  it("forwards method, cookie, origin and content type", async () => {
    const req = await buildUpstream(
      incoming("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.c" }),
        headers: {
          cookie: "retain_session=abc",
          origin: "https://retain-web.example",
          "content-type": "application/json",
        },
      }),
      API,
      "s3cret",
      "1.2.3.4",
    );
    expect(req.method).toBe("POST");
    expect(req.headers.get("cookie")).toBe("retain_session=abc");
    expect(req.headers.get("origin")).toBe("https://retain-web.example");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(await req.text()).toBe(JSON.stringify({ email: "a@b.c" }));
  });

  it("adds the client IP and the proxy secret from config, never from the browser", async () => {
    const req = await buildUpstream(
      incoming("/api/me", { headers: { "x-retain-proxy-secret": "forged", "x-retain-client-ip": "6.6.6.6" } }),
      API,
      "s3cret",
      "1.2.3.4",
    );
    expect(req.headers.get("x-retain-proxy-secret")).toBe("s3cret");
    expect(req.headers.get("x-retain-client-ip")).toBe("1.2.3.4");
  });

  it("drops the client IP header when it is unknown, and never sends host", async () => {
    const req = await buildUpstream(incoming("/api/me", { headers: { "x-retain-client-ip": "6.6.6.6" } }), API, "", null);
    expect(req.headers.get("x-retain-client-ip")).toBeNull();
    expect(req.headers.get("host")).toBeNull();
  });
});

describe("clientIpFrom", () => {
  it("prefers edge headers, then the rightmost X-Forwarded-For hop (clients can only prepend)", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "cf-connecting-ip": "198.51.100.9", "x-forwarded-for": "1.1.1.1" }))).toBe(
      "198.51.100.9",
    );
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
