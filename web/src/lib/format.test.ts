import { describe, expect, it } from "vitest";
import { bandLabel, money, pct, signedPct } from "./format";

describe("format", () => {
  it("formats probabilities as whole percents", () => {
    expect(pct(0.2834)).toBe("28%");
    expect(pct(0.2834, 1)).toBe("28.3%");
  });
  it("formats money compactly", () => {
    expect(money(1234567)).toBe("$1.2M");
    expect(money(84000)).toBe("$84K");
    expect(money(950)).toBe("$950");
  });
  it("formats signed percentage-point deltas", () => {
    expect(signedPct(-0.0712)).toBe("-7 pts");
    expect(signedPct(0.031)).toBe("+3 pts");
    expect(signedPct(0)).toBe("0 pts");
  });
  it("labels bands", () => {
    expect(bandLabel("high")).toBe("High");
    expect(bandLabel("elevated")).toBe("Elevated");
  });
});
