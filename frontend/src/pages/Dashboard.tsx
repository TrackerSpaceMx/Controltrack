import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";

import { StatusBadge } from "../components/Badge";
import { ClientDrawer } from "../components/ClientDrawer";
import { RenewalModal } from "../components/RenewalModal";
import { DeviceDetailsModal } from "../components/DeviceDetailsModal";
import { ExportModal } from "../components/ExportModal";
import { ChartsView } from "./ChartsView";
import { api, DeviceRecord, DashboardStats, CONTRACT_LABELS } from "../api";
import {
  Search, Download, Play, Pause, Calendar, Activity,
  AlertTriangle, XCircle, MapPin, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, TrendingUp, Clock, BarChart2,
  LayoutDashboard, ChevronDown, ChevronUp, Cpu, Tag,
  Car, Palette, Gauge, Edit2, CheckSquare, Square, Settings,
} from "lucide-react";

interface DashboardProps { onLogout: () => void; session?: import('../api').SessionInfo; }

interface VehicleDetail {
  ras_vei_placa: string;
  ras_vei_ano: string;
  ras_vei_cor: string;
  ras_vei_odometro: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilLabel(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: "Sin fecha",                    cls: "text-slate-600 italic"      };
  if (days < 0)      return { text: `Venció hace ${Math.abs(days)}d`, cls: "text-rose-500 font-semibold" };
  if (days === 0)    return { text: "Vence hoy",                    cls: "text-rose-500 font-bold"    };
  if (days <= 7)     return { text: `Vence en ${days}d`,            cls: "text-rose-400 font-semibold" };
  if (days <= 15)    return { text: `Vence en ${days}d`,            cls: "text-amber-400 font-semibold" };
  if (days <= 30)    return { text: `Vence en ${days}d`,            cls: "text-amber-500"             };
  return                    { text: `Vence en ${days}d`,            cls: "text-slate-400"             };
}

