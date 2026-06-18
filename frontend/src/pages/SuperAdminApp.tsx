import React, { useState, useEffect } from "react";
import { adminApi, SessionInfo, Tenant } from "../api";
import { TenantsPage }  from "../components/TenantsPage";
import { UsersPage }    from "../components/UsersPage";
import { WhatsAppPage } from "../components/WhatsAppPage";
import { TenantApp }    from "./TenantApp";
import {
  MapPin, LogOut, Building2, Users, MessageCircle, LayoutDashboard,
  ChevronLeft, ChevronRight, ShieldCheck, Loader2, Eye, Activity,
} from "lucide-react";

type Page = "overview" | "tenants" | "users" | "whatsapp";

interface Props { session: SessionInfo; onLogout: () => void; }

export function SuperAdminApp({ session, onLogout }: Props) {
  const [page,          setPage]          = useState<Page>("overview");
  const [collapsed,     setCollapsed]     = useState(false);
  const [tenants,       setTenants]       = useState<Tenant[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [impersonating, setImpersonating] = useState<Tenant | null>(null);

  useEffect(() => {
    adminApi.getTenants()
      .then(setTenants)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Modo impersonación ──────────────────────────────────────────────────────
  if (impersonating) {
    const fakeSession: SessionInfo = {
      token:         session.token,
      role:          "admin",
      username:      impersonating.name,
      tenant_id:     impersonating.id,
      tenant_name:   impersonating.name,
      is_superadmin: false,
    };
    return (
      <div className="flex flex-col h-full">
        {/* Banner */}
        <div className="shrink-0 bg-violet-600 text-white text-xs py-2 px-4 flex items-center justify-between z-50">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Viendo como: <strong>{impersonating.name}</strong>
          </span>
          <button
            onClick={() => setImpersonating(null)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors"
          >
            ← Volver a mi panel
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <TenantApp session={fakeSession} onLogout={() => setImpersonating(null)} hideSidebar={true} />
        </div>
      </div>
    );
  }

  // ── Nav ─────────────────────────────────────────────────────────────────────
  const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Resumen",  icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { id: "tenants",   label: "Clientes", icon: <Building2       className="w-5 h-5 shrink-0" /> },
    { id: "users",     label: "Usuarios", icon: <Users           className="w-5 h-5 shrink-0" /> },
    { id: "whatsapp",  label: "WhatsApp", icon: <MessageCircle   className="w-5 h-5 shrink-0" /> },
  ];

  const activeTenants = tenants.filter(t => t.active).length;
  const totalUsers    = tenants.reduce((s, t) => s + (t.user_count ?? 0), 0);

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">

      {/* Sidebar */}
      <div className={`flex flex-col bg-slate-950 border-r border-slate-800 h-full transition-all duration-300 ${collapsed ? "w-14" : "w-52"}`}>
        <div className={`flex items-center h-14 border-b border-slate-800 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <MapPin className="w-5 h-5 text-sky-500 shrink-0" />
              <span className="text-base font-bold text-white tracking-tight truncate">ControlTrack</span>
            </div>
          )}
          {collapsed && <MapPin className="w-5 h-5 text-sky-500" />}
          <button onClick={() => setCollapsed(v => !v)} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="mx-3 mt-3 px-2 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-[11px] font-semibold text-violet-400 truncate">Super Admin</span>
          </div>
        )}

        <div className="flex-1 py-4 px-2 space-y-1">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} title={collapsed ? item.label : undefined}
              className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors ${
                page === item.id ? "bg-sky-500/10 text-sky-400" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}>
              {item.icon}
              {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-800">
          <button onClick={onLogout} title={collapsed ? "Cerrar sesión" : undefined}
            className="w-full flex items-center px-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">Cerrar sesión</span>}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-slate-950">

        {/* ── Overview ── */}
        {page === "overview" && (
          <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">Panel de administración</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visión global de todos los clientes en ControlTrack</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Clientes activos", val: activeTenants,  icon: Activity,  color: "emerald" },
                { label: "Clientes totales", val: tenants.length, icon: Building2, color: "sky"     },
                { label: "Usuarios totales", val: totalUsers,     icon: Users,     color: "violet"  },
              ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 text-${color}-400`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">{loading ? "…" : val}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tenant list */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Clientes registrados</h3>
              <button onClick={() => setPage("tenants")} className="text-xs text-sky-400 hover:text-sky-300">
                Gestionar →
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {tenants.map(t => (
                  <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.active ? "bg-emerald-400" : "bg-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{t.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-slate-500 font-mono truncate max-w-[180px]">Key: {t.ft_apikey}</p>
                        <p className="text-xs text-slate-600">{t.user_count ?? 0} usuario{t.user_count !== 1 ? "s" : ""}</p>
                        {t.created_at && (
                          <p className="text-xs text-slate-600">Alta: {new Date(t.created_at).toLocaleDateString("es-MX")}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
                      t.active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-700 text-slate-400 border-slate-600"
                    }`}>{t.active ? "Activo" : "Inactivo"}</span>
                    <button
                      onClick={() => setImpersonating(t)}
                      disabled={!t.active}
                      title="Ver el dashboard de este cliente"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver dashboard
                    </button>
                  </div>
                ))}
                {tenants.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Aún no hay clientes.{" "}
                      <button onClick={() => setPage("tenants")} className="text-sky-400 underline">
                        Crear el primero
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {page === "tenants"  && <TenantsPage />}
        {page === "users"    && <UsersPage isSuperAdmin={true} sessionTenantId={null} />}
        {/* session pasada para que WhatsAppPage muestre card de config solo al superadmin */}
        {page === "whatsapp" && <WhatsAppPage session={session} />}
      </main>
    </div>
  );
}
