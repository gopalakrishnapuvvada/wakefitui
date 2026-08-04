import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import wakefitLogo from "@/imports/wakefitLogo.jfif";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import {
  LayoutDashboard, ScanLine, ClipboardList, Package, Users,
  ChevronDown, Search, Plus, Edit2, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Printer, ChevronRight, Settings, LogOut,
  Shield, Eye, EyeOff, X, Check, ArrowUpDown, TrendingUp,
  Activity, RefreshCw, Loader2, WifiOff,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import * as api from "@/app/lib/api";
import type {
  Role, OverallStatus, WakefitModel, ModelParameter, ScanRecord,
  HistoryRow, RecentScan, ApprovedScansPoint, DashboardSummary,
} from "@/app/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type View = "dashboard" | "scan" | "history" | "models" | "users" | "settings";

interface Session {
  username: string;
  role: Role;
  lastActive: string;
}

const SESSION_STORAGE_KEY = "wakefit-session";

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function loadSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<Session>;
    if (
      parsed &&
      typeof parsed.username === "string" &&
      typeof parsed.role === "string" &&
      typeof parsed.lastActive === "string"
    ) {
      return parsed as Session;
    }
  } catch {
    // Ignore malformed session data and fall back to a signed-out state.
  }

  return null;
}

function getParamStatus(value: number, min: number, max: number): "ok" | "nok" {
  return value >= min && value <= max ? "ok" : "nok";
}

