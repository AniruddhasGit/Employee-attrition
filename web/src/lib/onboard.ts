/**
 * Rules for HR adding a person and for that person's first sign-in. They mirror the API's
 * limits, so the form can say what's wrong before a request (the API's 422 detail is a list).
 */

import type { NewPerson } from "./api";

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200;
export const MIN_TEMP_PASSWORD = 8;

/** No 0/O, 1/l/I: a temporary password gets read aloud or copied off a screen. */
const READABLE = "abcdefghjkmnpqrstuvwxyz23456789";

/** A 12-character temporary password from the readable alphabet, always with a digit and a letter. */
export function generatePassword(length = 12, random: (n: number) => Uint32Array = randomWords): string {
  for (;;) {
    const words = random(length);
    const out = Array.from(words, (w) => READABLE[w % READABLE.length]).join("");
    if (/\d/.test(out) && /[a-z]/.test(out)) return out;
  }
}

function randomWords(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n));
}

/** What's wrong with a new password and its confirmation, or null when it can be sent. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Keep it under ${MAX_PASSWORD} characters.`;
  if (!password.trim()) return "Pick a password that isn't only spaces.";
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

/** The add-person form as typed: numbers stay strings until they're checked. */
export type PersonDraft = Omit<NewPerson, "monthlyIncome" | "yearsAtCompany"> & {
  monthlyIncome: string;
  yearsAtCompany: string;
};

export type DraftField = keyof PersonDraft;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function whole(value: string): number | null {
  const n = Number(value.replace(/[,\s$]/g, ""));
  return value.trim() && Number.isInteger(n) ? n : null;
}

/** Field-by-field problems with the draft (empty when it's ready), and the request body when it is. */
export function checkPerson(d: PersonDraft): { problems: Partial<Record<DraftField, string>>; body: NewPerson | null } {
  const problems: Partial<Record<DraftField, string>> = {};
  const name = d.name.trim();
  if (name.length < 2 || name.length > 80) problems.name = "Use 2 to 80 characters.";
  const email = d.email.trim();
  if (!EMAIL.test(email) || email.length > 254) problems.email = "Use a full work email, like alex@company.com.";
  if (d.password.length < MIN_TEMP_PASSWORD || d.password.length > MAX_PASSWORD || !d.password.trim())
    problems.password = `Use at least ${MIN_TEMP_PASSWORD} characters.`;
  if (!d.department) problems.department = "Pick a department.";
  if (!d.jobRole) problems.jobRole = "Pick a role.";
  if (!(d.jobLevel >= 1 && d.jobLevel <= 5)) problems.jobLevel = "Pick a level from 1 to 5.";
  const income = whole(d.monthlyIncome);
  if (income === null || income < 1000 || income > 25000) problems.monthlyIncome = "Use a whole number from 1,000 to 25,000.";
  const years = whole(d.yearsAtCompany);
  if (years === null || years < 0 || years > 40) problems.yearsAtCompany = "Use a whole number from 0 to 40.";

  if (Object.keys(problems).length > 0 || income === null || years === null) return { problems, body: null };
  return {
    problems,
    body: {
      name,
      email,
      password: d.password,
      department: d.department,
      jobRole: d.jobRole,
      jobLevel: d.jobLevel,
      monthlyIncome: income,
      yearsAtCompany: years,
      overTime: d.overTime,
      businessTravel: d.businessTravel,
    },
  };
}

/** "Alex Morgan" -> "Alex". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
