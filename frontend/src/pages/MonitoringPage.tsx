import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAuthToken } from "../api";
import { Activity, RefreshCw, Bell, WifiOff, AlertTriangle, Search, X, Settings } from "lucide-react";
import { AlertConfigPage } from "./AlertConfigPage";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://0.0.0.0:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type SignalStatus = "online" | "warning" | "no_signal" | "no_monitoring";

interface MonitoredDevice {
  imei: string;
  plate: string;
  vehicle_name: string;
  last_signal_at: string;
  minutes_ago: number;
  signal_status: SignalStatus;
}

function lastSeenLabel(minutes: number): string {
  if (minutes < 60)  return `hace ${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  return `hace ${days} día${days > 1 ? "s" : ""}`;
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: SignalStatus }) {
  if (status === "online")        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />;
  if (status === "warning")       return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />;
  if (status === "no_signal")     return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />;
  return                                 <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, borderColor }: {
  label: string; value: number; color: string; borderColor: string;
}) {
  return (
    <div className={`flex-1 bg-slate-900 rounded-xl border-t-2 ${borderColor} p-4 min-w-0`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-sky-500/20 border-sky-500/60 text-sky-300"
          : "bg-transparent border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Avatar initials ──────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-slate-300">{initials}</span>
    </div>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────

function DeviceRow({ device }: { device: MonitoredDevice }) {
  const borderCls =
    device.signal_status === "online"         ? "border-l-emerald-500" :
    device.signal_status === "warning"        ? "border-l-amber-400"   :
    device.signal_status === "no_signal"      ? "border-l-rose-500"    :
                                                "border-l-slate-700";

  const lastSeenCls =
    device.signal_status === "online"         ? "text-emerald-400" :
    device.signal_status === "warning"        ? "text-amber-400"   :
    device.signal_status === "no_signal"      ? "text-rose-400"    :
                                                "text-slate-500";

  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-slate-800/60 border-l-2 ${borderCls} hover:bg-slate-800/40 transition-colors`}>
      <Avatar name={device.vehicle_name ?? "?"} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={device.signal_status} />
          <span className="text-sm font-semibold text-white truncate">
            {device.vehicle_name}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {device.plate ? `${device.plate} · ` : ""}{device.imei}
        </p>
        {device.signal_status === "no_monitoring" && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-slate-700/50 border border-slate-600 rounded-full text-[10px] text-slate-400">
            Sin configuración de monitoreo
          </span>
        )}
        {device.signal_status === "online" && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400">
            En línea
          </span>
        )}
        {device.signal_status === "warning" && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] text-amber-400">
            Advertencia
          </span>
        )}
        {device.signal_status === "no_signal" && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-[10px] text-rose-400">
            Sin señal
          </span>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-[10px] text-slate-500">Última señal</p>
        <p className={`text-xs font-semibold ${lastSeenCls}`}>
          {lastSeenLabel(device.minutes_ago)}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">{device.last_signal_at}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterType = "all" | "online" | "warning" | "no_signal" | "no_monitoring";

const AUTO_REFRESH_SECONDS = 180;

export function MonitoringPage() {
  const [devices,     setDevices]     = useState<MonitoredDevice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<FilterType>("all");
  const [search,      setSearch]      = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown,   setCountdown]   = useState(AUTO_REFRESH_SECONDS);
  const [alertsOpen,  setAlertsOpen]  = useState(false);
  const [showConfig,  setShowConfig]  = useState(false);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/monitored_devices_status`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        setDevices(data);
        setLastUpdated(new Date());
        setCountdown(AUTO_REFRESH_SECONDS);
      }
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current  = setInterval(load, AUTO_REFRESH_SECONDS * 1000);
    countdownRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, [load]);

  // Stats
  const total        = devices.length;
  const online       = devices.filter(d => d.signal_status === "online").length;
  const warning      = devices.filter(d => d.signal_status === "warning").length;
  const no_signal    = devices.filter(d => d.signal_status === "no_signal").length;
  const no_monitoring = devices.filter(d => d.signal_status === "no_monitoring").length;
  const alerts       = devices.filter(d => d.signal_status === "no_signal");

  // Filtered list
  const filtered = devices
    .filter(d => filter === "all" || d.signal_status === filter)
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.vehicle_name.toLowerCase().includes(q) ||
        d.plate.toLowerCase().includes(q) ||
        d.imei.toLowerCase().includes(q)
      );
    });

  // Sort: no_signal → warning → online → no_monitoring
  const ORDER: Record<SignalStatus, number> = { no_signal: 0, warning: 1, online: 2, no_monitoring: 3 };
  const sorted = [...filtered].sort((a, b) => {
    if (ORDER[a.signal_status] !== ORDER[b.signal_status])
      return ORDER[a.signal_status] - ORDER[b.signal_status];
    return b.minutes_ago - a.minutes_ago;
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  if (showConfig) {
    return <AlertConfigPage onBack={() => setShowConfig(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-bold text-white">Monitoreo de unidades</h2>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Actualizado {formatTime(lastUpdated)} · refresca en {countdown} s
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Configuración de alertas
          </button>
          <button
            onClick={() => setAlertsOpen(v => !v)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 text-xs transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            Alertas
            {alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold leading-none">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Alerts panel */}
      {alertsOpen && alerts.length > 0 && (
        <div className="mx-6 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {alerts.length} unidad{alerts.length > 1 ? "es" : ""} sin señal
            </span>
            <button onClick={() => setAlertsOpen(false)}>
              <X className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map(d => (
              <span key={d.imei} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                {d.vehicle_name} · {lastSeenLabel(d.minutes_ago)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="flex gap-3 px-6 pt-4 pb-2 shrink-0">
        <StatCard label="Total"          value={total}         color="text-sky-400"     borderColor="border-sky-500" />
        <StatCard label="En línea"       value={online}        color="text-emerald-400" borderColor="border-emerald-500" />
        <StatCard label="Advertencia"    value={warning}       color="text-amber-400"   borderColor="border-amber-500" />
        <StatCard label="Sin señal"      value={no_signal}     color="text-rose-400"    borderColor="border-rose-500" />
        <StatCard label="Sin monitoreo"  value={no_monitoring} color="text-slate-400"   borderColor="border-slate-600" />
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <FilterChip label="Todas"          active={filter === "all"}           onClick={() => setFilter("all")} />
          <FilterChip label="En línea"       active={filter === "online"}        onClick={() => setFilter("online")} />
          <FilterChip label="Advertencia"    active={filter === "warning"}       onClick={() => setFilter("warning")} />
          <FilterChip label="Sin señal"      active={filter === "no_signal"}     onClick={() => setFilter("no_signal")} />
          <FilterChip label="Sin monitoreo"  active={filter === "no_monitoring"} onClick={() => setFilter("no_monitoring")} />
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar unidad, placa, IMEI…"
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-56 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-slate-500 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto mx-6 mb-4 rounded-xl border border-slate-800 bg-slate-900">
        {loading && devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">Cargando unidades…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500">
            <WifiOff className="w-6 h-6" />
            <span className="text-sm">Sin resultados</span>
          </div>
        ) : (
          sorted.map(d => <DeviceRow key={d.imei} device={d} />)
        )}
      </div>
    </div>
  );
}