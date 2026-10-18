import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, simulate } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("posts camelCase bodies to /api/simulate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ before: 0.5, after: 0.3, delta: -0.2 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await simulate(1004, { overTime: "No" });
    expect(out.after).toBe(0.3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/simulate$/);
    expect(JSON.parse(init.body)).toEqual({ employeeId: 1004, levers: { overTime: "No" } });
  });

  it("throws ApiError with status and detail on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Employee 99 not found" }), { status: 404 }),
    ));
    await expect(simulate(99, {})).rejects.toMatchObject({ status: 404, message: "Employee 99 not found" });
    await expect(simulate(99, {})).rejects.toBeInstanceOf(ApiError);
  });

  it("turns network failures into ApiError status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(simulate(1, {})).rejects.toMatchObject({ status: 0 });
  });
});
