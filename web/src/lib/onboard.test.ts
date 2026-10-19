import { describe, expect, it } from "vitest";
import { checkPerson, firstName, generatePassword, passwordProblem, type PersonDraft } from "./onboard";

const draft: PersonDraft = {
  name: "  Alex Morgan ",
  email: "alex.morgan@company.com",
  password: "kd7mqx4pht2w",
  department: "Sales",
  jobRole: "Sales Executive",
  jobLevel: 2,
  monthlyIncome: "5,400",
  yearsAtCompany: "0",
  overTime: "No",
  businessTravel: "Travel_Rarely",
};

describe("generatePassword", () => {
  it("makes 12 readable characters with a letter and a digit", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(12);
      expect(pw).toMatch(/^[a-z2-9]+$/);
      expect(pw).not.toMatch(/[01ilo]/);
      expect(pw).toMatch(/\d/);
      expect(pw).toMatch(/[a-z]/);
    }
  });
  it("draws again when a draw has no digit", () => {
    let call = 0;
    // First draw: all "a" (no digit). Second: alternating letters and digits.
    const random = (n: number) => Uint32Array.from({ length: n }, (_, i) => (call === 0 ? 0 : i % 2 ? 23 : 0));
    const pw = generatePassword(12, (n) => {
      const out = random(n);
      call++;
      return out;
    });
    expect(call).toBe(2);
    expect(pw).toBe("a2".repeat(6));
  });
  it("differs between calls", () => {
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20);
  });
});

describe("passwordProblem", () => {
  it("wants at least 10 characters", () => {
    expect(passwordProblem("short", "short")).toBe("Use at least 10 characters.");
  });
  it("refuses only spaces", () => {
    expect(passwordProblem(" ".repeat(12), " ".repeat(12))).toBe("Pick a password that isn't only spaces.");
  });
  it("wants the two to match", () => {
    expect(passwordProblem("long enough pass", "long enough pas")).toBe("The two passwords don't match.");
  });
  it("caps the length", () => {
    const long = "x".repeat(201);
    expect(passwordProblem(long, long)).toBe("Keep it under 200 characters.");
  });
  it("accepts a good pair", () => {
    expect(passwordProblem("long enough pass", "long enough pass")).toBeNull();
  });
});

describe("checkPerson", () => {
  it("builds a trimmed request body with numbers", () => {
    const { problems, body } = checkPerson(draft);
    expect(problems).toEqual({});
    expect(body).toMatchObject({ name: "Alex Morgan", monthlyIncome: 5400, yearsAtCompany: 0, jobLevel: 2 });
  });
  it("names each field that's out of range", () => {
    const { problems, body } = checkPerson({
      ...draft,
      name: "A",
      email: "alex@",
      password: "short",
      department: "",
      jobRole: "",
      monthlyIncome: "999",
      yearsAtCompany: "41",
    });
    expect(body).toBeNull();
    expect(Object.keys(problems).sort()).toEqual(
      ["department", "email", "jobRole", "monthlyIncome", "name", "password", "yearsAtCompany"].sort(),
    );
  });
  it("refuses fractions and blanks for numbers", () => {
    expect(checkPerson({ ...draft, monthlyIncome: "4500.5" }).problems.monthlyIncome).toBeDefined();
    expect(checkPerson({ ...draft, yearsAtCompany: " " }).problems.yearsAtCompany).toBeDefined();
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Alex Morgan")).toBe("Alex");
    expect(firstName("  Priya ")).toBe("Priya");
  });
});
