/**
 * Typed client for the Retain API. Every call goes to this site's own /api (the web server
 * proxies it), so the session cookie is first-party. Every call throws ApiError on failure.
 */

export type Band = "low" | "elevated" | "high";
export type Role = "hr" | "employee";

export type Driver = {
  feature: string;
  value: string | number;
  impact: number;
  direction: "raises" | "lowers";
  text: string;
};

export type Session = { role: Role; displayName: string; home: "/hr" | "/me" };
export type DemoAccount = { email: string; label: string; role: Role };

export type Option = { value: string | number; label: string };
export type Question = {
  key: keyof Answers;
  label: string;
  kind: "scale" | "yesno" | "travel" | "count";
  options: Option[];
};
export type Travel = "Non-Travel" | "Travel_Rarely" | "Travel_Frequently";
export type Answers = {
  environmentSatisfaction: number;
  jobSatisfaction: number;
  relationshipSatisfaction: number;
  workLifeBalance: number;
  jobInvolvement: number;
  overTime: "Yes" | "No";
  businessTravel: Travel;
  trainingTimesLastYear: number;
};
export type KeepOption = { key: string; label: string };
export type TeamNote = { quarter: string; said: string; did: string };

export type MeHome = {
  displayName: string;
  department: string;
  jobRole: string;
  quarter: string;
  checkInStatus: "open" | "done";
  keepMe: string[];
  comment: string | null;
  keepMeOptions: KeepOption[];
  updates: TeamNote[];
  history: { quarter: string; answers: Answers; keepMe: string[]; comment: string | null }[];
};

export type CheckInForm = {
  quarter: string;
  notice: string;
  questions: Question[];
  keepMeOptions: KeepOption[];
  current: { answers: Answers; keepMe: string[]; comment: string } | null;
};

export type Levers = {
  overTime?: "Yes" | "No";
  monthlyIncome?: number;
  stockOptionLevel?: number;
  jobLevel?: number;
  trainingTimesLastYear?: number;
  businessTravel?: Travel;
  yearsSinceLastPromotion?: number;
};

export type SimulateResult = {
  before: number;
  after: number;
  delta: number;
  beforeBand: Band;
  afterBand: Band;
  drivers: Driver[];
};

export type MetricSet = {
  roc_auc: number;
  pr_auc: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  brier: number;
  confusion: [[number, number], [number, number]];
  threshold: number;
  ci?: Record<string, [number, number]>;
};
export type Metrics = { before: MetricSet; after: MetricSet; nTest: number };

/** Company-wide figures for the public landing page (aggregates only). */
export type PublicSummary = {
  metrics: Metrics;
  riskiest: { department: string; jobRole: string; n: number; meanRisk: number };
  overtime: { yes: number; no: number };
  topDriver: { text: string; share: number };
};

export type FairnessSlice = {
  group: "Gender" | "AgeBand" | "MaritalStatus";
  value: string;
  n: number;
  attrition_rate: number;
  mean_risk: number;
  precision: number | null;
  recall: number | null;
  flag_rate: number;
  small_sample: boolean;
};

export type DropField = { column: string; label: string; from: number; to: number };
export type SharpDrop = {
  id: number;
  name: string;
  department: string;
  jobRole: string;
  riskScore: number;
  prevRiskScore: number;
  fields: DropField[];
  riskJump: boolean;
};
export type HeatCell = { department: string; jobRole: string; n: number; meanRisk: number; expectedCost: number };
export type KeepTheme = { department: string; n: number; hidden: boolean; top: { key: string; label: string; share: number }[] };

export type Dashboard = {
  quarter: string;
  previousQuarter: string;
  headcount: number;
  highRisk: number;
  costAtStake: number;
  replacementPct: number;
  meanRisk: number;
  meanRiskPrev: number | null;
  responseRate: number;
  sharpDrops: SharpDrop[];
  heatmap: HeatCell[];
  keepThemes: KeepTheme[];
  trust: {
    rocAuc: number;
    prAuc: number;
    recall: number;
    precision: number;
    threshold: number;
    nTest: number;
    fairness: FairnessSlice[];
  };
};