function paramPercent(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fmtTimeIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function fmtDateDDMMYYYY(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function formatChartDate(value: string): string {
  if (!value) return "";

  const raw = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = raw.split("-").map(part => Number(part));

  if (![year, month, day].every(Number.isFinite)) return value;

  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OverallStatus }) {
  if (status === "OK") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      NOT OK
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    admin: "bg-purple-50 text-purple-700 border-purple-200",
    supervisor: "bg-blue-50 text-blue-700 border-blue-200",
    operator: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[role]}`}>
      {capitalize(role)}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-[#e2e2e8] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#44474e] uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>{value}</p>
          {sub && <p className="text-xs text-[#44474e] mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-[#f3f3f9]">
          <Icon className="w-5 h-5 text-[#2b6485]" />
        </div>
      </div>
    </Card>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline flex-shrink-0">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  );
}

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-[#2b6485]`} />;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: View; label: string; icon: React.ElementType; roles: Role[] }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["operator", "supervisor", "admin"] },
  { id: "scan", label: "Scan & Validate", icon: ScanLine, roles: ["operator", "supervisor", "admin"] },
  { id: "history", label: "History", icon: ClipboardList, roles: ["operator", "supervisor", "admin"] },
  { id: "models", label: "Model Management", icon: Package, roles: ["admin"] },
  { id: "users", label: "User Management", icon: Users, roles: ["admin"] },
  { id: "settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

function Sidebar({ view, setView, session, onLogout }: {
  view: View; setView: (v: View) => void; session: Session; onLogout: () => void;
}) {
  const allowedNavItems = NAV_ITEMS.filter(n => n.roles.includes(session.role));

  return (
    <aside className="w-60 flex-shrink-0 bg-[#031f41] flex flex-col h-full">
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <ImageWithFallback src={wakefitLogo} alt="Wakefit logo" className="h-9 w-auto object-contain" />
          <span className="text-white text-lg font-semibold tracking-wide">QC System</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {allowedNavItems.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                active ? "bg-[#1d3557] text-white" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-[#98cdf2]" : ""}`} />
              {item.label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/40" />}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-[#2b6485] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{session.username.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{session.username}</p>
            {/* <p className="text-white/40 text-[10px] truncate">{capitalize(session.role)}</p> */}
          </div>
          <button onClick={onLogout} title="Sign out" className="p-0">
            <LogOut className="w-3.5 h-3.5 text-white/30 hover:text-white/70 cursor-pointer flex-shrink-0 transition-colors" />
          </button>
        </div>
      </div>

      <div className="px-5 py-2.5 border-t border-white/10">
        <p className="text-white/30 text-[10px] text-center tracking-wide">
          Powered by <span className="text-white/50 font-semibold">Uventaim</span>
        </p>
      </div>
    </aside>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ title, sub, session }: { title: string; sub?: string; session: Session }) {
  const [online, setOnline] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api.ping()
        .then(() => { if (!cancelled) setOnline("online"); })
        .catch(() => { if (!cancelled) setOnline("offline"); });
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-[#e2e2e8] flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-xl font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>{title}</h1>
        {sub && <p className="text-xs text-[#44474e]">{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
          online === "online" ? "bg-emerald-50 border-emerald-200" :
          online === "offline" ? "bg-red-50 border-red-200" : "bg-[#f3f3f9] border-[#e2e2e8]"
        }`}>
          {online === "offline"
            ? <WifiOff className="w-3 h-3 text-red-500" />
            : <span className={`w-1.5 h-1.5 rounded-full ${online === "online" ? "bg-emerald-500 animate-pulse" : "bg-[#c4c6cf]"}`} />}
          <span className={`text-xs font-medium ${
            online === "online" ? "text-emerald-700" : online === "offline" ? "text-red-700" : "text-[#44474e]"
          }`}>
            {online === "online" ? "System Online" : online === "offline" ? "Backend Unreachable" : "Checking…"}
          </span>
        </div>
        {/* <div className="flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-lg border border-[#e2e2e8] bg-[#f9f9ff]">
          <Shield className="w-3.5 h-3.5 text-[#44474e]" />
          <span className="text-xs font-medium text-[#191c20]">{session.username}</span>
          <RoleBadge role={session.role} />
        </div> */}
      </div>
    </header>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

const DASHBOARD_AUTO_REFRESH_MS = 0.1 * 60 * 1000;

function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<ApprovedScansPoint[]>([]);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [models, setModels] = useState<WakefitModel[]>([]);
  const [chartModel, setChartModel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, c, r, m] = await Promise.all([
        api.getDashboardSummary(),
        api.getApprovedScans(30, chartModel === "all" ? undefined : chartModel),
        api.getRecentScans(10),
        api.getModels(),
      ]);
      setSummary(s); setChartData(c); setRecent(r); setModels(m);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [chartModel]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      load();
    }, DASHBOARD_AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    const container = chartScrollRef.current;
    if (!container) return;

    const frameId = window.requestAnimationFrame(() => {
      container.scrollLeft = container.scrollWidth;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [chartData]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner className="w-8 h-8" /></div>;
  }
  if (error) {
    return <ErrorBanner message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Total Scans Today" value={summary?.totalScansToday ?? 0} sub="Across all lines" icon={Activity} />
        <KpiCard label="Active Models" value={summary?.activeModels ?? 0} sub={`${summary?.totalModelsConfigured ?? 0} total configured`} icon={Package} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>
                Last 30 Days — Approved Scans
              </h3>
              <p className="text-xs text-[#44474e]">OK vs NOT OK scans</p>
            </div>
            <Select value={chartModel} onValueChange={setChartModel}>
              <SelectTrigger className="w-[180px] border-[#e2e2e8] bg-white text-xs font-medium text-[#191c20] focus-visible:border-[#031f41] focus-visible:ring-0">
                <SelectValue placeholder="All Models" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">All Models</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.partNumber} value={model.modelName}>
                    {model.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div ref={chartScrollRef} className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(520, chartData.length * 60)}px`, height: 195 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#44474e" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    minTickGap={10}
                    tickFormatter={(d: string) => formatChartDate(d)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#44474e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: "1px solid #e2e2e8", fontSize: 12 }}
                      formatter={(v: number, name: string | number) => [v, name === "OK" ? "OK" : "NOT OK"]}
                  />
                  <Bar dataKey="okCount" name="OK" stackId="status" fill="#2D6A4F" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="nokCount" name="NOT OK" stackId="status" fill="#E63946" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <h3 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>
              Current Running Model
            </h3>
          </div>
          {summary?.currentRunningModel ? (
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-0.5">Model</p>
                <p className="text-base font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
                  {summary.currentRunningModel.modelName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-0.5">Part Number</p>
                <p className="font-mono text-sm font-semibold text-[#2b6485]">{summary.currentRunningModel.partNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-0.5">Category</p>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f3f3f9] text-xs font-medium text-[#44474e] border border-[#e2e2e8]">
                  {summary.currentRunningModel.category || "—"}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-0.5">Last Scanned</p>
                <p className="text-sm font-medium text-[#191c20]">{fmtTime(summary.currentRunningModel.lastScanned)}</p>
                {summary.currentRunningModel.lastOperator && (
                  <p className="text-xs text-[#44474e] mt-0.5">by {summary.currentRunningModel.lastOperator}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <Package className="w-8 h-8 text-[#c4c6cf] mb-2" />
              <p className="text-sm text-[#44474e]">No model currently active</p>
              <p className="text-xs text-[#c4c6cf] mt-0.5">Start a scan to see the running model</p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e2e8]">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>Recent Scans</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f3f3f9] border border-[#e2e2e8] text-[10px] font-semibold text-[#44474e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2b6485]" />Latest scan outcomes
            </span>
          </div>
          <button onClick={load} className="flex items-center gap-1 text-xs text-[#2b6485] font-medium hover:underline">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f7f9fc] border-b border-[#e2e2e8]">
                {["Scan ID", "Part Number", "Model", "Status", "Role", "Time"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#44474e] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={r.scanId} className={`border-b border-[#e2e2e8] hover:bg-[#f9f9ff] transition-colors ${i === recent.length - 1 ? "border-0" : ""}`}>
                  <td className="px-5 py-3 font-mono text-xs font-bold text-[#031f41]">{r.scanId}</td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-[#2b6485]">{r.partNumber}</td>
                  <td className="px-5 py-3 font-medium text-[#191c20]">{r.modelName}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                      (r.status || "").toString().toUpperCase() === "OK"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${(r.status || "").toString().toUpperCase() === "OK" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {(r.status || "UNKNOWN").toString().toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.role ? <RoleBadge role={r.role as Role} /> : <span className="text-xs text-[#c4c6cf]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#44474e]">{fmtTime(r.time)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#44474e]">No recent scans yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Scan View ────────────────────────────────────────────────────────────────

type ScanState = "idle" | "reading" | "done" | "error";

function ScanView({ session }: { session: Session }) {
  const [models, setModels] = useState<WakefitModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedPartNumber, setSelectedPartNumber] = useState<string>("");
  const [simulate, setSimulate] = useState(true);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [record, setRecord] = useState<ScanRecord | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ saved: boolean; scanId?: string; reason?: string } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ printed: boolean; error?: string } | null>(null);
  const [showLabelDetails, setShowLabelDetails] = useState(false);
  const [printerEnabled, setPrinterEnabled] = useState(true);

  useEffect(() => {
    api.getModels()
      .then(setModels)
      .catch(e => setModelsError(e.message || "Failed to load models"));
    
    // Load printer enabled state from localStorage
    const stored = localStorage.getItem("printerEnabled");
    setPrinterEnabled(stored ? JSON.parse(stored) : true);
    
    // Listen for printer setting changes from SettingsView
    const handlePrinterSettingsChange = (event: any) => {
      setPrinterEnabled(event.detail.printerEnabled);
    };
    window.addEventListener("printerSettingsChanged", handlePrinterSettingsChange);
    
    // Also listen for storage events (for other tabs)
    const handleStorageChange = () => {
      const updated = localStorage.getItem("printerEnabled");
      setPrinterEnabled(updated ? JSON.parse(updated) : true);
    };
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("printerSettingsChanged", handlePrinterSettingsChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const activeModels = models.filter((model) => model.active);
  const selectedModel = activeModels.find((model) => model.partNumber === selectedPartNumber) || null;

  const handleSelectModel = (pn: string) => {
    setSelectedPartNumber(pn);
    setScanState("idle");
    setRecord(null);
    setScanError(null);
    setSaveResult(null);
    setPrintResult(null);
  };

  const handleStartScan = async () => {
    if (!selectedModel) return;
    setScanState("reading");
    setRecord(null);
    setScanError(null);
    setSaveResult(null);
    setPrintResult(null);
    try {
      const res = await api.startScan(selectedModel.partNumber, simulate);
      // const res = await api.startScan(selectedModel.partNumber, false);
      let finalRecord: ScanRecord;
      if ("results" in res) {
        // simulate:true — already finished
        finalRecord = res as ScanRecord;
      } else {
        // real hardware — poll until done
        finalRecord = await api.pollScanResult(res.scanId);
      }
      if (finalRecord.status === "error") {
        setScanState("error");
        setScanError("Sensor read failed. Check the IO-Link master connection.");
        return;
      }
      setRecord(finalRecord);
      setScanState("done");
      // Save all completed scan results, including failed ones, so the backend can persist the data payload.
      setSaving(true);
      try {
        const sr = await api.saveScan(finalRecord.scanId, session.username, session.role, finalRecord);
        setSaveResult(sr);
        setShowLabelDetails(false);

        // Only print labels for successful passes.
        if (finalRecord.overallStatus === "OK") {
          if (printerEnabled) {
            try {
              const printRes = await api.printLabel(sr.scanId, 1);
              setPrintResult(printRes);
            } catch (e: any) {
              setPrintResult({ printed: false, error: e.message });
            }
          } else {
            setPrintResult({ printed: true });
          }
        }
      } catch (e: any) {
        setSaveResult({ saved: false, reason: e.message });
        setShowLabelDetails(false);
      } finally {
        setSaving(false);
      }
    } catch (e: any) {
      setScanState("error");
      setScanError(e.message || "Scan failed");
    }
  };

  const handlePrint = async () => {
    if (!record) return;
    const labelScanId = saveResult?.scanId || record.scanId;
    setPrinting(true);
    setPrintResult(null);
    try {
      const res = await api.printLabel(labelScanId, 1);
      setPrintResult(res);
    } catch (e: any) {
      setPrintResult({ printed: false, error: e.message });
    } finally {
      setPrinting(false);
    }
  };

  const handleReset = () => {
    setSelectedPartNumber("");
    setScanState("idle");
    setRecord(null);
    setScanError(null);
    setSaveResult(null);
    setPrintResult(null);
  };

  const overallStatus = scanState === "done" ? record?.overallStatus ?? null : null;
  const labelPrinted = printResult?.printed === true;
  const labelScanId = saveResult?.scanId || record?.scanId || "";
  const labelQrData = useMemo(() => {
    if (!record || !selectedModel || !labelScanId) return "";

    return JSON.stringify({
      scanId: labelScanId,
      partNumber: selectedModel.partNumber,
      modelName: selectedModel.modelName,
      timestamp: fmtTimeIST(record.timestamp),
      status: record.overallStatus ?? "NOT OK",
    });
  }, [record, selectedModel, labelScanId]);

  const scanOperations = scanState === "done" && record?.operations ? record.operations : [];
  const displayOperations = useMemo(() => {
    if (scanState === "done" && scanOperations.length > 0) {
      return scanOperations.map((op: {
        name: string;
        unit: string;
        channelX: number;
        operator: "+" | "-";
        channelY: number;
        value: number;
      }) => ({
        ...op,
        hasValue: true,
      }));
    }

    if (selectedModel?.operations?.length) {
      return selectedModel.operations.map((op: {
        name: string;
        unit: string;
        channelX: number;
        operator: "+" | "-";
        channelY: number;
      }) => ({
        ...op,
        value: null,
        hasValue: false,
      }));
    }

    return [] as Array<{
      name: string;
      unit: string;
      channelX: number;
      operator: "+" | "-";
      channelY: number;
      value: number | null;
      hasValue: boolean;
    }>;
  }, [scanOperations, scanState, selectedModel]);

  const operationModeLabel = scanState === "done" ? "Live" : "Configured";
  const operationPanelSizingClass = !selectedModel
    ? "lg:min-h-[132px]"
    : scanState === "done"
      ? "lg:min-h-[280px]"
      : "lg:min-h-[220px]";

  return (
    <div className="w-full max-w-none space-y-5">
      {modelsError && <ErrorBanner message={modelsError} onRetry={() => window.location.reload()} />}

      <div className="grid gap-5 items-start lg:grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(500px,1fr)]">
        <div className="space-y-5">

      {/* Step 1: Model Selection */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#031f41] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
            <h2 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>Select Product Model</h2>
          </div>
          
          <label className="flex items-center gap-2 text-xs text-[#44474e] cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setSimulate(s => !s)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${simulate ? "bg-amber-400" : "bg-[#c4c6cf]"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mx-0.5 ${simulate ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            Simulate mode (no hardware)
          </label>
         
        </div>
        <div className="max-w-sm">
          <Select value={selectedPartNumber} onValueChange={handleSelectModel}>
            <SelectTrigger className="w-full border-[#e2e2e8] bg-white px-4 py-3 text-sm font-medium text-[#191c20] focus-visible:border-[#031f41] focus-visible:ring-0 data-[size=default]:h-auto">
              <SelectValue placeholder="— Choose a model —" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {activeModels.map((model) => (
                <SelectItem key={model.partNumber} value={model.partNumber}>
                  {model.modelName} ({model.category || "uncategorized"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedModel && (
          <p className="mt-2 text-xs text-[#44474e]">
            Part No: <span className="font-mono font-semibold text-[#2b6485]">{selectedModel.partNumber}</span>
            <span className="mx-2 text-[#c4c6cf]">·</span>
            {selectedModel.parameters.filter(p => p.active).length} active parameters
          </p>
        )}
      </Card>

      {/* Step 2: Sensor Reading */}
      {selectedModel && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#031f41] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
              <h2 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>Sensor Readings</h2>
              <span className="text-xs text-[#44474e] ml-1">— {selectedModel.modelName}</span>
            </div>
            <div className="flex items-center gap-3">
              {scanState === "idle" && (
                <button onClick={handleStartScan}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-lg bg-[#031f41] text-white text-base font-semibold hover:bg-[#1d3557] shadow-md transition-colors">
                  <ScanLine className="w-5 h-5" /> Scan Product
                </button>
              )}
              {scanState === "reading" && (
                <div className="flex items-center gap-2 text-sm font-medium text-[#2b6485]">
                  <Spinner className="w-5 h-5" /> Reading sensors…
                </div>
              )}
              {(scanState === "done" && overallStatus === "NOT OK") && (
                <button onClick={handleStartScan}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-lg text-base font-semibold shadow-md transition-colors bg-[#E63946] text-white hover:bg-red-700">
                  <ScanLine className="w-5 h-5" /> Re Scan
                </button>
              )}
              {(scanState === "done" && overallStatus === "OK") && (
                <div className="flex flex-col items-end gap-1.5">
                  <button onClick={handleStartScan} disabled={!labelPrinted}
                    className="flex items-center gap-2.5 px-7 py-3 rounded-lg text-base font-semibold shadow-md transition-colors bg-[#031f41] text-white hover:bg-[#1d3557] disabled:opacity-40 disabled:cursor-not-allowed">
                    <ScanLine className="w-5 h-5" /> Scan Product
                  </button>
                  {!labelPrinted && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Print the label to enable scanning the next product
                    </p>
                  )}
                </div>
              )}
              {scanState === "error" && (
                <button onClick={handleStartScan}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-lg text-base font-semibold shadow-md transition-colors bg-[#E63946] text-white hover:bg-red-700">
                  <ScanLine className="w-5 h-5" /> Retry Scan
                </button>
              )}
            </div>
          </div>

          {scanError && <div className="mb-4"><ErrorBanner message={scanError} /></div>}

          {/* Sensor parameters grid */}
          <div className="grid grid-cols-2 gap-3">
            {selectedModel.parameters.filter(p => p.active).map((p) => {
              const result = record?.results.find(r => r.name === p.name);
              const hasValue = !!result;
              const isReading = scanState === "reading" && !hasValue;
              const status = hasValue ? (result!.ok ? getParamStatus(result!.value, p.min, p.max) : "nok") : null;
              const pct = hasValue ? paramPercent(result!.value, p.min, p.max) : 0;

              const bgColor = !hasValue ? "bg-[#f9f9ff]" :
                status === "nok" ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";
              const valueColor = !hasValue ? "text-[#c4c6cf]" :
                status === "nok" ? "text-red-600" : "text-emerald-700";

              return (
                <div key={p.channel + p.name} className={`rounded-lg border p-4 transition-all duration-300 ${bgColor}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold text-[#44474e] uppercase tracking-wide">{p.label || p.name}</p>
                      <p className="text-[10px] text-[#44474e] mt-0.5">CH-{p.channel} · Range: {p.min} – {p.max} {p.unit}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isReading && <div className="w-5 h-5 rounded-full border-2 border-[#2b6485] border-t-transparent animate-spin" />}
                      {hasValue && status === "ok" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {hasValue && status === "nok" && <XCircle className="w-5 h-5 text-red-500" />}
                    </div>
                  </div>
                  <div className={`text-2xl font-bold mb-2 transition-all duration-300 ${valueColor}`} style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
                    {isReading
                      ? <span className="text-base text-[#c4c6cf] font-normal">Waiting for sensor…</span>
                      : hasValue
                      ? <>{result!.value} <span className="text-sm font-medium">{p.unit}</span></>
                      : <span className="text-base text-[#c4c6cf] font-normal">No reading</span>}
                  </div>
                  {/* Reference Value & Relative Value */}
                  {(p.referenceValue !== null && p.referenceValue !== undefined) && (
                    <div className="flex items-center gap-3 mb-2 text-[11px] font-medium">
                      <span className="text-[#44474e]">
                        Ref: <span className="font-semibold text-[#191c20]">{p.referenceValue} {p.unit}</span>
                      </span>
                      {hasValue && (
                        <span className={`${
                          Math.abs(result!.value - p.referenceValue) <= (p.max - p.min) * 0.1
                            ? "text-emerald-700"
                            : "text-amber-600"
                        }`}>
                          Relative: <span className="font-semibold">{(p.referenceValue - result!.value).toFixed(2)} {p.unit}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="relative h-1.5 bg-[#e2e2e8] rounded-full overflow-visible">
                    <div className="absolute inset-0 flex">
                      <div className="w-[10%] border-r border-dashed border-amber-400/60" />
                      <div className="flex-1" />
                      <div className="w-[10%] border-l border-dashed border-amber-400/60" />
                    </div>
                    {hasValue && (
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        status === "nok" ? "bg-red-400" : "bg-emerald-400"
                      }`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                    )}
                    {hasValue && (
                      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-all duration-500"
                        style={{
                          left: `calc(${Math.min(100, Math.max(2, pct))}% - 5px)`,
                          background: status === "nok" ? "#f87171" : "#34d399",
                        }} />
                    )}
                  </div>
                  {hasValue && status === "nok" && (
                    <p className="text-[10px] text-red-600 mt-1.5 font-medium">Out of specification</p>
                  )}
                </div>
              );
            })}
          </div>

          {scanState === "idle" && (
            <div className="mt-5 pt-4 border-t border-[#e2e2e8] flex items-center gap-2 text-xs text-[#44474e]">
              <ScanLine className="w-3.5 h-3.5" />
              {simulate
                ? <>Simulate mode is on — press <strong className="text-[#191c20] mx-1">Scan Product</strong> to generate a fake reading instantly.</>
                : <>Place the product on the measurement station and press <strong className="text-[#191c20] mx-1">Scan Product</strong> to read the IO-Link sensors.</>}
            </div>
          )}
        </Card>
      )}

      {/* Step 3: Validation Result */}
      {scanState === "done" && overallStatus && record && (
        <div className={`rounded-xl border-2 p-6 ${overallStatus === "OK" ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-start gap-4">
            {overallStatus === "OK"
              ? <CheckCircle2 className="w-12 h-12 text-emerald-500 flex-shrink-0" />
              : <XCircle className="w-12 h-12 text-red-500 flex-shrink-0" />}
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1" style={{
                fontFamily: "Barlow Condensed, sans-serif",
                color: overallStatus === "OK" ? "#1a5c39" : "#9b1c1c",
              }}>
                Product {overallStatus === "OK" ? "PASSED" : "FAILED"} Quality Check
              </h2>
              <p className="text-sm font-medium mb-3" style={{ color: overallStatus === "OK" ? "#065f46" : "#991b1b" }}>
                {overallStatus === "OK"
                  ? "All sensor readings within specification. Product approved for release."
                  : `${record.results.filter(r => !r.ok).length} sensor reading(s) out of specification. Product must be reworked or rejected.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {record.results.map(r => (
                  <span key={r.name} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                    !r.ok ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}>
                    {!r.ok ? <XCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    {r.name}: {r.value} {r.unit}
                  </span>
                ))}
              </div>
              {overallStatus === "OK" && (
                <div className="mt-3 text-xs">
                  {/* {saving && <span className="flex items-center gap-1.5 text-[#44474e]"><Spinner className="w-3.5 h-3.5" /> Saving to history…</span>} */}
                  {saveResult && saveResult.saved && <span className="flex items-center gap-1.5 text-emerald-700 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Saved to history</span>}
                  {saveResult && !saveResult.saved && <span className="flex items-center gap-1.5 text-amber-700 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> {saveResult.reason || "Not saved"}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Label */}
      {scanState === "done" && overallStatus === "OK" && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#031f41] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
            <h2 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>Label</h2>
          </div>

          {!showLabelDetails ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setShowLabelDetails(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors">
                <Printer className="w-4 h-4" /> Show Label
              </button>
              <button onClick={handleReset} className="text-xs text-[#2b6485] hover:underline font-medium">
                Scan another product →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#e2e2e8] bg-[#f9f9ff] p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#191c20]">Label Details</p>
                  {labelScanId && (
                    <span className="font-mono text-xs font-bold text-[#031f41] bg-white border border-[#e2e2e8] px-2 py-0.5 rounded">
                      {labelScanId}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 text-sm text-[#44474e] sm:grid-cols-2">
                  <div><span className="font-semibold text-[#191c20]">Scan ID:</span> {labelScanId || "—"}</div>
                  <div><span className="font-semibold text-[#191c20]">Model:</span> {selectedModel?.modelName || "—"}</div>
                  <div><span className="font-semibold text-[#191c20]">Timestamp:</span> {record ? fmtTimeIST(record.timestamp) : "—"}</div>
                  <div><span className="font-semibold text-[#191c20]">Status:</span> <span className="text-emerald-700 font-semibold">✓ OK</span></div>
                </div>
                {labelQrData && (
                  <div className="pt-2 border-t border-[#e2e2e8]">
                    <p className="text-xs font-semibold text-[#44474e] uppercase tracking-wide mb-2">QR Code</p>
                    <div className="inline-block rounded border border-[#e2e2e8] bg-white p-1">
                      <QRCodeSVG value={labelQrData} size={140} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={handlePrint} disabled={printing || saving || !printerEnabled}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors disabled:opacity-50"
                  title={!printerEnabled ? "Printer is disabled in settings" : ""}>
                  {printing ? <Spinner className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                  {printing ? "Printing…" : "Print Label"}
                </button>
                {printResult?.printed && printerEnabled && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Label sent to printer
                  </div>
                )}
                {printResult && !printResult.printed && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                    <XCircle className="w-3.5 h-3.5" /> {printResult.error || "Print failed"}
                  </div>
                )}
                <button onClick={() => setShowLabelDetails(false)} className="text-xs text-[#2b6485] hover:underline font-medium">
                  Hide Label
                </button>
                <button onClick={handleReset} className="ml-auto text-xs text-[#2b6485] hover:underline font-medium">
                  Scan another product →
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
        </div>

        <Card className={`p-5 lg:sticky lg:top-5 ${operationPanelSizingClass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>
              Operation Details
            </h2>
            {selectedModel && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#e2e2e8] bg-[#f7f9fc] text-[#44474e] font-semibold">
                {displayOperations.length} row{displayOperations.length === 1 ? "" : "s"} • {operationModeLabel}
              </span>
            )}
          </div>

          {!selectedModel && (
            <div className="rounded-lg border border-dashed border-[#e2e2e8] bg-[#f9f9ff] p-4 text-sm text-[#44474e] space-y-1">
              {/* <p>Select a product model to view configured operations.</p> */}
              <p>After scan, this panel switches to live operation values.</p>
            </div>
          )}

          {selectedModel && displayOperations.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#e2e2e8] bg-[#f9f9ff] p-4 text-sm text-[#44474e]">
              No operations configured for this model.
            </div>
          )}

          {displayOperations.length > 0 && (
            <div className="rounded-lg border border-[#e2e2e8] overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-[#f7f9fc] border-b border-[#e2e2e8]">
                      <th className="w-[32%] text-left px-4 py-2.5 text-[11px] font-semibold text-[#44474e] uppercase tracking-wide">Operation Name</th>
                      <th className="w-[26%] text-left px-4 py-2.5 text-[11px] font-semibold text-[#44474e] uppercase tracking-wide">Operation</th>
                      <th className="w-[14%] text-left px-4 py-2.5 text-[11px] font-semibold text-[#44474e] uppercase tracking-wide">X</th>
                      <th className="w-[14%] text-left px-4 py-2.5 text-[11px] font-semibold text-[#44474e] uppercase tracking-wide">Y</th>
                      <th className="w-[14%] text-right px-4 py-2.5 text-[11px] font-semibold text-[#44474e] uppercase tracking-wide">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayOperations.map((op: {
                      name: string;
                      unit: string;
                      channelX: number;
                      operator: "+" | "-";
                      channelY: number;
                      value: number | null;
                      hasValue: boolean;
                    }, index: number) => (
                      <tr
                        key={`${op.name}-${op.channelX}-${op.channelY}-${index}`}
                        className={index < displayOperations.length - 1 ? "border-b border-[#f3f3f9]" : ""}
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-[#191c20] max-w-[220px] truncate" title={op.name}>{op.name || "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-[#44474e]">{op.operator === "+" ? "Addition (+)" : "Subtraction (-)"}</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-[#2b6485]">CH-{op.channelX}</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-[#2b6485]">CH-{op.channelY}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-[#191c20] text-right">
                          {op.hasValue && typeof op.value === "number" ? (
                            <>
                              {op.value.toFixed(2)}
                              {op.unit ? <span className="font-normal text-[#44474e]"> {op.unit}</span> : null}
                            </>
                          ) : (
                            <span className="font-normal text-[#c4c6cf]">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────

function HistoryView() {
  const [filterModel, setFilterModel] = useState("all");
  const [filterStatus, setFilterStatus] = useState<OverallStatus | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"time" | "modelName" | "operatorUsername">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [models, setModels] = useState<WakefitModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [printMsg, setPrintMsg] = useState<{ id: number; ok: boolean; text: string } | null>(null);
  const [printerEnabled, setPrinterEnabled] = useState(true);
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);
  const hasValidDateRange = Boolean(startDate && endDate && startDate <= endDate);

  const handleReprint = async (row: HistoryRow) => {
    setPrintingId(row.id);
    setPrintMsg(null);
    try {
      const res = await api.printFromHistory(row.id, 1);
      setPrintMsg({ id: row.id, ok: res.printed, text: res.printed ? "Sent to printer" : (res.error || "Print failed") });
    } catch (e: any) {
      setPrintMsg({ id: row.id, ok: false, text: e.message || "Print failed" });
    } finally {
      setPrintingId(null);
    }
  };

  const loadHistory = useCallback(async () => {
    setError(null);

    if (startDate && endDate && startDate > endDate) {
      setError("Start date must be before or equal to end date.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const h = await api.getHistory({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        modelName: filterModel === "all" ? undefined : filterModel,
      });
      setRows(h);
    } catch (e: any) {
      setError(e.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [filterModel, startDate, endDate]);

  const loadModels = useCallback(async () => {
    try {
      const m = await api.getModels();
      setModels(m);
    } catch (e: any) {
      setError(e.message || "Failed to load models");
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    // Load printer enabled state from localStorage
    const stored = localStorage.getItem("printerEnabled");
    setPrinterEnabled(stored ? JSON.parse(stored) : true);
    
    // Listen for printer setting changes from SettingsView
    const handlePrinterSettingsChange = (event: any) => {
      setPrinterEnabled(event.detail.printerEnabled);
    };
    window.addEventListener("printerSettingsChanged", handlePrinterSettingsChange);
    
    // Also listen for storage events (for other tabs)
    const handleStorageChange = () => {
      const updated = localStorage.getItem("printerEnabled");
      setPrinterEnabled(updated ? JSON.parse(updated) : true);
    };
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("printerSettingsChanged", handlePrinterSettingsChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {};
    rows.forEach(r => { const d = r.time.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
  }, [rows]);

  const filtered = useMemo(() => {
    let data = [...rows];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.scanId.toLowerCase().includes(q) ||
        r.partNumber.toLowerCase().includes(q) ||
        r.modelName.toLowerCase().includes(q) ||
        (r.operatorUsername || "").toLowerCase().includes(q));
    }
    if (filterStatus !== "all") {
      const targetStatus = filterStatus.toUpperCase();
      data = data.filter(r => (r.status || "").toString().toUpperCase() === targetStatus);
    }
    data.sort((a, b) => {
      const av = String(a[sortCol] ?? ""), bv = String(b[sortCol] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return data;
  }, [rows, search, filterStatus, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const exportHistory = () => {
    const headers = [
      "Scan ID",
      "Part Number",
      "Model",
      "Category",
      "Status",
      "Timestamp",
      "Operator",
      "Operator Role",
      "Readings",
      "Operations",
      "Reference",
      "Relative",
    ];

    const rowsToExport = filtered.map(r => [
      r.scanId,
      r.partNumber,
      r.modelName,
      r.category || "",
      (r.status || "UNKNOWN").toString().toUpperCase(),
      fmtTime(r.time),
      r.operatorUsername || "",
      r.operatorRole || "",
      JSON.stringify(r.readings || {}),
      JSON.stringify(r.operations || []),
      JSON.stringify(r.reference || {}),
      JSON.stringify(r.relative || {}),
    ]);

    const escapeCsvValue = (value: unknown) => {
      if (value === null || value === undefined) return "";
      const text = String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csv = [headers.join(","), ...rowsToExport.map(row => row.map(escapeCsvValue).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const reportFileName = `wakefit_report_${dd}${mm}${yyyy}&${hh}${min}${ss}${ms}.csv`;
    anchor.href = url;
    anchor.download = reportFileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const isReprintDisabled = (row: HistoryRow) => {
    const status = (row.status || "").toString().toUpperCase();
    return printingId === row.id || !printerEnabled || status !== "OK";
  };

  return (
    <div className="space-y-5">
      {/* <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>
              Approved Scans — {TIME_RANGE_LABELS[timeRange]}
            </h3>
            <p className="text-xs text-[#44474e]">OK-only entries</p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            {filtered.length} approved this period
          </span>
        </div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(520, chartData.length * 60)}px`, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#44474e" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={10}
                  tickFormatter={(d: string) => formatChartDate(d)}
                />
                <YAxis tick={{ fontSize: 11, fill: "#44474e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid #e2e2e8", fontSize: 12 }} formatter={(v: number) => [v, "Approved"]} />
                <Bar dataKey="count" name="Approved" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card> */}

      <Card className="px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#44474e]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part number, model, operator…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors" />
          </div>
          <Select value={filterModel} onValueChange={setFilterModel}>
            <SelectTrigger className="w-[220px] border-[#e2e2e8] bg-white text-sm text-[#191c20] focus-visible:border-[#031f41] focus-visible:ring-0">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Models</SelectItem>
              {models.map((model) => (
                <SelectItem key={model.partNumber} value={model.modelName}>
                  {model.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as OverallStatus | "all")}>
            <SelectTrigger className="w-[180px] border-[#e2e2e8] bg-white text-sm text-[#191c20] focus-visible:border-[#031f41] focus-visible:ring-0">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="NOT OK">NOT OK</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#44474e]">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#44474e]">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41]"
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs text-[#2b6485] font-medium hover:underline">
              Clear dates
            </button>
          )}
          <button onClick={loadHistory} disabled={!hasValidDateRange} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#e2e2e8] text-base text-[#2b6485] font-semibold hover:bg-[#f3f3f9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
             View
          </button>
          <button onClick={exportHistory} disabled={!hasValidDateRange} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#e2e2e8] text-base text-[#2b6485] font-semibold hover:bg-[#f3f3f9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
            Export
          </button>
          <span className="text-xs text-[#44474e] ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </Card>

      {error && <ErrorBanner message={error} onRetry={loadHistory} />}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner className="w-6 h-6" /></div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[62vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f9fc] border-b border-[#e2e2e8]">
                  {[
                    { key: "scanId", label: "Scan ID", sortable: false },
                    { key: "partNumber", label: "Part Number", sortable: false },
                    { key: "modelName", label: "Model", sortable: true },
                    { key: "status", label: "Status", sortable: false },
                    { key: "readings", label: "Readings", sortable: false },
                    { key: "time", label: "Timestamp", sortable: true },
                    { key: "operatorUsername", label: "Operator", sortable: true },
                    { key: "details", label: "Details", sortable: false },
                    { key: "print", label: "Actions", sortable: false },
                  ].map(col => (
                    <th key={col.key} className="text-left px-5 py-3 text-xs font-semibold text-[#44474e] uppercase tracking-wide">
                      {col.sortable ? (
                        <button className="flex items-center gap-1 hover:text-[#191c20] transition-colors"
                          onClick={() => toggleSort(col.key as typeof sortCol)}>
                          {col.label} <ArrowUpDown className="w-3 h-3 opacity-50" />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-[#e2e2e8] hover:bg-[#f9f9ff] transition-colors ${i === pagedRows.length - 1 ? "border-0" : ""}`}>
                    <td className="px-5 py-3"><span className="font-mono text-xs font-semibold text-[#2b6485]">{r.scanId}</span></td>
                    <td className="px-5 py-3"><span className="font-mono text-xs font-semibold text-[#2b6485]">{r.partNumber}</span></td>
                    <td className="px-5 py-3 font-medium text-[#191c20]">{r.modelName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                        (r.status || "").toString().toUpperCase() === "OK"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(r.status || "").toString().toUpperCase() === "OK" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {(r.status || "UNKNOWN").toString().toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap max-w-xs">
                        {Object.entries(r.readings).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f3f3f9] text-[#44474e] border border-[#e2e2e8]">{k}: {v}</span>
                        ))}
                        {Object.keys(r.readings).length > 3 && (
                          <span className="text-[10px] text-[#44474e]">+{Object.keys(r.readings).length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#44474e]">{fmtTime(r.time)}</td>
                    <td className="px-5 py-3 text-[#44474e]">{r.operatorUsername || "—"}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedRow(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e8] text-xs font-medium text-[#031f41] hover:bg-[#f3f3f9] transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleReprint(r)} disabled={isReprintDisabled(r)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e8] text-xs font-medium text-[#031f41] hover:bg-[#f3f3f9] transition-colors disabled:opacity-50"
                          title={(!printerEnabled ? "Printer is disabled in settings" : "") || ((r.status || "").toString().toUpperCase() !== "OK" ? "Reprint is only available for OK status" : "")}>
                          {printingId === r.id ? <Spinner className="w-3 h-3" /> : <Printer className="w-3 h-3" />}
                          Reprint
                        </button>
                        {printMsg?.id === r.id && (
                          <span className={`text-[10px] font-medium ${printMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{printMsg.text}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#44474e]">No approved records found for the selected period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) setSelectedRow(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan Details</DialogTitle>
            <DialogDescription>
              {selectedRow ? `Detailed information for scan ${selectedRow.scanId}` : "Select a scan to view its full details."}
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#e2e2e8] bg-[#f9f9ff] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#44474e]">Scan summary</p>
                  <div className="mt-2 space-y-1 text-[#191c20]">
                    <p><span className="font-medium">Scan ID:</span> {selectedRow.scanId}</p>
                    <p><span className="font-medium">Part Number:</span> {selectedRow.partNumber}</p>
                    <p><span className="font-medium">Model:</span> {selectedRow.modelName}</p>
                    <p><span className="font-medium">Category:</span> {selectedRow.category}</p>
                    <p><span className="font-medium">Status:</span> {selectedRow.status}</p>
                    <p><span className="font-medium">Timestamp:</span> {fmtTime(selectedRow.time)}</p>
                    <p><span className="font-medium">Operator:</span> {selectedRow.operatorUsername || "—"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-[#e2e2e8] bg-[#f9f9ff] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#44474e]">Readings</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(selectedRow.readings || {}).map(([key, value]) => (
                      <div key={key} className="rounded border border-[#e2e2e8] bg-white px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[#44474e]">{key}</p>
                        <p className="font-semibold text-[#191c20]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#e2e2e8] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#44474e]">Operations</p>
                  {selectedRow.operations && selectedRow.operations.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {selectedRow.operations.map((op, idx) => (
                        <div key={`${op.name}-${idx}`} className="rounded border border-[#e2e2e8] bg-white p-2.5">
                          <p className="font-semibold text-[#191c20]">{op.name}</p>
                          <p className="text-xs text-[#44474e]">{op.unit}</p>
                          <p className="mt-1 text-xs">Channel {op.channelX} {op.operator} Channel {op.channelY} = {op.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[#44474e]">No operations recorded.</p>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="rounded-lg border border-[#e2e2e8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#44474e]">Reference</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedRow.reference && Object.entries(selectedRow.reference).length > 0 ? Object.entries(selectedRow.reference).map(([key, value]) => (
                        <div key={key} className="rounded border border-[#e2e2e8] bg-white px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[#44474e]">{key}</p>
                          <p className="font-semibold text-[#191c20]">{value}</p>
                        </div>
                      )) : <p className="text-[#44474e]">No reference values.</p>}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#e2e2e8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#44474e]">Relative</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedRow.relative && Object.entries(selectedRow.relative).length > 0 ? Object.entries(selectedRow.relative).map(([key, value]) => (
                        <div key={key} className="rounded border border-[#e2e2e8] bg-white px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[#44474e]">{key}</p>
                          <p className="font-semibold text-[#191c20]">{value}</p>
                        </div>
                      )) : <p className="text-[#44474e]">No relative values.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!loading && filtered.length > 0 && (
        <Card className="px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#44474e]">Rows per page</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41]"
              >
                {[10, 20, 30, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border border-[#e2e2e8] text-sm font-medium text-[#031f41] hover:bg-[#f3f3f9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#44474e]">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-2 rounded-lg border border-[#e2e2e8] text-sm font-medium text-[#031f41] hover:bg-[#f3f3f9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Models View ──────────────────────────────────────────────────────────────

interface ModelFormState {
  partNumber: string;
  modelName: string;
  category: string;
  active: boolean;
}
type ParamFormState = ModelParameter;

const CHANNEL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
const MAX_TEXT_LENGTH = 128;
const MIN_NUMERIC_VALUE = 0;
const MAX_NUMERIC_VALUE = 65535;

function getAvailableChannels(params: ParamFormState[], currentIndex: number): number[] {
  const occupied = new Set<number>();

  params.forEach((param, index) => {
    if (index === currentIndex) return;
    if (Number.isInteger(param.channel)) {
      occupied.add(param.channel);
    }
  });

  return CHANNEL_OPTIONS.filter((channel) => !occupied.has(channel));
}

function getNextAvailableChannel(params: ParamFormState[]): number | null {
  const used = new Set(params.map((param) => param.channel));
  return CHANNEL_OPTIONS.find((channel) => !used.has(channel)) ?? null;
}

function getChannelOptions(params: ParamFormState[], currentIndex: number): number[] {
  const available = getAvailableChannels(params, currentIndex);
  const current = params[currentIndex]?.channel;

  if (Number.isInteger(current) && CHANNEL_OPTIONS.includes(current) && !available.includes(current)) {
    return [current, ...available];
  }

  return available;
}

function clampNumericValue(value: number): number {
  if (!Number.isFinite(value)) return MIN_NUMERIC_VALUE;
  return Math.min(MAX_NUMERIC_VALUE, Math.max(MIN_NUMERIC_VALUE, value));
}

function createEmptyParam(): ParamFormState {
  return { channel: 0, name: "", label: "", unit: "", referenceValue: null, min: 0, max: 100, active: true };
}

const MAX_OPERATIONS = 8;
type OperationFormState = { name: string; operator: "+" | "-"; unit: string; channelX: number; channelY: number; };

function createEmptyOperation(activeChannels: number[]): OperationFormState {
  return { name: "", operator: "-", unit: "", channelX: activeChannels[0] ?? 0, channelY: activeChannels[1] ?? 0 };
}

function getOperationPairKey(channelX: number, channelY: number): string {
  const [left, right] = channelX <= channelY ? [channelX, channelY] : [channelY, channelX];
  return `${left}:${right}`;
}

function getNextAvailableOperation(activeChannels: number[], operations: OperationFormState[]): OperationFormState | null {
  if (activeChannels.length < 2) return null;

  const usedPairs = new Set(operations.map((op) => getOperationPairKey(op.channelX, op.channelY)));

  for (const channelX of activeChannels) {
    for (const channelY of activeChannels) {
      const pairKey = getOperationPairKey(channelX, channelY);
      if (!usedPairs.has(pairKey)) {
        return { name: "", operator: "-", unit: "", channelX, channelY };
      }
    }
  }

  return null;
}

function getOperationChannelYOptions(
  operations: OperationFormState[],
  currentIndex: number,
  activeChannels: number[],
  channelXOverride?: number,
): number[] {
  const currentOperation = operations[currentIndex];
  if (!currentOperation) return activeChannels;

  const channelX = channelXOverride ?? currentOperation.channelX;

  const usedPairs = new Set(
    operations
      .filter((_, index) => index !== currentIndex)
      .map((op) => getOperationPairKey(op.channelX, op.channelY)),
  );

  const validChannelY = activeChannels.filter((channelY) => {
    const pairKey = getOperationPairKey(channelX, channelY);
    return !usedPairs.has(pairKey);
  });

  if (validChannelY.length === 0) {
    return activeChannels;
  }

  return validChannelY;
}

function ModelsView() {
  const [models, setModels] = useState<WakefitModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPartNumber, setEditingPartNumber] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"channels" | "operations">("channels");
  const [form, setForm] = useState<ModelFormState>({ partNumber: "", modelName: "", category: "", active: true });
  const [formParams, setFormParams] = useState<ParamFormState[]>([createEmptyParam()]);
  const [formOps, setFormOps] = useState<OperationFormState[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setModels(await api.getModels());
    } catch (e: any) {
      setError(e.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openAdd = () => {
    setEditingPartNumber(null);
    setForm({ partNumber: "", modelName: "", category: "", active: true });
    setFormParams([createEmptyParam()]);
    setFormOps([]);
    setActiveTab("channels");
    setSaveError(null);
    setShowModal(true);
  };

  const openEdit = async (m: WakefitModel) => {
    setEditingPartNumber(m.partNumber);
    setForm({ partNumber: m.partNumber, modelName: m.modelName, category: m.category, active: m.active });
    setFormParams(m.parameters.length ? m.parameters : [createEmptyParam()]);
    setFormOps(m.operations?.length ? m.operations.map(o => ({ name: o.name, operator: o.operator, unit: o.unit, channelX: o.channelX, channelY: o.channelY })) : []);
    setActiveTab("channels");
    setSaveError(null);
    setShowModal(true);
  };

  const validateModelForm = (): string | null => {
    if (!editingPartNumber && !form.partNumber.trim()) {
      return "Part Number is required.";
    }

    if (!editingPartNumber && form.partNumber.trim().length > MAX_TEXT_LENGTH) {
      return `Part Number must be ${MAX_TEXT_LENGTH} characters or less.`;
    }

    if (!form.modelName.trim()) {
      return "Model Name is required.";
    }

    if (form.modelName.trim().length > MAX_TEXT_LENGTH) {
      return `Model Name must be ${MAX_TEXT_LENGTH} characters or less.`;
    }

    if (form.category.trim().length > MAX_TEXT_LENGTH) {
      return `Category must be ${MAX_TEXT_LENGTH} characters or less.`;
    }

    const activeParams = formParams.filter((param) => param.active);
    if (activeParams.length === 0) {
      return "At least one active parameter is required.";
    }

    const usedChannels = new Set<number>();
    for (const param of activeParams) {
      if (!Number.isInteger(param.channel) || !CHANNEL_OPTIONS.includes(param.channel)) {
        return "Each active parameter must have a valid channel (0-7).";
      }

      if (usedChannels.has(param.channel)) {
        return `Channel ${param.channel} is assigned more than once.`;
      }
      usedChannels.add(param.channel);

      if (!param.label.trim()) {
        return `Label is required for channel ${param.channel}.`;
      }

      if (param.label.trim().length > MAX_TEXT_LENGTH) {
        return `Label for channel ${param.channel} must be ${MAX_TEXT_LENGTH} characters or less.`;
      }

      if (param.referenceValue === null || param.referenceValue === undefined || !Number.isFinite(param.referenceValue)) {
        return `Reference Value is required for channel ${param.channel}.`;
      }

      if (!param.unit.trim()) {
        return `Unit is required for channel ${param.channel}.`;
      }

      if (param.unit.trim().length > MAX_TEXT_LENGTH) {
        return `Unit for channel ${param.channel} must be ${MAX_TEXT_LENGTH} characters or less.`;
      }

      if (param.name.trim().length > MAX_TEXT_LENGTH) {
        return `Parameter Name for channel ${param.channel} must be ${MAX_TEXT_LENGTH} characters or less.`;
      }

      if (!Number.isFinite(param.min) || !Number.isFinite(param.max)) {
        return `Min and Max are required numeric values for channel ${param.channel}.`;
      }

      if (param.min < MIN_NUMERIC_VALUE || param.max < MIN_NUMERIC_VALUE) {
        return `Min and Max cannot be negative for channel ${param.channel}.`;
      }

      if (param.min > MAX_NUMERIC_VALUE || param.max > MAX_NUMERIC_VALUE) {
        return `Min and Max must be ${MAX_NUMERIC_VALUE} or less for channel ${param.channel}.`;
      }

      if (param.min > param.max) {
        return `Min cannot be greater than Max for channel ${param.channel}.`;
      }
    }

    const activeChannelSet = new Set(activeParams.map((param) => param.channel));
    const usedOperationPairs = new Set<string>();

    for (let index = 0; index < formOps.length; index += 1) {
      const operation = formOps[index];
      const operationNumber = index + 1;

      if (!Number.isInteger(operation.channelX) || !activeChannelSet.has(operation.channelX)) {
        return `Operation ${operationNumber} has an invalid Channel X selection.`;
      }

      if (!Number.isInteger(operation.channelY) || !activeChannelSet.has(operation.channelY)) {
        return `Operation ${operationNumber} has an invalid Channel Y selection.`;
      }

      const pairKey = getOperationPairKey(operation.channelX, operation.channelY);
      if (usedOperationPairs.has(pairKey)) {
        return `Operation ${operationNumber} duplicates an existing channel pair. Combinations like 1,2 and 2,1 are not allowed.`;
      }

      usedOperationPairs.add(pairKey);
    }

    return null;
  };

  const handleSave = async () => {
    setSaveError(null);

    const validationError = validateModelForm();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);

    const payload = {
      modelName: form.modelName.trim(),
      category: form.category.trim(),
      active: form.active,
      parameters: formParams.map((param) => ({
        ...param,
        name: param.name.trim(),
        label: param.label.trim(),
        unit: param.unit.trim(),
        referenceValue: param.referenceValue ?? null,
      })),
      operations: formOps.map((op) => ({
        name: op.name.trim(),
        unit: op.unit.trim(),
        channelX: op.channelX,
        operator: op.operator,
        channelY: op.channelY,
      })),
    };

    try {
      if (editingPartNumber) {
        await api.updateModel(editingPartNumber, payload);
      } else {
        await api.createOrUpsertModel({
          partNumber: form.partNumber.trim(),
          ...payload,
        });
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setSaveError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partNumber: string) => {
    try {
      await api.deleteModel(partNumber);
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      setError(e.message || "Delete failed");
      setDeleteConfirm(null);
    }
  };

  const nextAvailableChannel = getNextAvailableChannel(formParams);
  const canAddParameter = nextAvailableChannel !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20 }}>Product Models</h2>
          <p className="text-xs text-[#44474e]">{models.filter(m => m.active).length} active · {models.filter(m => !m.active).length} inactive</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-1 text-xs text-[#2b6485] font-medium hover:underline">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Add Model
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner className="w-6 h-6" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f9fc] border-b border-[#e2e2e8]">
                  {["Part Number", "Model Name", "Category", "Parameters", "Updated", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#44474e] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={m.partNumber} className={`border-b border-[#e2e2e8] hover:bg-[#f9f9ff] transition-colors ${i === models.length - 1 ? "border-0" : ""}`}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#2b6485]">{m.partNumber}</td>
                    <td className="px-5 py-3 font-semibold text-[#191c20]">{m.modelName}</td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f3f3f9] text-xs font-medium text-[#44474e] border border-[#e2e2e8]">{m.category || "—"}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {m.parameters.slice(0, 3).map(p => (
                          <span key={p.channel} className="text-xs px-2 py-0.5 rounded bg-[#f3f3f9] text-[#44474e] border border-[#e2e2e8]">{p.name}</span>
                        ))}
                        {m.parameters.length > 3 && <span className="text-xs text-[#44474e]">+{m.parameters.length - 3} more</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#44474e]">{fmtDateDDMMYYYY(m.updatedAt)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        m.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-[#f3f3f9] text-[#44474e] border-[#e2e2e8]"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.active ? "bg-emerald-500" : "bg-[#c4c6cf]"}`} />
                        {m.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-[#f3f3f9] text-[#2b6485] transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirm(m.partNumber)} className="p-1.5 rounded hover:bg-red-50 text-[#E63946] transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {models.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#44474e]">No active models configured yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-96 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-50"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div>
                <h3 className="font-bold text-[#191c20] mb-1" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>Delete Model</h3>
                <p className="text-sm text-[#44474e]">This permanently removes <span className="font-mono">{deleteConfirm}</span> and all its parameter configurations. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-[#e2e2e8] text-sm font-medium text-[#44474e] hover:bg-[#f3f3f9] transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-sm font-semibold hover:bg-red-700 transition-colors">Delete Model</button>
            </div>
          </Card>
        </div>
      )}

      {showModal && (() => {
        const activeChannels = formParams.filter(p => p.active).map(p => p.channel);
        const nextOperation = getNextAvailableOperation(activeChannels, formOps);
        const canAddOp = formOps.length < MAX_OPERATIONS && nextOperation !== null;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8">
          <Card className="w-[680px] mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e2e8]">
              <h3 className="font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>
                {editingPartNumber ? "Edit Model" : "Add New Model"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-[#f3f3f9] text-[#44474e] transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {/* Common fields */}
            <div className="px-6 pt-5 pb-4 space-y-4 border-b border-[#e2e2e8]">
              {saveError && <ErrorBanner message={saveError} />}
              <p className="text-xs text-[#44474e]">Fields marked with <span className="text-[#E63946]">*</span> are required.</p>
              <div>
                <label className="block text-sm font-medium text-[#191c20] mb-1.5">
                  Part Number <span className="text-[#E63946]">*</span>
                  <span className="ml-1.5 text-xs font-normal text-[#44474e]">Unique key — cannot be changed after creation</span>
                </label>
                <input value={form.partNumber} disabled={!!editingPartNumber} maxLength={MAX_TEXT_LENGTH}
                  onChange={e => setForm(f => ({ ...f, partNumber: e.target.value.slice(0, MAX_TEXT_LENGTH) }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors font-mono tracking-wide disabled:bg-[#f3f3f9]"
                  placeholder="e.g. PN-1001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#191c20] mb-1.5">
                    Model Name <span className="text-[#E63946]">*</span>
                    <span className="ml-1.5 text-xs font-normal text-[#44474e]">Cannot be changed after creation</span>
                  </label>
                  <input value={form.modelName} maxLength={MAX_TEXT_LENGTH} disabled={!!editingPartNumber}
                    onChange={e => setForm(f => ({ ...f, modelName: e.target.value.slice(0, MAX_TEXT_LENGTH) }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                    placeholder="e.g. Chair Model X" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#191c20] mb-1.5">
                    Category
                    <span className="ml-1.5 text-xs font-normal text-[#44474e]">Cannot be changed after creation</span>
                  </label>
                  <input value={form.category} maxLength={MAX_TEXT_LENGTH} disabled={!!editingPartNumber}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value.slice(0, MAX_TEXT_LENGTH) }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                    placeholder="e.g. Office Chair" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.active ? "bg-emerald-500" : "bg-[#c4c6cf]"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mx-0.5 ${form.active ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-[#44474e]">Active</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#e2e2e8] px-6">
              {(["channels", "operations"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? "border-[#031f41] text-[#031f41]"
                      : "border-transparent text-[#44474e] hover:text-[#191c20]"
                  }`}>
                  {tab === "channels" ? "Channel Management" : "Operations Management"}
                  {tab === "channels" && (
                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f3f3f9] text-[#44474e]">
                      {formParams.filter(p => p.active).length}
                    </span>
                  )}
                  {tab === "operations" && (
                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f3f3f9] text-[#44474e]">
                      {formOps.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-6 space-y-3 max-h-[45vh] overflow-y-auto">

              {/* ── Channel Management Tab ── */}
              {activeTab === "channels" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#44474e]">{formParams.filter(p => p.active).length} active · {formParams.filter(p => !p.active).length} disabled</span>
                    <button
                      onClick={() => setFormParams((prev) => {
                        const nextChannel = getNextAvailableChannel(prev);
                        if (nextChannel === null) return prev;
                        return [...prev, { ...createEmptyParam(), channel: nextChannel }];
                      })}
                      disabled={!canAddParameter}
                      title={!canAddParameter ? "All channels (0-7) are already assigned" : undefined}
                      className="flex items-center gap-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-[#2b6485] hover:underline">
                      <Plus className="w-3 h-3" /> Add Parameter
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {formParams.map((p, i) => {
                      const channelOptions = getChannelOptions(formParams, i);
                      return (
                      <div key={i} className={`rounded-lg border transition-all ${!p.active ? "border-[#e2e2e8] bg-[#f9f9ff] opacity-60" : "border-[#e2e2e8] bg-white"}`}>
                        {/* Row 1: Channel · Label · Parameter Name */}
                        <div className="grid grid-cols-[72px_1fr_1fr] gap-2 px-3 pt-2.5 pb-2 border-b border-[#f3f3f9]">
                          <div>
                            <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-1">Channel <span className="text-[#E63946]">*</span></p>
                            <select value={channelOptions.includes(p.channel) ? p.channel : (channelOptions[0] ?? 0)}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, channel: Number(e.target.value) } : x))}
                              disabled={!p.active}
                              className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9] font-mono">
                              {channelOptions.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-1">Label <span className="text-[#E63946]">*</span></p>
                            <input value={p.label} maxLength={MAX_TEXT_LENGTH} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, label: e.target.value.slice(0, MAX_TEXT_LENGTH) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                              placeholder="e.g. Left Handle" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide mb-1">Parameter Name (key) <span className="text-[#E63946]">*</span></p>
                            <input value={p.name} maxLength={MAX_TEXT_LENGTH} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, name: e.target.value.slice(0, MAX_TEXT_LENGTH) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                              placeholder="e.g. LH" />
                          </div>
                        </div>
                        {/* Row 2: Reference Value · Unit · Min · Max · Active · Delete */}
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-end gap-2 px-3 py-2.5">
                          <div>
                            <p className="text-[9px] text-[#44474e] mb-1 font-medium uppercase tracking-wide">Reference Value <span className="text-[#E63946]">*</span></p>
                            <input type="number" step="any" value={p.referenceValue ?? ""} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, referenceValue: e.target.value === "" ? null : Number(e.target.value) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                              placeholder="0" />
                          </div>
                          <div>
                            <p className="text-[9px] text-[#44474e] mb-1 font-medium uppercase tracking-wide">Unit <span className="text-[#E63946]">*</span></p>
                            <input value={p.unit} maxLength={MAX_TEXT_LENGTH} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, unit: e.target.value.slice(0, MAX_TEXT_LENGTH) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]"
                              placeholder="mm" />
                          </div>
                          <div>
                            <p className="text-[9px] text-[#44474e] mb-1 font-medium uppercase tracking-wide">Min</p>
                            <input type="number" value={p.min} min={MIN_NUMERIC_VALUE} max={MAX_NUMERIC_VALUE} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, min: clampNumericValue(Number(e.target.value)) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]" />
                          </div>
                          <div>
                            <p className="text-[9px] text-[#44474e] mb-1 font-medium uppercase tracking-wide">Max</p>
                            <input type="number" value={p.max} min={MIN_NUMERIC_VALUE} max={MAX_NUMERIC_VALUE} disabled={!p.active}
                              onChange={e => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, max: clampNumericValue(Number(e.target.value)) } : x))}
                              className="w-full px-2.5 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors disabled:bg-[#f3f3f9]" />
                          </div>
                          <button onClick={() => setFormParams(fp => fp.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold border transition-colors ${
                              !p.active ? "bg-[#f3f3f9] text-[#44474e] border-[#e2e2e8] hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            }`}>
                            {!p.active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {!p.active ? "Inactive" : "Active"}
                          </button>
                          <button onClick={() => setFormParams(fp => fp.filter((_, j) => j !== i))} disabled={formParams.length === 1}
                            className="p-1.5 rounded hover:bg-red-50 text-[#E63946] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </>
              )}

              {/* ── Operations Management Tab ── */}
              {activeTab === "operations" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#44474e]">{formOps.length} / {MAX_OPERATIONS} operations</span>
                      {activeChannels.length < 2 && (
                        <span className="ml-2 text-xs text-amber-600">Add at least 2 active channels first</span>
                      )}
                    </div>
                    <button onClick={() => {
                      setFormOps((previous) => {
                        const next = getNextAvailableOperation(activeChannels, previous);
                        if (!next) return previous;
                        return [...previous, next];
                      });
                    }}
                      disabled={!canAddOp}
                      title={!canAddOp ? (activeChannels.length < 2 ? "Need ≥ 2 active channels" : "No unique channel pairs available") : undefined}
                      className="flex items-center gap-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-[#2b6485] hover:underline">
                      <Plus className="w-3 h-3" /> Add Operation
                    </button>
                  </div>

                  {formOps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-[#e2e2e8] text-center">
                      <p className="text-sm text-[#44474e] font-medium">No operations defined</p>
                      <p className="text-xs text-[#c4c6cf] mt-1">Click "Add Operation" to create one</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#e2e2e8] overflow-hidden">
                      {/* Table header */}
                      <div className="grid grid-cols-[28px_1fr_80px_60px_1fr_1fr_28px] gap-2 px-3 py-2 bg-[#f7f9fc] border-b border-[#e2e2e8]">
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide">#</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide">Name</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide">Unit</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide text-center">Op</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide">Channel X</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide">Channel Y</p>
                        <p className="text-[10px] font-semibold text-[#44474e] uppercase tracking-wide"></p>
                      </div>
                      {/* Rows */}
                      {formOps.map((op, i) => {
                        const channelYOptions = getOperationChannelYOptions(formOps, i, activeChannels);

                        return (
                        <div key={i} className={`grid grid-cols-[28px_1fr_80px_60px_1fr_1fr_28px] gap-2 items-center px-3 py-2 ${i < formOps.length - 1 ? "border-b border-[#f3f3f9]" : ""}`}>
                          <span className="text-xs font-mono font-bold text-[#2b6485]">{i + 1}</span>
                          <input value={op.name} maxLength={MAX_TEXT_LENGTH}
                            onChange={e => setFormOps(ops => ops.map((o, j) => j === i ? { ...o, name: e.target.value.slice(0, MAX_TEXT_LENGTH) } : o))}
                            className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors"
                            placeholder="e.g. Handle Diff" />
                          <input value={op.unit} maxLength={32}
                            onChange={e => setFormOps(ops => ops.map((o, j) => j === i ? { ...o, unit: e.target.value.slice(0, 32) } : o))}
                            className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors"
                            placeholder="mm" />
                          <select value={op.operator}
                            onChange={e => setFormOps(ops => ops.map((o, j) => j === i ? { ...o, operator: e.target.value as "+" | "-" } : o))}
                            className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors text-center font-semibold">
                            <option value="+">+ (Add)</option>
                            <option value="-">− (Sub)</option>
                          </select>
                          <select value={op.channelX}
                            onChange={e => {
                              const nextChannelX = Number(e.target.value);
                              setFormOps((ops) => {
                                const nextOps = ops.map((o, j) => j === i ? { ...o, channelX: nextChannelX } : o);
                                const nextYOptions = getOperationChannelYOptions(nextOps, i, activeChannels, nextChannelX);
                                if (nextYOptions.includes(nextOps[i].channelY)) {
                                  return nextOps;
                                }
                                return nextOps.map((o, j) => {
                                  if (j !== i) return o;
                                  return { ...o, channelY: nextYOptions[0] ?? o.channelY };
                                });
                              });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors font-mono">
                            {activeChannels.map(ch => {
                              const param = formParams.find(p => p.channel === ch);
                              return <option key={ch} value={ch}>CH-{ch}{param?.label ? ` (${param.label})` : ""}</option>;
                            })}
                          </select>
                          <select value={op.channelY}
                            onChange={e => setFormOps(ops => ops.map((o, j) => j === i ? { ...o, channelY: Number(e.target.value) } : o))}
                            className="w-full px-2 py-1.5 rounded border border-[#e2e2e8] text-xs bg-white outline-none focus:border-[#031f41] transition-colors font-mono">
                            {channelYOptions.map(ch => {
                              const param = formParams.find(p => p.channel === ch);
                              return <option key={ch} value={ch}>CH-{ch}{param?.label ? ` (${param.label})` : ""}</option>;
                            })}
                          </select>
                          <button onClick={() => setFormOps(ops => ops.filter((_, j) => j !== i))}
                            className="p-1 rounded hover:bg-red-50 text-[#E63946] transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )})}
                    </div>
                  )}
                  {formOps.length > 0 && (
                    <p className="text-[11px] text-[#44474e] mt-1">
                      Sequence is auto-assigned (1 → {formOps.length}) in the order rows appear. Drag to reorder is not supported — delete and re-add to change order.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e2e8]">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-[#e2e2e8] text-sm font-medium text-[#44474e] hover:bg-[#f3f3f9] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving && <Spinner className="w-3.5 h-3.5" />}
                {editingPartNumber ? "Save Changes" : "Create Model"}
              </button>
            </div>
          </Card>
        </div>
        );
      })()}
    </div>
  );
}

// ─── Users View ───────────────────────────────────────────────────────────────

const PERMISSIONS: Record<Role, string[]> = {
  operator: ["Scan products", "View own history", "Print labels"],
  supervisor: ["Scan products", "View all history", "Print labels", "View analytics"],
  admin: ["Full system access", "Manage models", "Manage users", "View all data"],
};

function UsersView({ session }: { session: Session }) {
  const isAdmin = session.role === "admin";
  const [users, setUsers] = useState<api.ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await api.getUsers());
    } catch (e: any) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openEdit = (u: api.ApiUser) => {
    setEditingUsername(u.username);
    setPassword("");
    setShowPw(false);
    setSaved(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingUsername || !password) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateUserPassword(editingUsername, password);
      setSaved(true);
      setTimeout(() => { setEditingUsername(null); setSaved(false); }, 900);
    } catch (e: any) {
      setSaveError(e.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* <div>
        <h2 className="font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20 }}>User Management</h2>
        <p className="text-xs text-[#44474e] mt-0.5">
          3 fixed accounts (admin / supervisor / operator) — {isAdmin ? "you can reset any account's password" : "read-only view"}
        </p>
      </div> */}

      {/* <div className="grid grid-cols-3 gap-4">
        {(["operator", "supervisor", "admin"] as Role[]).map(role => (
          <Card key={role} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#2b6485]" />
              <h4 className="font-semibold text-[#191c20] text-sm">{capitalize(role)}</h4>
            </div>
            <ul className="space-y-1.5">
              {PERMISSIONS[role].map(perm => (
                <li key={perm} className="flex items-center gap-2 text-xs text-[#44474e]">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {perm}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div> */}

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner className="w-6 h-6" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f9fc] border-b border-[#e2e2e8]">
                  {["Username", "Role", "Last Active", ...(isAdmin ? ["Actions"] : [])].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#44474e] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.username} className={`border-b border-[#e2e2e8] hover:bg-[#f9f9ff] transition-colors ${i === users.length - 1 ? "border-0" : ""}`}>
                    <td className="px-5 py-3 text-[#191c20] text-sm font-medium">{u.username}</td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3 text-xs text-[#44474e]">{fmtTime(u.lastActive)}</td>
                    {isAdmin && (
                      <td className="px-5 py-3">
                        <button onClick={() => openEdit(u)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e2e8] text-xs font-medium text-[#2b6485] hover:bg-[#f3f3f9] transition-colors">
                          <Edit2 className="w-3 h-3" /> Reset Password
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingUsername && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-[420px] mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e2e8]">
              <div>
                <h3 className="font-bold text-[#191c20]" style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>Reset Password</h3>
                <p className="text-xs text-[#44474e] mt-0.5">{editingUsername}</p>
              </div>
              <button onClick={() => setEditingUsername(null)} className="p-1.5 rounded hover:bg-[#f3f3f9] text-[#44474e] transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {saveError && <ErrorBanner message={saveError} />}
              <div>
                <label className="block text-sm font-medium text-[#191c20] mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors"
                    placeholder="New password" />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#44474e] hover:text-[#191c20] transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e2e8]">
              <button onClick={() => setEditingUsername(null)} className="px-4 py-2 rounded-lg border border-[#e2e2e8] text-sm font-medium text-[#44474e] hover:bg-[#f3f3f9] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!password || saving || saved}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Spinner className="w-4 h-4" /> : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : "Save Password"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsView() {
  const [printerEnabled, setPrinterEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load initial state from localStorage and listen for changes
  useEffect(() => {
    const stored = localStorage.getItem("printerEnabled");
    setPrinterEnabled(stored ? JSON.parse(stored) : true);
    
    // Listen for printer setting changes from other views
    const handlePrinterSettingsChange = (event: any) => {
      setPrinterEnabled(event.detail.printerEnabled);
    };
    window.addEventListener("printerSettingsChanged", handlePrinterSettingsChange);
    
    return () => window.removeEventListener("printerSettingsChanged", handlePrinterSettingsChange);
  }, []);

  const handleSaveSettings = () => {
    // Save printer settings to localStorage
    localStorage.setItem("printerEnabled", JSON.stringify(printerEnabled));
    // Dispatch custom event to sync other components on the same page
    window.dispatchEvent(new CustomEvent("printerSettingsChanged", { detail: { printerEnabled } }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[#191c20] mb-6" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
          Printer Settings
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-[#e2e2e8] bg-[#f9f9ff]">
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5 text-[#2b6485]" />
              <div>
                <p className="font-medium text-[#191c20]">Enable Printer</p>
                <p className="text-xs text-[#44474e] mt-0.5">Allow label printing functionality in the application</p>
              </div>
            </div>
            <button
              onClick={() => setPrinterEnabled(!printerEnabled)}
              className={`w-14 h-8 rounded-full transition-colors flex-shrink-0 flex items-center ${
                printerEnabled ? "bg-emerald-500" : "bg-[#c4c6cf]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform mx-1 ${
                  printerEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="pt-4 border-t border-[#e2e2e8] flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-blue-900">Printer Status</p>
            <p className="text-sm text-blue-700 mt-1">
              {printerEnabled
                ? "Printer functionality is enabled. Labels will be printed when scanning products."
                : "Printer functionality is disabled. Scan results will not print labels."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Login View ───────────────────────────────────────────────────────────────

function LoginView({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<api.ApiUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        const response = await api.getUsers();
        if (!active) return;

        setUsers(response);
        setUsersError(null);
        setUsername(prev => prev || response[0]?.username || "");
      } catch (err: any) {
        if (!active) return;

        const fallbackUsers: api.ApiUser[] = [
          { username: "admin", role: "admin", lastActive: null },
          { username: "supervisor", role: "supervisor", lastActive: null },
          { username: "operator", role: "operator", lastActive: null },
        ];
        setUsers(fallbackUsers);
        setUsersError(err instanceof api.ApiError ? err.message : "Unable to load users from the backend.");
        setUsername(prev => prev || fallbackUsers[0].username);
      } finally {
        if (active) {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();
    return () => { active = false; };
  }, []);

  const selectedUser = users.find((user) => user.username === username) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username.trim().toLowerCase(), password);
      onLogin({ username: res.username, role: res.role, lastActive: res.lastActive });
    } catch (err: any) {
      setError(err instanceof api.ApiError ? err.message : "Backend Unreachable...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex items-center justify-center p-4" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ImageWithFallback src={wakefitLogo} alt="Wakefit logo" className="h-14 w-auto object-contain mb-3" />
          <p className="text-xs text-[#44474e] uppercase tracking-widest">Quality Control System</p>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e2e8] shadow-sm p-8">
          {/* <h2 className="text-lg font-bold text-[#191c20] mb-1" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>Sign in to your account</h2> */}
          {/* <p className="text-xs text-[#44474e] mb-6">Enter your credentials to access the QC dashboard</p> */}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#191c20] mb-1.5">Username</label>
              <select
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                className="w-full px-3 py-2.5 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors"
                required
                disabled={usersLoading}
              >
                <option value="">{usersLoading ? "Loading users..." : "Select a username"}</option>
                {users.map((user) => (
                  <option key={user.username} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
              {usersError && (
                <p className="mt-2 text-[11px] text-amber-700">{usersError}</p>
              )}
              {/* {selectedUser && (
                <div className="mt-2 rounded-lg border border-[#e2e2e8] bg-[#f7f9fc] px-3 py-2 text-xs text-[#44474e]">
                  <div className="flex items-center justify-between">
                    <span>Role</span>
                    <span className="font-medium text-[#191c20]">{capitalize(selectedUser.role)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Last active</span>
                    <span className="font-medium text-[#191c20]">{fmtTime(selectedUser.lastActive)}</span>
                  </div>
                </div>
              )} */}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#191c20] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#e2e2e8] text-sm bg-white outline-none focus:border-[#031f41] transition-colors"
                  required
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#44474e] hover:text-[#191c20] transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#031f41] text-white text-sm font-semibold hover:bg-[#1d3557] shadow-sm transition-colors mt-2 disabled:opacity-60">
              {loading && <Spinner className="w-4 h-4 text-white" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const VIEW_META: Record<View, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Quality overview" },
  scan: { title: "Scan & Validate", sub: "Sensor-driven product validation" },
  history: { title: "Scan History", sub: "Approved scan records" },
  models: { title: "Model Management", sub: "Configure product models and parameter thresholds" },
  users: { title: "User Management", sub: "Manage accounts and access" },
  settings: { title: "Settings", sub: "Configure system preferences" },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSessionFromStorage());
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  const handleLogin = (s: Session) => {
    setSession(s);
    setView("dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    setView("dashboard");
  };

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "DM Sans, sans-serif", background: "#f9f9ff" }}>
      <Sidebar view={view} setView={setView} session={session} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header {...VIEW_META[view]} session={session} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === "dashboard" && <DashboardView />}
          {view === "scan" && <ScanView session={session} />}
          {view === "history" && <HistoryView />}
          {view === "models" && session.role === "admin" && <ModelsView />}
          {view === "users" && session.role === "admin" && <UsersView session={session} />}
          {view === "settings" && session.role === "admin" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}