const PAGE_SIZE = 10;

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  if (totalPages <= 1) return (
    <p className="text-xs text-slate-400">
      Mostrando <span className="font-medium text-white">{total}</span> resultados
    </p>
  );

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="flex items-center justify-between w-full">
      <p className="text-xs text-slate-400">
        Mostrando <span className="font-medium text-white">{from}–{to}</span> de{" "}
        <span className="font-medium text-white">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onChange(page - 1)}
          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-slate-600 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onChange(p as number)}
              className={`w-6 h-6 text-xs rounded-md transition-colors ${
                p === page ? "bg-sky-500 text-white font-bold" : "text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}>{p}</button>
          )
        )}
        <button disabled={page === Math.ceil(total / pageSize)} onClick={() => onChange(page + 1)}
          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

function ExpandedDeviceRow({ device, colSpan }: { device: DeviceRecord; colSpan: number }) {
  const [vehicleDetail, setVehicleDetail] = useState<VehicleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customFields,  setCustomFields]  = useState(device.custom_fields ?? []);

  // Re-fetch custom fields when expanding (in case list endpoint didn't include them)
  useEffect(() => {
    const base = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";
    const token = (window as any).__ct_token ?? "";
    fetch(`${base}/api/devices/${device.id}/custom-fields`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setCustomFields(data); })
      .catch(() => {});
  }, [device.id]);

  useEffect(() => {
    if (!device.vehicle_id) return;
    setLoadingDetail(true);
    const base = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";
    fetch(`${base}/api/vehicles/${device.vehicle_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data?.[0]) setVehicleDetail(data.data[0]); })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [device.vehicle_id]);

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="bg-slate-800/60 border-t border-b border-slate-700/60 px-4 py-3">
          <div className="flex flex-wrap gap-6 mb-3">
            {/* SIM */}
            <InfoChip icon={<Cpu className="w-3.5 h-3.5 text-sky-400" />} bg="bg-sky-500/15" label="SIM / Chip" value={device.sim ?? "—"} mono />
            {/* Vendedor */}
            {device.seller_name && <InfoChip icon={<span className="text-violet-400 text-xs">$</span>} bg="bg-violet-500/15" label="Vendedor" value={device.seller_name} />}
            {/* Instalador */}
            {device.installer_name && <InfoChip icon={<span className="text-amber-400 text-xs">🔧</span>} bg="bg-amber-500/15" label="Instalador" value={device.installer_name} />}
            {/* Fecha instalación */}
            {device.install_date && <InfoChip icon={<Calendar className="w-3.5 h-3.5 text-emerald-400" />} bg="bg-emerald-500/15" label="F. instalación" value={new Date(device.install_date + "T12:00:00").toLocaleDateString("es-MX")} />}
            {/* Precio */}
            {device.monthly_price != null && <InfoChip icon={<span className="text-sky-400 text-xs font-bold">$</span>} bg="bg-sky-500/15" label="Precio mensual" value={`$${device.monthly_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`} />}
            {/* RFC */}
            {device.rfc && <InfoChip icon={<span className="text-rose-400 text-xs font-bold">RFC</span>} bg="bg-rose-500/15" label="RFC" value={device.rfc} mono />}

            {/* Vehicle data */}
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando vehículo…
              </div>
            ) : vehicleDetail ? (
              <>
                <InfoChip icon={<Tag className="w-3.5 h-3.5 text-emerald-400" />} bg="bg-emerald-500/15" label="Placa" value={vehicleDetail.ras_vei_placa || "—"} mono />
                <InfoChip icon={<Calendar className="w-3.5 h-3.5 text-amber-400" />} bg="bg-amber-500/15" label="Año" value={vehicleDetail.ras_vei_ano || "—"} />
                <InfoChip icon={<Palette className="w-3.5 h-3.5 text-violet-400" />} bg="bg-violet-500/15" label="Color" value={(vehicleDetail.ras_vei_cor || "—").toLowerCase()} />
                <InfoChip icon={<Gauge className="w-3.5 h-3.5 text-rose-400" />} bg="bg-rose-500/15" label="Odómetro"
                  value={vehicleDetail.ras_vei_odometro ? `${Number(vehicleDetail.ras_vei_odometro).toLocaleString("es-MX")} km` : "—"} />
              </>
            ) : null}
          </div>

          {/* Campos personalizados */}
          {customFields.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-700/40">
              {customFields.map(cf => (
                <InfoChip key={cf.field_key} icon={<span className="text-slate-400 text-[10px]">CF</span>} bg="bg-slate-700/50" label={cf.field_label} value={cf.field_value || "—"} />
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function InfoChip({ icon, bg, label, value, mono }: {
  icon: React.ReactNode; bg: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 min-w-[120px]">
      <div className={`w-6 h-6 rounded ${bg} flex items-center justify-center shrink-0 mt-0.5`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Client search dropdown ───────────────────────────────────────────────────

function ClientSearchFilter({ value, onChange, allClients }: {
  value: string; onChange: (v: string) => void;
  allClients: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = value.toLowerCase();
    return allClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, allClients]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-slate-400 mb-1">Cliente</label>
      <div className="relative">
        <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-6 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <button onClick={() => setOpen(v => !v)} className="absolute right-1.5 top-1.5 text-slate-500 hover:text-slate-300">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button key={c.id} onClick={() => { onChange(c.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors group">
              <p className="text-xs font-medium text-white group-hover:text-sky-400 truncate">{c.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard({ onLogout, session }: DashboardProps) {

  // viewer solo puede ver, no modificar
  const isViewer = session?.role === "viewer" && !session?.is_superadmin;

  // Store token globally for ExpandedDeviceRow
  useEffect(() => {
    if (session?.token) (window as any).__ct_token = session.token;
  }, [session?.token]);

  const [activeTab, setActiveTab] = useState<"dashboard" | "charts">("dashboard");

  const [devices,    setDevices]    = useState<DeviceRecord[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [error,      setError]      = useState("");
  const [stats,      setStats]      = useState<DashboardStats>({
    total: 0, active: 0, expiring: 0, expired: 0, deactivated: 0, expiring_this_month: 0,
  });

  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filters
  const [searchClient,  setSearchClient]  = useState("");
  const [searchImei,    setSearchImei]    = useState("");
  const [searchDevice,  setSearchDevice]  = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [expiringDays,  setExpiringDays]  = useState<number | undefined>();
  const [expireFrom,    setExpireFrom]    = useState("");
  const [expireTo,      setExpireTo]      = useState("");
  const [sellerFilter,  setSellerFilter]  = useState("");
  const [contractFilter,setContractFilter]= useState("");
  const [page,          setPage]          = useState(1);

  // Multi-select
  const [selectedIds,  setSelectedIds]  = useState<Set<number>>(new Set());
  const [bulkLoading,  setBulkLoading]  = useState(false);

  // Modals
  const [drawerClientId,   setDrawerClientId]   = useState<string | null>(null);
  const [isDrawerOpen,     setIsDrawerOpen]     = useState(false);
  const [renewalDevice,    setRenewalDevice]    = useState<DeviceRecord | null>(null);
  const [isRenewalOpen,    setIsRenewalOpen]    = useState(false);
  const [detailsDevice,    setDetailsDevice]    = useState<DeviceRecord | null>(null);
  const [isDetailsOpen,    setIsDetailsOpen]    = useState(false);
  const [isExportOpen,     setIsExportOpen]     = useState(false);
  const [filtersOpen,    setFiltersOpen]    = useState(true);

  useEffect(() => {
    api.getDevices({ page: 1, page_size: 1000 }).then(res => {
      const map = new Map<string, string>();
      res.devices.forEach(d => map.set(d.client_fulltrack_id, d.client_name));
      setAllClients(Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [res, st] = await Promise.all([
        api.getDevices({
          search_client:        searchClient   || undefined,
          search_imei:          searchImei     || undefined,
          search_device:        searchDevice   || undefined,
          status_filter:        statusFilter   !== "all" ? statusFilter : undefined,
          expiring_days:        expiringDays,
          expire_from:          expireFrom     || undefined,
          expire_to:            expireTo       || undefined,
          seller_filter:        sellerFilter   || undefined,
          contract_type_filter: contractFilter || undefined,
          page,
          page_size: PAGE_SIZE,
        }),
        api.getStats(),
      ]);
      setDevices(res.devices);
      setTotal(res.total);
      setStats(st);
      setLastUpdate(new Date().toLocaleTimeString("es-MX"));
      setSelectedIds(new Set()); // reset selection on new data
    } catch (e: any) {
      setError(e.message ?? "Error cargando datos");
    } finally { setLoading(false); }
  }, [searchClient, searchImei, searchDevice, statusFilter, expiringDays, expireFrom, expireTo, sellerFilter, contractFilter, page]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [searchClient, searchImei, searchDevice, statusFilter, expiringDays, expireFrom, expireTo, sellerFilter, contractFilter]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => { loadData(); }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const res = await api.sync();
      setSyncMsg(`✅ ${res.synced_devices} dispositivos sincronizados`);
      await loadData();
    } catch (e: any) { setSyncMsg(`❌ ${e.message}`); }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(""), 5000); }
  };

  const handleToggleDevice = async (e: React.MouseEvent, device: DeviceRecord, deactivate: boolean) => {
    e.stopPropagation();
    try {
      await api.toggleDevice(device.id, deactivate);
      await loadData();  // refresh inmediato
    } catch (err: any) { alert(err.message); }
  };

  const handleConfirmRenewal = async (deviceId: number, newDate: string) => {
    try {
      await api.updateExpiration(deviceId, newDate);
      await loadData();  // refresh inmediato
    } catch (err: any) { alert(err.message); }
  };

  // ─── Bulk select ────────────────────────────────────────────────────────────

  const allPageSelected = devices.length > 0 && devices.every(d => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); devices.forEach(d => next.delete(d.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); devices.forEach(d => next.add(d.id)); return next; });
    }
  };

  const toggleSelectDevice = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleBulkToggle = async (deactivate: boolean) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkLoading(true);
    try {
      const res = await api.bulkToggle(ids, deactivate);
      setSelectedIds(new Set());
      await loadData();  // refresh inmediato
      alert(`${res.updated} dispositivos actualizados`);
    } catch (e: any) { alert(e.message); }
    finally { setBulkLoading(false); }
  };

  // ─── Filters ────────────────────────────────────────────────────────────────

  function applyQuickExpiry(days: number) {
    setExpiringDays(prev => prev === days ? undefined : days);
    setExpireFrom(""); setExpireTo("");
  }

  function applyThisMonth() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    setExpireFrom(`${y}-${String(m + 1).padStart(2, "0")}-01`);
    setExpireTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
    setExpiringDays(undefined);
  }

  function clearFilters() {
    setSearchClient(""); setSearchImei(""); setSearchDevice("");
    setExpiringDays(undefined); setExpireFrom(""); setExpireTo("");
    setSellerFilter(""); setContractFilter(""); setStatusFilter("all");
  }

  function toggleRow(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setExpandedRows(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  const hasFilters = !!(searchClient || searchImei || searchDevice || expiringDays !== undefined || expireFrom || expireTo || sellerFilter || contractFilter || statusFilter !== "all");
  const currentMonthLabel = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const COL_COUNT = 12;

  return (
    <div className="flex flex-col flex-1 bg-slate-950 font-sans text-slate-300 overflow-hidden h-full">

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">Dashboard General</h1>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-2">
                <button onClick={() => setActiveTab("dashboard")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "dashboard" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <LayoutDashboard className="w-3.5 h-3.5" /> Tabla
                </button>
                <button onClick={() => setActiveTab("charts")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "charts" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <BarChart2 className="w-3.5 h-3.5" /> Gráficos
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {syncMsg && <span className="text-sm text-slate-400 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg">{syncMsg}</span>}
              {lastUpdate && <span className="text-xs text-slate-500">Última actualización: Hoy, {lastUpdate}</span>}
              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors disabled:opacity-50 text-sm">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sincronizar
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Cuentas activas",               value: stats.active,              icon: Activity,      color: "emerald", filter: "active"   },
              { label: "Por vencer (15 días)",           value: stats.expiring,            icon: AlertTriangle, color: "amber",   filter: "expiring" },
              { label: "Vencidas",                       value: stats.expired,             icon: XCircle,       color: "rose",    filter: "expired"  },
              { label: "Total dispositivos",             value: stats.total,               icon: MapPin,        color: "sky",     filter: "all"      },
              { label: `Vencen en ${currentMonthLabel}`, value: stats.expiring_this_month, icon: TrendingUp,    color: "violet",  filter: "month"    },
            ].map(({ label, value, icon: Icon, color, filter }) => (
              <button key={label}
                onClick={() => {
                  if (filter === "month") { applyThisMonth(); setStatusFilter("all"); setActiveTab("dashboard"); }
                  else { setStatusFilter(filter); setExpiringDays(undefined); setExpireFrom(""); setExpireTo(""); setActiveTab("dashboard"); }
                }}
                className={`bg-slate-900 border rounded-xl p-3 flex items-center gap-3 text-left transition-all hover:border-slate-600
                  ${(statusFilter === filter && filter !== "month" && activeTab === "dashboard") || (filter === "month" && expireFrom && activeTab === "dashboard")
                    ? `border-${color}-500/50 ring-1 ring-${color}-500/30` : "border-slate-800"}`}>
                <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 text-${color}-500`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 leading-tight">{label}</p>
                  <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === "charts" ? (
          <ChartsView />
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* ── Filters panel (colapsable) ── */}
            <div className={`border-r border-slate-800 bg-slate-900/30 shrink-0 flex flex-col transition-all duration-200 ${filtersOpen ? "w-56" : "w-10"}`}>
              {/* Toggle header */}
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-3 border-b border-slate-800 text-slate-500 hover:text-slate-300 transition-colors w-full"
                title={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                {filtersOpen && <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>}
                {filtersOpen
                  ? <ChevronLeft className="w-3 h-3 ml-auto shrink-0" />
                  : <ChevronRight className="w-3 h-3 shrink-0" />}
              </button>
              {filtersOpen && <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">

              <ClientSearchFilter value={searchClient} onChange={setSearchClient} allClients={allClients} />

              {/* IMEI */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">IMEI</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input value={searchImei} onChange={e => setSearchImei(e.target.value)}
                    placeholder="Buscar IMEI..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
              </div>

              {/* Vehículo / Placa */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Vehículo / Placa</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input value={searchDevice} onChange={e => setSearchDevice(e.target.value)}
                    placeholder="Vehículo, placa, SIM..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
              </div>

              {/* Vendedor */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Vendedor</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
                    placeholder="Nombre del vendedor"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Estado</label>
                <div className="space-y-1">
                  {[
                    { id: "all",         label: "Todos",         dot: "bg-slate-500" },
                    { id: "active",      label: "Activos",       dot: "bg-emerald-500" },
                    { id: "expiring",    label: "Por vencer",    dot: "bg-amber-500"   },
                    { id: "expired",     label: "Vencidos",      dot: "bg-rose-500"    },
                    { id: "deactivated", label: "Desactivados",  dot: "bg-slate-400"   },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => { setStatusFilter(tab.id); setExpiringDays(undefined); setExpireFrom(""); setExpireTo(""); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                        statusFilter === tab.id && !expiringDays && !expireFrom
                          ? "bg-slate-800 text-white font-medium"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tab.dot} shrink-0`} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo contrato */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Tipo contrato</label>
                <div className="space-y-1">
                  {[
                    { value: "",            label: "Todos"         },
                    { value: "monthly",     label: "Mensual"       },
                    { value: "quarterly",   label: "Trimestral"    },
                    { value: "semiannual",  label: "Semestral"     },
                    { value: "annual",      label: "Anual"         },
                    { value: "lease",       label: "Arrendamiento" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setContractFilter(opt.value)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                        contractFilter === opt.value
                          ? "bg-slate-800 text-white font-medium"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rango de vencimiento — selector unificado */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Rango de vencimiento
                </label>
                {/* Quick chips */}
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {[7, 15, 30, 60].map(days => (
                    <button key={days} onClick={() => applyQuickExpiry(days)}
                      className={`py-1 text-xs rounded-md border transition-colors ${
                        expiringDays === days
                          ? "bg-sky-500/20 border-sky-500/50 text-sky-400"
                          : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                      }`}>{days}d</button>
                  ))}
                </div>
                <button onClick={() => expireFrom ? (setExpireFrom(""), setExpireTo("")) : applyThisMonth()}
                  className={`w-full mb-2 py-1 text-xs rounded-md border transition-colors ${
                    expireFrom ? "bg-violet-500/20 border-violet-500/50 text-violet-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}>
                  Este mes
                </button>
                {/* Unified range: from—to in one row */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5 focus-within:border-sky-500 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 w-8 shrink-0">Desde</span>
                    <input type="date" value={expireFrom}
                      onChange={e => { setExpireFrom(e.target.value); setExpiringDays(undefined); }}
                      className="flex-1 bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]" />
                  </div>
                  <div className="border-t border-slate-800" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 w-8 shrink-0">Hasta</span>
                    <input type="date" value={expireTo}
                      onChange={e => { setExpireTo(e.target.value); setExpiringDays(undefined); }}
                      className="flex-1 bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]" />
                  </div>
                </div>
                {(expireFrom || expireTo) && (
                  <button onClick={() => { setExpireFrom(""); setExpireTo(""); }} className="text-[10px] text-slate-500 hover:text-slate-300 mt-1">
                    × Limpiar rango
                  </button>
                )}
              </div>

              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-sky-400 hover:text-sky-300 underline text-left">
                  Limpiar filtros
                </button>
              )}
              </div>}
            </div>

            {/* ── Table ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

              {/* Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-2">
                  {!isViewer && selectedIds.size > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded-lg">
                        {selectedIds.size} seleccionados
                      </span>
                      <button onClick={() => handleBulkToggle(true)} disabled={bulkLoading}
                        className="flex items-center px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs transition-colors disabled:opacity-50">
                        {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                        Desactivar selección
                      </button>
                      <button onClick={() => handleBulkToggle(false)} disabled={bulkLoading}
                        className="flex items-center px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs transition-colors disabled:opacity-50">
                        {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                        Activar selección
                      </button>
                      <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 hover:text-slate-300">✕</button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">{total} dispositivos</span>
                  )}
                </div>
                <button onClick={() => setIsExportOpen(true)}
                  className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Exportar
                </button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
                    <p className="text-sm">Cargando dispositivos…</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-rose-400 gap-2">
                    <XCircle className="w-7 h-7" />
                    <p className="text-sm">{error}</p>
                    <button onClick={loadData} className="text-xs text-sky-400 underline">Reintentar</button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs" style={{ tableLayout: "fixed", minWidth: 900 }}>
                    <colgroup>
                      <col style={{ width: 32 }}  /> {/* checkbox */}
                      <col style={{ width: 32 }}  /> {/* expand */}
                      <col style={{ width: 140 }} /> {/* cliente */}
                      <col style={{ width: 110 }} /> {/* vehículo */}
                      <col style={{ width: 130 }} /> {/* imei */}
                      <col style={{ width: 120 }} /> {/* modelo */}
                      <col style={{ width: 100 }} /> {/* contrato */}
                      <col style={{ width: 100 }} /> {/* vendedor */}
                      <col style={{ width: 82 }}  /> {/* fecha alta */}
                      <col style={{ width: 90 }}  /> {/* vencimiento */}
                      <col style={{ width: 110 }} /> {/* tiempo restante */}
                      <col style={{ width: 90 }}  /> {/* estado */}
                      <col style={{ width: 90 }}  /> {/* acciones — ancho fijo garantizado */}
                    </colgroup>
                    <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        {/* Checkbox all */}
                        <th className="px-2 py-2.5 border-b border-slate-800">
                          <button onClick={toggleSelectAll} className="text-slate-500 hover:text-white transition-colors">
                            {allPageSelected
                              ? <CheckSquare className="w-4 h-4 text-sky-400" />
                              : <Square className="w-4 h-4" />}
                          </button>
                        </th>
                        {/* Expand all */}
                        <th className="px-2 py-2.5 border-b border-slate-800">
                          <button
                            title={expandedRows.size > 0 ? "Colapsar todos" : "Expandir todos"}
                            onClick={() => {
                              if (expandedRows.size > 0) { setExpandedRows(new Set()); }
                              else { setExpandedRows(new Set(devices.map(d => d.id))); }
                            }}
                            className="text-slate-500 hover:text-sky-400 transition-colors"
                          >
                            {expandedRows.size > 0
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </th>
                        {["Cliente","Vehículo","IMEI","Modelo GPS","Contrato","Vendedor","Fecha Alta","Vencimiento","Tiempo restante","Estado","Acciones"].map(h => (
                          <th key={h} className="px-3 py-2.5 font-medium text-slate-400 border-b border-slate-800 truncate">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device, index) => {
                        const dl = daysUntilLabel(device.days_until_expiration ?? null);
                        const isExpanded = expandedRows.has(device.id);
                        const isSelected = selectedIds.has(device.id);
                        return (
                          <React.Fragment key={device.id}>
                            <tr
                              onClick={() => { setDrawerClientId(device.client_fulltrack_id); setIsDrawerOpen(true); }}
                              className={`border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors cursor-pointer group ${isSelected ? "bg-sky-500/5" : ""}`}
                            >
                              {/* Checkbox */}
                              <td className="px-2 py-2.5" onClick={e => toggleSelectDevice(e, device.id)}>
                                {isSelected
                                  ? <CheckSquare className="w-4 h-4 text-sky-400" />
                                  : <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />}
                              </td>
                              {/* Expand */}
                              <td className="px-2 py-2.5">
                                <button onClick={e => toggleRow(e, device.id)} title="Ver detalles"
                                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isExpanded ? "bg-sky-500/20 text-sky-400" : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"}`}>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-white truncate" title={device.client_name}>{device.client_name}</td>
                              <td className="px-3 py-2.5 text-slate-300 truncate" title={device.device_name ?? device.plate ?? ""}>{device.device_name ?? device.plate ?? "—"}</td>
                              <td className="px-3 py-2.5 text-slate-400 font-mono truncate">{device.imei}</td>
                              <td className="px-3 py-2.5 text-slate-400 truncate" title={device.model ?? ""}>{device.model ?? "—"}</td>
                              <td className="px-3 py-2.5">
                                {device.contract_type ? (() => {
                                  const cfg: Record<string, { label: string; cls: string }> = {
                                    monthly:    { label: "Mensual",       cls: "bg-sky-500/15 text-sky-300 border-sky-500/30"         },
                                    quarterly:  { label: "Trimestral",   cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
                                    semiannual: { label: "Semestral",    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
                                    annual:     { label: "Anual",        cls: "bg-amber-500/15 text-amber-300 border-amber-500/30"    },
                                    lease:      { label: "Arrend.",      cls: "bg-rose-500/15 text-rose-300 border-rose-500/30"       },
                                  };
                                  const c = cfg[device.contract_type] ?? { label: device.contract_type, cls: "bg-slate-800 text-slate-300 border-slate-700" };
                                  return <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${c.cls}`}>{c.label}</span>;
                                })() : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-slate-400 truncate" title={device.seller_name ?? ""}>{device.seller_name ?? "—"}</td>
                              <td className="px-3 py-2.5 text-slate-400 truncate">{device.registration_date ?? "—"}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 opacity-40 shrink-0" />
                                  <span className="truncate">
                                    {device.expiration_date
                                      ? new Date(device.expiration_date + "T12:00:00").toLocaleDateString("es-MX")
                                      : <span className="text-slate-600 italic">Sin fecha</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5"><span className={`text-xs ${dl.cls}`}>{dl.text}</span></td>
                              <td className="px-3 py-2.5"><StatusBadge status={device.status as any} /></td>
                              {/* Acciones — ocultas para viewer */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {!isViewer && (
                                    <>
                                      <button
                                        onClick={e => { e.stopPropagation(); setDetailsDevice(device); setIsDetailsOpen(true); }}
                                        className="p-1 rounded-md hover:bg-slate-700 text-violet-400 transition-colors"
                                        title="Editar detalles">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={e => { e.stopPropagation(); setRenewalDevice(device); setIsRenewalOpen(true); }}
                                        className="p-1 rounded-md hover:bg-slate-700 text-sky-400 transition-colors"
                                        title="Renovar">
                                        <Calendar className="w-3.5 h-3.5" />
                                      </button>
                                      {device.status !== "deactivated" ? (
                                        <button onClick={e => handleToggleDevice(e, device, true)}
                                          className="p-1 rounded-md hover:bg-slate-700 text-rose-500 transition-colors" title="Desactivar">
                                          <Pause className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <button onClick={e => handleToggleDevice(e, device, false)}
                                          className="p-1 rounded-md hover:bg-slate-700 text-emerald-500 transition-colors" title="Activar">
                                          <Play className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && <ExpandedDeviceRow device={device} colSpan={COL_COUNT} />}
                          </React.Fragment>
                        );
                      })}
                      {devices.length === 0 && (
                        <tr>
                          <td colSpan={COL_COUNT} className="px-4 py-12 text-center text-slate-500">
                            No se encontraron dispositivos con los filtros actuales.
                          </td>
                        </tr>
                      )}
                      {/* Filas vacías para llenar el espacio disponible */}
                      {devices.length > 0 && devices.length < PAGE_SIZE && Array.from({ length: PAGE_SIZE - devices.length }).map((_, i) => (
                        <tr key={`empty-${i}`} className="border-b border-slate-800/30">
                          {Array.from({ length: COL_COUNT }).map((_, j) => (
                            <td key={j} className="py-3" />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/50">
                <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </div>
          </div>
        )}
      </main>

      <ClientDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        clientId={drawerClientId}
        onRenewDevice={device => { setRenewalDevice(device); setIsRenewalOpen(true); }}
        onToggleDevice={async (device, deactivate) => { await api.toggleDevice(device.id, deactivate); }}
        onRefresh={loadData}
        session={session}
      />

      <RenewalModal
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        device={renewalDevice}
        onConfirm={handleConfirmRenewal}
      />

      <DeviceDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        device={detailsDevice}
        onSaved={async (updated) => {
          setIsDetailsOpen(false);
          await loadData();  // refresh inmediato
        }}
      />

      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
