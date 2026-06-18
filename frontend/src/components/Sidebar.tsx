import React from "react";
import {
  LayoutDashboard, LogOut, MapPin, ChevronLeft, ChevronRight,
  Building2, Users, MessageCircle, ShieldCheck,
} from "lucide-react";

export type SidebarPage = "dashboard" | "tenants" | "users" | "whatsapp";

interface SidebarProps {
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  isSuperAdmin: boolean;
}

const NAV_ITEMS: {
  id: SidebarPage;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
}[] = [
  { id: "dashboard", label: "Dashboard",  icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
  { id: "tenants",   label: "Clientes",   icon: <Building2        className="w-5 h-5 shrink-0" />, superAdminOnly: true },
  { id: "users",     label: "Usuarios",   icon: <Users            className="w-5 h-5 shrink-0" /> },
  { id: "whatsapp",  label: "WhatsApp",   icon: <MessageCircle    className="w-5 h-5 shrink-0" /> },
];

export function Sidebar({ onLogout, collapsed, onToggle, activePage, onNavigate, isSuperAdmin }: SidebarProps) {
  const visible = NAV_ITEMS.filter(item => !item.superAdminOnly || isSuperAdmin);

  return (
    <div className={`flex flex-col bg-slate-950 border-r border-slate-800 h-screen transition-all duration-300 ${collapsed ? "w-14" : "w-52"}`}>

      {/* Logo + toggle */}
      <div className={`flex items-center h-14 border-b border-slate-800 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <MapPin className="w-5 h-5 text-sky-500 shrink-0" />
            <span className="text-base font-bold text-white tracking-tight truncate">ControlTrack</span>
          </div>
        )}
        {collapsed && <MapPin className="w-5 h-5 text-sky-500" />}
        <button
          onClick={onToggle}
          className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Super-admin badge */}
      {isSuperAdmin && !collapsed && (
        <div className="mx-3 mt-3 px-2 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[11px] font-semibold text-violet-400 truncate">Super Admin</span>
        </div>
      )}

      {/* Nav items */}
      <div className="flex-1 py-4 px-2 space-y-1">
        {visible.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-sky-500/10 text-sky-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {item.icon}
              {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-2 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center px-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="ml-2.5 font-medium text-sm truncate">Cerrar sesión</span>}
        </button>
      </div>
    </div>
  );
}
