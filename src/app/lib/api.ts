// ─── Wakefit REST API client ───────────────────────────────────────────────
// Matches wakefit_nodered_api_v1_4_5_docker.json exactly. Every field name
// and shape here mirrors what the Node-RED function nodes actually send.
//
// IMPORTANT: set API_BASE to wherever your Node-RED container publishes its
// port (default Node-RED port is 1880 unless remapped in docker-compose).
// If you're serving this frontend FROM the same Node-RED instance (GET /ui),
// you can leave API_BASE = "" so requests are same-origin. If the frontend
// is hosted separately, point this at http://<host>:<port>.
export const API_BASE = "http://localhost:1880";

// ── Shared types ────────────────────────────────────────────────────────────

export type Role = "admin" | "supervisor" | "operator";
export type OverallStatus = "OK" | "NOT OK";

export interface ApiUser {
  username: string;
  role: Role;
  lastActive: string | null;
}

export interface LoginResponse {
  success: true;
  username: string;
  role: Role;
  lastActive: string;
}

export interface ModelParameter {
  channel: number;
  name: string; // becomes the actual sensor/column key everywhere downstream
  label: string;
  unit: string;
  referenceValue: number | null;
  min: number;
  max: number;
  active: boolean;
}

export interface ModelOperation {
  name: string;
  unit: string;
  channelX: number;
  operator: "+" | "-";
  channelY: number;
}

