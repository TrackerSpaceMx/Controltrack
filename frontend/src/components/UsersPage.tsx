import React, { useState, useEffect } from "react";
import { adminApi, AppUser, Tenant } from "../api";
import { Plus, Edit2, Trash2, Loader2, Users, X, Eye, EyeOff } from "lucide-react";

const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  admin:    { label: "Admin",     cls: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  operator: { label: "Operador",  cls: "bg-sky-500/10    text-sky-400    border-sky-500/30"    },
  viewer:   { label: "Solo vista",cls: "bg-slate-700     text-slate-400  border-slate-600"      },
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface Props {
  isSuperAdmin: boolean;
  sessionTenantId: number | null;
}

export function UsersPage({ isSuperAdmin, sessionTenantId }: Props) {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filterTenant, setFilterTenant] = useState<number | "">(""); 

  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<AppUser | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [showPwd,   setShowPwd]   = useState(false);

  const [form, setForm] = useState({
    tenant_id: sessionTenantId ?? 0,
    username: "", password: "", full_name: "", role: "operator", active: true,
  });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [u, t] = await Promise.all([
        adminApi.getUsers(isSuperAdmin ? (filterTenant || undefined) : sessionTenantId ?? undefined),
        isSuperAdmin ? adminApi.getTenants() : Promise.resolve([]),
      ]);
      setUsers(u); setTenants(t);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterTenant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ tenant_id: sessionTenantId ?? (tenants[0]?.id ?? 0), username: "", password: "", full_name: "", role: "operator", active: true });
    setShowPwd(false); setShowModal(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ tenant_id: u.tenant_id, username: u.username, password: "", full_name: u.full_name ?? "", role: u.role, active: u.active });
    setShowPwd(false); setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const data: any = { full_name: form.full_name, role: form.role, active: form.active };
        if (form.password) data.password = form.password;
        await adminApi.updateUser(editing.id, data);
      } else {
        await adminApi.createUser({
          tenant_id: Number(form.tenant_id),
          username:  form.username,
          password:  form.password,
          full_name: form.full_name || undefined,
          role:      form.role,
        });
      }
      setShowModal(false); await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`¿Eliminar al usuario "${u.username}"?`)) return;
    try { await adminApi.deleteUser(u.id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const displayed = users.filter(u =>
    !filterTenant || u.tenant_id === Number(filterTenant)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> Usuarios
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestiona quién accede a ControlTrack</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {/* Filter by tenant (superadmin only) */}
      {isSuperAdmin && tenants.length > 0 && (
        <div className="mb-4">
          <select value={filterTenant} onChange={e => setFilterTenant(e.target.value === "" ? "" : Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500">
            <option value="">Todos los clientes</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                {["Usuario","Nombre","Empresa","Rol","Estado","Acciones"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayed.map(u => {
                const roleCfg = ROLE_CFG[u.role] ?? ROLE_CFG.viewer;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-white text-sm">{u.username}</td>
                    <td className="px-4 py-3 text-slate-300">{u.full_name || <span className="text-slate-600 italic">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.tenant_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleCfg.cls}`}>
                        {roleCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        u.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400 border-slate-600"
                      }`}>{u.active ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-violet-400 hover:bg-violet-500/10 transition-colors" title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Sin usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Editar usuario" : "Nuevo usuario"} onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            {/* Tenant selector (solo superadmin creando) */}
            {isSuperAdmin && !editing && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Empresa</label>
                <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nombre completo</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Juan Pérez"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Usuario</label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                disabled={!!editing} placeholder="usuario_empresa"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {editing ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
              </label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? "••••••••" : "Contraseña segura"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Rol</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(ROLE_CFG).map(([val, cfg]) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, role: val }))}
                    className={`py-2 text-xs rounded-lg border transition-colors font-medium ${
                      form.role === val ? cfg.cls + " ring-1 ring-current" : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}>{cfg.label}</button>
                ))}
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-300">Usuario activo</span>
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? "bg-sky-500" : "bg-slate-700"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || (!editing && (!form.username || !form.password))}
              className="px-4 py-2 text-sm text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear usuario"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