export type PersonRow = {
  id: number;
  name: string;
  department: string;
  jobRole: string;
  riskScore: number;
  riskBand: Band;
  trend: "up" | "down" | "flat";
  answered: boolean;
};

export type ActionKey =
  | "pay_review"
  | "promotion"
  | "reduce_overtime"
  | "stock_grant"
  | "training_plan"
  | "reduce_travel"
  | "stay_interview";

export type Plan = {
  id: number;
  action: ActionKey;
  label: string;
  note: string;
  status: "open" | "done";
  createdQuarter: string;
  scoreAtCreation: number;
  estimatedScore: number;
  doneAt: string | null;
  actualChange: number | null;
};

export type Person = {
  id: number;
  name: string;
  department: string;
  jobRole: string;
  jobLevel: number;
  yearsAtCompany: number;
  monthlyIncome: number;
  overTime: "Yes" | "No";
  riskScore: number;
  riskBand: Band;
  drivers: Driver[];
  levers: Required<Levers>;
  riskHistory: { quarter: string; riskScore: number }[];
  checkIns: { quarter: string; answers: Answers; keepMe: string[]; comment: string | null; submittedAt: string }[];
  change: string | null;
  plans: Plan[];
};

export type CheckInStatus = {
  quarter: string;
  responseRate: number;
  byDepartment: { department: string; answered: number; total: number }[];
  missing: { id: number; name: string; department: string; jobRole: string }[];
  updates: (TeamNote & { id: number; department: string })[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the model right now.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : "Something went wrong.";
    throw new ApiError(res.status, message);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown, method = "POST") =>
  request<T>(path, { method, body: JSON.stringify(body) });

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

// Auth
export const signIn = (email: string, password: string) => post<Session>("/api/auth/login", { email, password });
export const signOut = () => post<void>("/api/auth/logout", {});
export const getSession = () => request<Session>("/api/auth/me");
export const getDemoAccounts = () => request<DemoAccount[]>("/api/auth/demo-accounts");

// Employee
export const getMe = () => request<MeHome>("/api/me");
export const getCheckInForm = () => request<CheckInForm>("/api/me/check-in");
export const submitCheckIn = (body: { answers: Answers; keepMe: string[]; comment: string }) =>
  post<{ quarter: string; status: "done" }>("/api/me/check-in", body);

// HR
export const getDashboard = (replacementPct = 50) => request<Dashboard>(`/api/hr/dashboard${qs({ replacementPct })}`);
export const listPeople = (p: { search?: string; department?: string; band?: Band; limit?: number; offset?: number } = {}) =>
  request<{ items: PersonRow[]; total: number }>(`/api/hr/people${qs(p)}`);
export const getPerson = (id: number) => request<Person>(`/api/hr/people/${id}`);
export const simulate = (employeeId: number, levers: Levers) =>
  post<SimulateResult>("/api/hr/simulate", { employeeId, levers });
export const createPlan = (employeeId: number, action: ActionKey, note = "") =>
  post<Plan>(`/api/hr/people/${employeeId}/plans`, { action, note });
export const markPlanDone = (planId: number) => post<Plan>(`/api/hr/plans/${planId}`, { status: "done" }, "PATCH");
export const getCheckIns = () => request<CheckInStatus>("/api/hr/check-ins");
export const postUpdate = (body: { department: string; said: string; did: string }) =>
  post<TeamNote & { id: number; department: string }>("/api/hr/updates", body);
export const getPublicSummary = () => request<PublicSummary>("/api/public/summary");
export const sendContact = (body: { name: string; email: string; message: string; consent: boolean; website: string }) =>
  post<{ ok: true }>("/api/contact", body);