export interface WakefitModel {
  partNumber: string;
  modelName: string;
  category: string;
  active: boolean;
  parameters: ModelParameter[];
  operations: ModelOperation[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalScansToday: number;
  activeModels: number;
  totalModelsConfigured: number;
  currentRunningModel: {
    modelName: string;
    partNumber: string;
    category: string;
    lastScanned: string;
    lastOperator: string | null;
    lastRole: string | null;
  } | null;
}

export interface ApprovedScansPoint {
  day: string; // YYYY-MM-DD
  okCount: number;
  nokCount: number;
  count: number;
}

export interface RecentScan {
  scanId: number;
  partNumber: string;
  modelName: string;
  status: OverallStatus | string | null;
  role: string | null;
  operatorUsername: string | null;
  time: string;
}

export interface ScanParamResult {
  channel: number;
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  ok: boolean;
  referenceValue?: number | null;
  absoluteValue?: number;
  relativeValue?: number;
}

export interface ScanOperationResult {
  name: string;
  unit: string;
  channelX: number;
  operator: "+" | "-";
  channelY: number;
  valueX: number;
  valueY: number;
  value: number;
}

export interface ScanRecord {
  scanId: string;
  partId: string;
  partNumber: string;
  modelName: string;
  category: string;
  results: ScanParamResult[];
  operations?: ScanOperationResult[];
  overallStatus: OverallStatus;
  timestamp: string;
  status: "processing" | "done" | "error";
  saved: boolean;
  simulated: boolean;
}

export interface ScanStartResponse {
  scanId: string;
  partId: string;
  status: "processing";
}

export interface HistoryRow {
  id: number;
  time: string;
  scanId: string;
  partId: string;
  partNumber: string;
  modelName: string;
  category: string;
  readings: Record<string, number>;
  status: OverallStatus;
  operatorUsername: string | null;
  operatorRole: string | null;
}

// ── Low-level fetch helper ──────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super((body && (body.error || body.message)) || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function login(username: string, password: string): Promise<LoginResponse> {
  return request("/wakefit/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request("/wakefit/dashboard/summary");
}

export function getApprovedScans(days = 30, modelName?: string): Promise<ApprovedScansPoint[]> {
  return request(`/wakefit/dashboard/approved-scans${qs({ days, modelName })}`);
}

export function getRecentScans(limit = 10): Promise<RecentScan[]> {
  return request(`/wakefit/dashboard/recent-scans${qs({ limit })}`);
}

// ── Scan & Validate ──────────────────────────────────────────────────────────

// simulate:true returns the full finished record immediately (status:"done").
// simulate:false (real hardware) returns 202 {scanId, partId, status:"processing"}
// and you must poll getScanResult() until status becomes "done".
export function startScan(partNumber: string, simulate: boolean): Promise<ScanRecord | ScanStartResponse> {
  return request("/wakefit/scan", { method: "POST", body: JSON.stringify({ partNumber, simulate }) });
}

export function getScanResult(scanId: string): Promise<ScanRecord> {
  return request(`/wakefit/scan/result${qs({ scanId })}`);
}

export function saveScan(scanId: string, username: string, role: Role, scanData?: ScanRecord) {
  return request<{ saved: boolean; scanId: string; overallStatus?: OverallStatus; reason?: string }>(
    "/wakefit/save-scan",
    {
      method: "POST",
      body: JSON.stringify({
        scanId,
        username,
        role,
        overallStatus: scanData?.overallStatus ?? "NOT OK",
        scanData,
      }),
    }
  );
}

export function printLabel(scanId: string, copies = 1) {
  return request<{ printed: boolean; error?: string }>("/wakefit/print", {
    method: "POST",
    body: JSON.stringify({ scanId, copies }),
  });
}

// Reprint a label for an already-saved history row (requires the v1.5.0
// flow patch — POST /wakefit/print with { historyId, copies } instead of
// scanId, since the original in-memory scanId is long gone by then).
export function printFromHistory(historyId: number, copies = 1) {
  return request<{ printed: boolean; error?: string }>("/wakefit/print", {
    method: "POST",
    body: JSON.stringify({ historyId, copies }),
  });
}

// Poll helper: repeatedly calls getScanResult until status is "done" or "error".
export async function pollScanResult(
  scanId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<ScanRecord> {
  const interval = opts.intervalMs ?? 700;
  const timeout = opts.timeoutMs ?? 30000;
  const start = Date.now();
  while (true) {
    const rec = await getScanResult(scanId);
    if (rec.status === "done" || rec.status === "error") return rec;
    if (Date.now() - start > timeout) throw new Error("Timed out waiting for sensor reading");
    await new Promise((r) => setTimeout(r, interval));
  }
}

// ── History ──────────────────────────────────────────────────────────────────

export function getHistory(params: {
  days?: number;
  startDate?: string;
  endDate?: string;
  partNumber?: string;
  modelName?: string;
  day?: string;
  role?: string;
}): Promise<HistoryRow[]> {
  return request(`/wakefit/history${qs(params as any)}`);
}

// ── Models ───────────────────────────────────────────────────────────────────

// NOTE: backend filters this list to active:true models only. Inactive
// models still exist and can be fetched individually or reactivated by
// PUT-ing active:true, but they won't show up here.
export function getModels(): Promise<WakefitModel[]> {
  return request("/wakefit/models");
}

export function getModel(partNumber: string): Promise<WakefitModel> {
  return request(`/wakefit/models/${encodeURIComponent(partNumber)}`);
}

export function createOrUpsertModel(model: {
  partNumber: string;
  modelName: string;
  category?: string;
  active?: boolean;
  parameters: Omit<ModelParameter, "channel"> extends never ? never : Partial<ModelParameter>[];
}): Promise<WakefitModel> {
  return request("/wakefit/models", { method: "POST", body: JSON.stringify(model) });
}

export function updateModel(
  partNumber: string,
  patch: { modelName?: string; category?: string; active?: boolean; parameters?: Partial<ModelParameter>[] }
): Promise<{ success: true; message: string; model: WakefitModel }> {
  return request(`/wakefit/models/${encodeURIComponent(partNumber)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteModel(partNumber: string): Promise<{ deleted: string }> {
  return request(`/wakefit/models/${encodeURIComponent(partNumber)}`, { method: "DELETE" });
}

// ── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): Promise<ApiUser[]> {
  return request("/wakefit/users");
}

export function updateUserPassword(username: string, password: string) {
  return request<{ success: true; username: string; message: string }>(
    `/wakefit/users/${encodeURIComponent(username)}`,
    { method: "PUT", body: JSON.stringify({ password }) }
  );
}

// ── Health ───────────────────────────────────────────────────────────────────

export function ping() {
  return request("/wakefit/ping");
}
