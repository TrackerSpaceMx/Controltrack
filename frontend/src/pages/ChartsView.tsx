import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, Sector,
} from "recharts";
import { api, DashboardStats, MonthlyExpiration, DeviceRecord, SellerStats } from "../api";
import { Loader2, TrendingUp, Users, DollarSign, Car, User, Calendar, AlertCircle, CheckCircle, XCircle } from "lucide-react";

// ─── Colores base ─────────────────────────────────────────────────────────────

const C = {
  emerald: "#10b981",
  amber:   "#f59e0b",
  rose:    "#f43f5e",
  sky:     "#0ea5e9",
  violet:  "#8b5cf6",
  slate:   "#64748b",
  cyan:    "#06b6d4",
};

const PALETTE = [C.sky, C.emerald, C.violet, C.amber, C.rose, C.cyan, "#e879f9", "#fb923c"];
const MONTH_COLORS = ["#0ea5e9","#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#84cc16","#10b981","#14b8a6","#06b6d4","#3b82f6"];
const SELLER_COLORS = ["#0ea5e9","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

const STATUS_COLORS = {
  active:      "#10b981",
  expiring:    "#f59e0b",
  expired:     "#ef4444",
  deactivated: "#64748b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "Sin fecha";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function statusIcon(s: string) {
  if (s === "active")   return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />;
  if (s === "expiring") return <span className="w-1.5 h-1.5 rounded-full bg-amber-400  inline-block" />;
  if (s === "expired")  return <span className="w-1.5 h-1.5 rounded-full bg-rose-500   inline-block" />;
  return                       <span className="w-1.5 h-1.5 rounded-full bg-slate-500  inline-block" />;
}

function statusText(s: string) {
  return { active: "Activo", expiring: "Por vencer", expired: "Expirado", deactivated: "Inactivo" }[s] ?? s;
}

// ─── Panel lateral de detalle ─────────────────────────────────────────────────

interface DetailPanel { title: string; color: string; devices: DeviceRecord[]; }

function DetailSidePanel({ panel, onClose }: { panel: DetailPanel; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: panel.color }} />
          <h4 className="text-sm font-semibold text-white">{panel.title}</h4>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{panel.devices.length}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {panel.devices.length === 0 ? (
          <p className="text-xs text-slate-600 italic p-4">Sin dispositivos en este grupo.</p>
        ) : panel.devices.map(d => (
          <div key={d.id} className="px-4 py-3 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-semibold text-white leading-tight">{d.device_name ?? d.plate ?? "Sin nombre"}</p>
              <div className="flex items-center gap-1 shrink-0">
                {statusIcon(d.status)}
                <span className="text-[10px] text-slate-400">{statusText(d.status)}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-2.5 h-2.5" /> {d.client_name}
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
              {d.plate && <p className="text-[10px] text-slate-500">Placa: <span className="text-slate-300">{d.plate}</span></p>}
              {d.imei  && <p className="text-[10px] text-slate-500 font-mono truncate">IMEI: <span className="text-slate-300">{d.imei}</span></p>}
              {d.sim   && <p className="text-[10px] text-slate-500">SIM: <span className="text-slate-300">{d.sim}</span></p>}
              {d.model && <p className="text-[10px] text-slate-500">Modelo: <span className="text-slate-300">{d.model}</span></p>}
              <p className="text-[10px] text-slate-500 col-span-2">
                Vence: <span className={
                  (d.days_until_expiration ?? 999) <= 7  ? "text-rose-400 font-semibold" :
                  (d.days_until_expiration ?? 999) <= 15 ? "text-amber-400 font-semibold" : "text-slate-300"
                }>{fmtDate(d.expiration_date)}{d.days_until_expiration != null ? ` (${d.days_until_expiration}d)` : ""}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl text-xs max-w-xs pointer-events-none">
      {label && <p className="text-slate-300 mb-2 font-semibold border-b border-slate-700 pb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? "#fff" }} className="font-semibold mb-0.5">
          {p.name}: <span className="text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function MonthlyTooltip({ active, payload, label, devicesByMonth }: any) {
  if (!active || !payload?.length) return null;
  const devs: DeviceRecord[] = devicesByMonth[label] ?? [];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl text-xs w-64 pointer-events-none">
      <div className="px-3 py-2.5 border-b border-slate-700">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-slate-400">{payload[0]?.value ?? 0} equipos vencen este mes</p>
      </div>
      {devs.slice(0, 6).map(d => (
        <div key={d.id} className="px-3 py-2 border-b border-slate-700/50">
          <p className="text-slate-200 font-medium">{d.device_name ?? d.plate ?? "Sin nombre"}</p>
          <p className="text-slate-500">{d.client_name}</p>
          <p className="text-amber-400 text-[10px]">Vence: {fmtDate(d.expiration_date)}</p>
        </div>
      ))}
      {devs.length > 6 && <p className="px-3 py-2 text-slate-500 text-[10px]">+{devs.length - 6} más</p>}
    </div>
  );
}

function UrgencyTooltip({ active, payload, label, devicesByBucket }: any) {
  if (!active || !payload?.length) return null;
  const devs: DeviceRecord[] = devicesByBucket[label] ?? [];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl text-xs w-64 pointer-events-none">
      <div className="px-3 py-2.5 border-b border-slate-700">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-slate-400">{payload[0]?.value ?? 0} equipos en este rango</p>
      </div>
      {devs.slice(0, 5).map(d => (
        <div key={d.id} className="px-3 py-2 border-b border-slate-700/50 flex justify-between items-center gap-2">
          <div className="min-w-0">
            <p className="text-slate-200 font-medium truncate">{d.device_name ?? d.plate ?? "Sin nombre"}</p>
            <p className="text-slate-500">{d.client_name}</p>
          </div>
          <span className={`text-[10px] font-semibold shrink-0 ${(d.days_until_expiration ?? 999) <= 7 ? "text-rose-400" : "text-amber-400"}`}>
            {d.days_until_expiration != null ? `${d.days_until_expiration}d` : "—"}
          </span>
        </div>
      ))}
      {devs.length > 5 && <p className="px-3 py-2 text-slate-500 text-[10px]">+{devs.length - 5} más · clic para ver todos</p>}
    </div>
  );
}

function ClientTooltip({ active, payload, label, devicesByClient }: any) {
  if (!active || !payload?.length) return null;
  const devs: DeviceRecord[] = devicesByClient[label] ?? [];
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl text-xs w-72 pointer-events-none">
      <div className="px-3 py-2.5 border-b border-slate-700">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-slate-400">{total} dispositivos</p>
        <div className="flex gap-3 mt-1">
          {payload.map((p: any) => (
            <span key={p.name} style={{ color: p.color ?? p.fill }} className="font-semibold">{p.name}: {p.value}</span>
          ))}
        </div>
      </div>
      {devs.slice(0, 4).map(d => (
        <div key={d.id} className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-slate-200 font-medium truncate">{d.device_name ?? d.plate ?? "Sin nombre"}</p>
            {d.plate && <p className="text-slate-500 text-[10px]">{d.plate}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">{statusIcon(d.status)}<span className="text-[10px] text-slate-400">{statusText(d.status)}</span></div>
            <p className="text-[10px] text-slate-500">{fmtDate(d.expiration_date)}</p>
          </div>
        </div>
      ))}
      {devs.length > 4 && <p className="px-3 py-2 text-slate-500 text-[10px]">+{devs.length - 4} más</p>}
    </div>
  );
}

function ModelTooltip({ active, payload, label, devicesByModel }: any) {
  if (!active || !payload?.length) return null;
  const devs: DeviceRecord[] = devicesByModel[label] ?? [];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl text-xs w-64 pointer-events-none">
      <div className="px-3 py-2.5 border-b border-slate-700">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-slate-400">{payload[0]?.value ?? 0} dispositivos</p>
      </div>
      {devs.slice(0, 6).map(d => (
        <div key={d.id} className="px-3 py-2 border-b border-slate-700/50">
          <p className="text-slate-200 font-medium">{d.device_name ?? d.plate ?? "Sin nombre"}</p>
          <p className="text-slate-500">{d.client_name}</p>
        </div>
      ))}
      {devs.length > 6 && <p className="px-3 py-2 text-slate-500 text-[10px]">+{devs.length - 6} más</p>}
    </div>
  );
}

// ─── Pie activo ───────────────────────────────────────────────────────────────

function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#fff" fontSize={22} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={11}>{payload.name}</text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#64748b" fontSize={10}>{(percent * 100).toFixed(1)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 overflow-hidden ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ChartsView() {
  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [monthly,      setMonthly]      = useState<MonthlyExpiration[]>([]);
  const [devices,      setDevices]      = useState<DeviceRecord[]>([]);
  const [sellers,      setSellers]      = useState<SellerStats[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activePieIdx, setActivePieIdx] = useState(0);
  const [detailPanel,  setDetailPanel]  = useState<DetailPanel | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [st, mo, devRes, se] = await Promise.all([
          api.getStats(),
          api.getMonthlyStats(),
          api.getDevices({ page: 1, page_size: 500 }),
          api.getSellerStats(),
        ]);
        setStats(st); setMonthly(mo); setDevices(devRes.devices); setSellers(se);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      <p className="text-sm">Cargando gráficos…</p>
    </div>
  );
  if (!stats) return null;

  // ── Índices ────────────────────────────────────────────────────────────────

  const devicesByMonthKey: Record<string, DeviceRecord[]> = {};
  for (const d of devices) {
    if (!d.expiration_date) continue;
    const [y, m] = d.expiration_date.split("-");
    const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    if (!devicesByMonthKey[label]) devicesByMonthKey[label] = [];
    devicesByMonthKey[label].push(d);
  }

  const devicesByBucket: Record<string, DeviceRecord[]> = {
    "≤ 7 días": [], "8–15 días": [], "16–30 días": [], "> 30 días": [], "Sin fecha": [],
  };
  for (const d of devices) {
    const days = d.days_until_expiration;
    if (days === null || days === undefined) devicesByBucket["Sin fecha"].push(d);
    else if (days <= 7)  devicesByBucket["≤ 7 días"].push(d);
    else if (days <= 15) devicesByBucket["8–15 días"].push(d);
    else if (days <= 30) devicesByBucket["16–30 días"].push(d);
    else                 devicesByBucket["> 30 días"].push(d);
  }

  const clientMap: Record<string, { fullName: string; total: number; active: number; expired: number; expiring: number; devices: DeviceRecord[] }> = {};
  for (const d of devices) {
    const key = d.client_fulltrack_id;
    if (!clientMap[key]) clientMap[key] = { fullName: d.client_name, total: 0, active: 0, expired: 0, expiring: 0, devices: [] };
    clientMap[key].total++; clientMap[key].devices.push(d);
    if (d.status === "active")   clientMap[key].active++;
    if (d.status === "expired")  clientMap[key].expired++;
    if (d.status === "expiring") clientMap[key].expiring++;
  }
  const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 10);

  const devicesByClientLabel: Record<string, DeviceRecord[]> = {};
  topClients.forEach(c => {
    const label = c.fullName.length > 16 ? c.fullName.slice(0, 16) + "…" : c.fullName;
    devicesByClientLabel[label] = c.devices;
  });

  const topClientsChart = topClients.map(c => ({
    name:     c.fullName.length > 16 ? c.fullName.slice(0, 16) + "…" : c.fullName,
    active:   c.active, expiring: c.expiring, expired: c.expired,
  }));

  const modelMap: Record<string, DeviceRecord[]> = {};
  for (const d of devices) {
    const m = d.model ?? "Sin modelo";
    if (!modelMap[m]) modelMap[m] = [];
    modelMap[m].push(d);
  }
  const modelDataFull = Object.entries(modelMap).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const modelChart = modelDataFull.map(([name, devs], i) => ({
    name: name.length > 14 ? name.slice(0, 14) + "…" : name,
    fullName: name, value: devs.length, fill: PALETTE[i % 8],
  }));
  const devicesByModelLabel: Record<string, DeviceRecord[]> = {};
  modelDataFull.forEach(([name, devs]) => {
    devicesByModelLabel[name.length > 14 ? name.slice(0, 14) + "…" : name] = devs;
  });

  // Pie
  const pieData = [
    { name: "Activos",    value: stats.active,      fill: C.emerald, status: "active"      },
    { name: "Por vencer", value: stats.expiring,    fill: C.amber,   status: "expiring"    },
    { name: "Expirados",  value: stats.expired,     fill: C.rose,    status: "expired"     },
    { name: "Inactivos",  value: stats.deactivated, fill: C.slate,   status: "deactivated" },
  ].filter(d => d.value > 0);

  // Barras mensuales
  const barData = monthly.map(d => {
    const [y, m] = d.month.split("-");
    const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    return { mes: label, vencimientos: d.count };
  });

  // Área acumulada
  let cumulative = 0;
  const lineData = monthly.map(d => {
    const [y, m] = d.month.split("-");
    cumulative += d.count;
    const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    return { mes: label, mensual: d.count, acumulado: cumulative };
  });

  // Urgencia
  const urgencyData = Object.entries(devicesByBucket).map(([name, devs], i) => ({
    name, value: devs.length, fill: [C.rose, C.amber, C.sky, C.emerald, C.slate][i],
  }));

  // Radiales
  const pctActive   = stats.total ? Math.round((stats.active   / stats.total) * 100) : 0;
  const pctExpiring = stats.total ? Math.round((stats.expiring / stats.total) * 100) : 0;
  const pctExpired  = stats.total ? Math.round((stats.expired  / stats.total) * 100) : 0;
  const radialData  = [
    { name: "Activos",    value: pctActive,   fill: C.emerald, count: stats.active   },
    { name: "Por vencer", value: pctExpiring, fill: C.amber,   count: stats.expiring },
    { name: "Expirados",  value: pctExpired,  fill: C.rose,    count: stats.expired  },
  ];

  // Sellers
  const sellerData = sellers.slice(0, 10).map(s => ({
    name: s.seller_name.length > 16 ? s.seller_name.slice(0, 14) + "…" : s.seller_name,
    fullName: s.seller_name,
    Activos: s.active, "Por vencer": s.expiring, Vencidos: s.expired, Desactivados: s.deactivated,
    revenue: s.monthly_revenue,
  }));
  const totalRevenue = sellers.reduce((sum, s) => sum + s.monthly_revenue, 0);

  function openDetail(title: string, color: string, devs: DeviceRecord[]) {
    setDetailPanel({ title, color, devices: devs });
  }

  return (
    <div className="flex-1 overflow-auto p-5 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Fila 1: Pie + Urgencia (ORIGINALES) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Distribución de estados" subtitle="Haz clic en un sector para ver los equipos">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  activeIndex={activePieIdx} activeShape={renderActiveShape}
                  data={pieData} cx="50%" cy="50%" innerRadius={68} outerRadius={95}
                  dataKey="value"
                  onMouseEnter={(_, i) => setActivePieIdx(i)}
                  onClick={(d) => openDetail(`${d.name} (${d.value})`, d.fill, devices.filter(v => v.status === d.status))}
                  style={{ cursor: "pointer" }}
                >
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} stroke="transparent" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
              {pieData.map(d => (
                <button key={d.name}
                  onClick={() => openDetail(`${d.name} (${d.value})`, d.fill, devices.filter(v => v.status === d.status))}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                  {d.name}: <span className="text-white font-semibold">{d.value}</span>
                </button>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Urgencia de vencimiento" subtitle="Hover para ver equipos · clic para detalles" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={urgencyData} barSize={40}
                onClick={(data) => {
                  if (!data?.activePayload) return;
                  const bucket = data.activePayload[0]?.payload?.name;
                  if (bucket) openDetail(`Vencen ${bucket}`, data.activePayload[0]?.payload?.fill, devicesByBucket[bucket] ?? []);
                }}
                style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={(props) => <UrgencyTooltip {...props} devicesByBucket={devicesByBucket} />} cursor={{ fill: "#1e293b" }} />
                <Bar dataKey="value" name="Dispositivos" radius={[6, 6, 0, 0]}>
                  {urgencyData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Fila 2: Vencimientos por mes (ORIGINAL) ── */}
        <ChartCard title="Vencimientos por mes" subtitle="Hover para ver qué equipos vencen ese mes · clic para detalles">
          {barData.length === 0 ? (
            <p className="text-xs text-slate-600 italic text-center py-10">Sin datos de vencimientos futuros.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={28}
                onClick={(data) => {
                  if (!data?.activePayload) return;
                  const mes = data.activePayload[0]?.payload?.mes;
                  if (mes) openDetail(`Vencen en ${mes}`, C.sky, devicesByMonthKey[mes] ?? []);
                }}
                style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={(props) => <MonthlyTooltip {...props} devicesByMonth={devicesByMonthKey} />} cursor={{ fill: "#1e293b" }} />
                <Bar dataKey="vencimientos" name="Vencimientos" radius={[6, 6, 0, 0]}>
                  {barData.map((d, i) => {
                    const isMax = d.vencimientos === Math.max(...barData.map(b => b.vencimientos));
                    return <Cell key={i} fill={isMax ? C.rose : C.sky} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── Fila 3: Área + Modelos (ORIGINALES) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Tendencia acumulada" subtitle="Mensual vs. total acumulado de vencimientos">
            {lineData.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center py-10">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.sky}    stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.sky}    stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.violet} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.violet} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={(props) => <MonthlyTooltip {...props} devicesByMonth={devicesByMonthKey} />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
                  <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} wrapperStyle={{ paddingTop: 8 }} />
                  <Area type="monotone" dataKey="mensual"   name="Mensual"   stroke={C.sky}    fill="url(#gM)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke={C.violet} fill="url(#gA)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Dispositivos por modelo GPS" subtitle="Hover para ver vehículos · clic para detalles">
            {modelChart.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center py-10">Sin datos.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={modelChart} layout="vertical" barSize={14}
                    onClick={(data) => {
                      if (!data?.activePayload) return;
                      const label = data.activePayload[0]?.payload?.name;
                      if (label) openDetail(`Modelo: ${data.activePayload[0]?.payload?.fullName}`, data.activePayload[0]?.payload?.fill, devicesByModelLabel[label] ?? []);
                    }}
                    style={{ cursor: "pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={(props) => <ModelTooltip {...props} devicesByModel={devicesByModelLabel} />} cursor={{ fill: "#1e293b" }} />
                    <Bar dataKey="value" name="Dispositivos" radius={[0, 6, 6, 0]}>
                      {modelChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {modelChart.map(d => (
                    <button key={d.name} onClick={() => openDetail(`Modelo: ${d.fullName}`, d.fill, devicesByModelLabel[d.name] ?? [])}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.fill }} />
                      {d.name}: <span className="text-white font-semibold">{d.value}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </ChartCard>
        </div>

        {/* ── Fila 4: Top clientes (ORIGINAL) ── */}
        <ChartCard title="Top clientes por dispositivos" subtitle="Hover para ver sus vehículos · clic para detalles">
          {topClientsChart.length === 0 ? (
            <p className="text-xs text-slate-600 italic text-center py-10">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topClientsChart} barSize={20}
                onClick={(data) => {
                  if (!data?.activePayload) return;
                  const label = data.activePayload[0]?.payload?.name;
                  if (label) openDetail(label, C.sky, devicesByClientLabel[label] ?? []);
                }}
                style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={(props) => <ClientTooltip {...props} devicesByClient={devicesByClientLabel} />} cursor={{ fill: "#1e293b" }} />
                <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="active"   name="Activos"    stackId="a" fill={C.emerald} />
                <Bar dataKey="expiring" name="Por vencer" stackId="a" fill={C.amber}   />
                <Bar dataKey="expired"  name="Expirados"  stackId="a" fill={C.rose} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── Fila 5: Radiales (ORIGINAL) ── */}
        <ChartCard title="Porcentaje del parque" subtitle="Proporción de cada estado · haz clic para ver los equipos">
          <div className="flex items-center justify-around flex-wrap gap-6">
            {radialData.map(d => (
              <button key={d.name}
                onClick={() => openDetail(`${d.name} (${d.count})`, d.fill, devices.filter(v =>
                  d.name === "Activos"    ? v.status === "active"   :
                  d.name === "Por vencer" ? v.status === "expiring" : v.status === "expired"
                ))}
                className="flex flex-col items-center gap-2 group">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={d.fill} strokeWidth="10"
                      strokeDasharray={`${d.value * 2.513} 251.3`} strokeLinecap="round"
                      className="transition-all duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white group-hover:scale-110 transition-transform">{d.value}%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.count} equipos</p>
                </div>
              </button>
            ))}
          </div>
        </ChartCard>

        {/* ── NUEVOS: Vendedores ── */}
        <ChartCard
          title="Dispositivos por vendedor"
          subtitle={`${sellers.length} vendedores · Facturación mensual estimada: $${totalRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`}
        >
          {sellerData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-slate-600 text-sm">
              No hay vendedores asignados. Edita los dispositivos para asignar.
            </div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sellerData} margin={{ left: -10, right: 10, top: 5, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Legend formatter={v => <span className="text-xs text-slate-300">{v}</span>} iconType="circle" iconSize={8} />
                    <Bar dataKey="Activos"      stackId="a" fill={STATUS_COLORS.active}      radius={[0,0,0,0]} maxBarSize={48} />
                    <Bar dataKey="Por vencer"   stackId="a" fill={STATUS_COLORS.expiring}    maxBarSize={48} />
                    <Bar dataKey="Vencidos"     stackId="a" fill={STATUS_COLORS.expired}     maxBarSize={48} />
                    <Bar dataKey="Desactivados" stackId="a" fill={STATUS_COLORS.deactivated} radius={[4,4,0,0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                {sellers.slice(0, 8).map((s, i) => (
                  <div key={s.seller_name} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SELLER_COLORS[i % SELLER_COLORS.length] }} />
                      <span className="text-xs text-slate-300 truncate">{s.seller_name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({s.total})</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-400 shrink-0 ml-2">
                      {s.monthly_revenue > 0 ? `$${s.monthly_revenue.toLocaleString("es-MX", { minimumFractionDigits: 0 })}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* ── NUEVO: Resumen ejecutivo ── */}
        <ChartCard title="Resumen ejecutivo" subtitle="Estado actual del portafolio">
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, color: "sky",     label: "Total dispositivos",   val: stats.total,               sub: "en cartera" },
              { icon: Users,      color: "emerald", label: "Activos / saludables", val: stats.active,              sub: `${stats.total > 0 ? Math.round(stats.active / stats.total * 100) : 0}% del total` },
              { icon: TrendingUp, color: "amber",   label: "Vencen este mes",      val: stats.expiring_this_month, sub: "a atender"  },
              { icon: DollarSign, color: "violet",  label: "Facturación estimada", val: `$${totalRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, sub: "MXN / mes" },
            ].map(({ icon: Icon, color, label, val, sub }) => (
              <div key={label} style={{ background: `color-mix(in srgb, transparent, var(--tw-${color}) 5%)` }}
                className={`bg-${color}-500/5 border border-${color}-500/20 rounded-xl p-4`}>
                <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{val}</p>
                <p className="text-xs font-medium text-slate-300 mt-0.5">{label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </ChartCard>

      </div>

      {/* Panel lateral de detalle */}
      {detailPanel && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setDetailPanel(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 z-20">
            <DetailSidePanel panel={detailPanel} onClose={() => setDetailPanel(null)} />
          </div>
        </>
      )}
    </div>
  );
}
