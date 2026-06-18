import React, { useState } from "react";
import { SessionInfo } from "../api";
import { Dashboard }    from "./Dashboard";
import { UsersPage }    from "../components/UsersPage";
import { WhatsAppPage } from "../components/WhatsAppPage";
import {
  MapPin, LogOut, LayoutDashboard, Users,
  MessageCircle, ChevronLeft, ChevronRight, Activity,
} from "lucide-react";

type Page = "dashboard" | "users" | "whatsapp" | "monitoring";

interface Props {
  session: SessionInfo;
  onLogout: () => void;
  hideSidebar?: boolean;
}

export function TenantApp({ session, onLogout, hideSidebar = false }: Props) {
  const [page,      setPage]      = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(true);

  const canManageUsers = session.role === "admin";

  const NAV: { id: Page; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "dashboard",  label: "Dashboard",  icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { id: "monitoring", label: "Monitoreo",  icon: <Activity        className="w-5 h-5 shrink-0" /> },
    { id: "users",      label: "Usuarios",   icon: <Users           className="w-5 h-5 shrink-0" />, adminOnly: true },
    { id: "whatsapp",   label: "WhatsApp",   icon: <MessageCircle   className="w-5 h-5 shrink-0" /> },
  ];

  const visible = NAV.filter(item => !item.adminOnly || canManageUsers);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">

      {!hideSidebar && (
        <div className={`flex flex-col flex-shrink-0 bg-slate-950 border-r border-slate-800 h-full transition-all duration-300 ${collapsed ? "w-14" : "w-52"}`}>
          <div className={`flex items-center h-14 border-b border-slate-800 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed && (
              <div className="flex items-center gap-2 overflow-hidden">
                <MapPin className="w-5 h-5 text-sky-500 shrink-0" />
                <span className="text-base font-bold text-white tracking-tight truncate">ControlTrack</span>
              </div>
            )}
            {collapsed && <MapPin className="w-5 h-5 text-sky-500" />}
            <button
              onClick={() => setCollapsed(v => !v)}
              className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed && session.tenant_name && (
            <div className="mx-3 mt-3 px-2 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg">
              <p className="text-[11px] font-semibold text-sky-400 truncate">{session.tenant_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{session.username}</p>
            </div>
          )}

          <div className="flex-1 py-4 px-2 space-y-1">
            {visible.map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors ${
                  page === item.id
                    ? "bg-sky-500/10 text-sky-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {item.icon}
                {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">{item.label}</span>}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-slate-800">
            <button
              onClick={onLogout}
              title={collapsed ? "Cerrar sesión" : undefined}
              className="w-full flex items-center px-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">Cerrar sesión</span>}
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {page === "dashboard" && (
          <Dashboard onLogout={onLogout} session={session} />
        )}

        {page === "monitoring" && (
          <div className="flex-1 overflow-auto bg-slate-950 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-sky-400" />
              <h2 className="text-xl font-bold text-white">Monitoreo</h2>
            </div>
            <p className="text-xs text-slate-500">Próximamente — aquí irá el módulo de monitoreo en tiempo real.</p>
          </div>
        )}

        {page === "users" && canManageUsers && (
          <div className="flex-1 overflow-auto bg-slate-950">
            <UsersPage isSuperAdmin={false} sessionTenantId={session.tenant_id} />
          </div>
        )}

        {page === "whatsapp" && (
          <div className="flex-1 overflow-auto bg-slate-950">
            <WhatsAppPage session={session} />
          </div>
        )}
      </div>
    </div>
  );
}
