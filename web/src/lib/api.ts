/** Typed client for the Retain API. Every call throws ApiError on failure. */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export type Band = "low" | "elevated" | "high";

export type Driver = {
  feature: string;
  value: string | number;
  impact: number;
  direction: "raises" | "lowers";
  text: string;
};

export type EmployeeCard = {
  id: number;
  department: string;
  jobRole: string;
  jobLevel: number;
  yearsAtCompany: number;
  monthlyIncome: number;
  overTime: "Yes" | "No";
  riskScore: number;
  riskBand: Band;
  drivers: Driver[];
};

export type Levers = {
  overTime?: "Yes" | "No";
  monthlyIncome?: number;
  stockOptionLevel?: number;
  jobLevel?: number;
  trainingTimesLastYear?: number;
  businessTravel?: "Non-Travel" | "Travel_Rarely" | "Travel_Frequently";
  yearsSinceLastPromotion?: number;
};

export type EmployeeDetail = EmployeeCard & { levers: Required<Levers> };

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

export type Metrics = {
  version: string;
  threshold: number;
  nTest: number;
  nTestPos: number;
  before: MetricSet;
  after: MetricSet;
  thresholdCurve: { threshold: number; precision: number; recall: number; f1: number }[];
  calibration: { mean_pred: number; frac_pos: number; n: number }[];
  fairness: FairnessSlice[];
};

export type DriverShare = { feature: string; text: string; share: number };

export type Workforce = {
  headcount: number;
  leavers: number;
  meanRisk: number;
  expectedLeavers: number;
  expectedCost: number;
  replacementPct: number;
  distribution: { bin: number; count: number }[];
  heatmap: { department: string; jobRole: string; n: number; meanRisk: number; expectedCost: number }[];
  topDrivers: DriverShare[];
};

export type Segment = { department?: string; jobRole?: string; overTime?: "Yes" | "No"; jobLevel?: number };

export type SegmentStats = {
  label: string;
  n: number;
  attritionRate: number | null;
  meanRisk: number | null;
  expectedCost: number;
  topDrivers: DriverShare[];
  smallSample: boolean;
};

export type Hypothesis = { title: string; body: string };

export type Scenario = {
  publicId: string;
  employee: EmployeeCard;
  levers: Levers;
  before: number;
  after: number;
  delta: number;
  createdAt: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the model right now.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : "Something went wrong.";
    throw new ApiError(res.status, message);
  }
  return body as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

export const listEmployees = (p: {
  department?: string; jobRole?: string; band?: Band; sort?: "risk" | "id"; limit?: number; offset?: number;
} = {}) => request<{ items: EmployeeCard[]; total: number }>(`/api/employees${qs(p)}`);

export const randomEmployee = (band?: Band) =>
  request<EmployeeCard>(`/api/employees/random${qs({ band })}`);

export const getEmployee = (id: number) => request<EmployeeDetail>(`/api/employees/${id}`);

export const simulate = (employeeId: number, levers: Levers) =>
  request<SimulateResult>("/api/simulate", {
    method: "POST",
    body: JSON.stringify({ employeeId, levers }),
  });

export const getMetrics = () => request<Metrics>("/api/model/metrics");

export const getWorkforce = (replacementPct = 50) =>
  request<Workforce>(`/api/workforce/summary${qs({ replacementPct })}`);

export const compareSegments = (a: Segment, b: Segment, replacementPct = 50) => {
  const params: Record<string, string | number | undefined> = { replacementPct };
  for (const [side, seg] of [["a", a], ["b", b]] as const) {
    for (const [k, v] of Object.entries(seg)) params[`${side}.${k}`] = v;
  }
  return request<{ a: SegmentStats; b: SegmentStats }>(`/api/workforce/compare${qs(params)}`);
};

export const getHypotheses = () => request<Record<string, Hypothesis>>("/api/hypotheses");

export const saveScenario = (employeeId: number, levers: Levers) =>
  request<{ publicId: string }>("/api/scenarios", {
    method: "POST",
    body: JSON.stringify({ employeeId, levers }),
  });

export const getScenario = (publicId: string) =>
  request<Scenario>(`/api/scenarios/${encodeURIComponent(publicId)}`);

export const sendContact = (body: {
  name: string; email: string; message: string; consent: boolean; website: string;
}) => request<{ ok: true }>("/api/contact", { method: "POST", body: JSON.stringify(body) });
