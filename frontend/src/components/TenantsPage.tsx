import React, { useState, useEffect } from "react";
import { adminApi, Tenant } from "../api";
import { Plus, Edit2, Trash2, RefreshCw, Loader2, Building2, X, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [syncing, setSyncing] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<Tenant | null>(null);
  const [form, setForm] = useState({ name: "", ft_apikey: "", ft_secretkey: "", active: true });
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try { setTenants(await adminApi.getTenants()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", ft_apikey: "", ft_secretkey: "", active: true });
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setForm({ name: t.name, ft_apikey: t.ft_apikey, ft_secretkey: t.ft_secretkey, active: t.active });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateTenant(editing.id, form);
      } else {
        await adminApi.createTenant(form);
      }
      setShowModal(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`¿Eliminar el cliente "${t.name}"? Se eliminarán también sus usuarios.`)) return;
    try { await adminApi.deleteTenant(t.id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleSync = async (t: Tenant) => {
    setSyncing(t.id);
    try {
      const res = await adminApi.syncTenant(t.id);
      alert(`✅ Sincronizado: ${res.synced} dispositivos de ${t.name}`);
    } catch (e: any) { alert(`❌ Error: ${e.message}`); }
    finally { setSyncing(null); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-400" /> Clientes (Tenants)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Empresas de rastreo que usan ControlTrack</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : (
        <div className="space-y-3">
          {tenants.map(t => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full shrink-0 ${t.active ? "bg-emerald-400" : "bg-slate-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{t.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                    t.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400 border-slate-600"
                  }`}>{t.active ? "Activo" : "Inactivo"}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]">Key: {t.ft_apikey}</p>
                  <p className="text-xs text-slate-600">{t.user_count ?? 0} usuario{t.user_count !== 1 ? "s" : ""}</p>
                  {t.created_at && <p className="text-xs text-slate-600">Alta: {new Date(t.created_at).toLocaleDateString("es-MX")}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleSync(t)} disabled={syncing === t.id}
                  className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-50" title="Sincronizar Fulltrack">
                  {syncing === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-violet-400 hover:bg-violet-500/10 transition-colors" title="Editar">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aún no hay clientes. Crea el primero.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Editar cliente" : "Nuevo cliente"} onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nombre de la empresa</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Rastreo CDMX S.A."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">API Key de Fulltrack</label>
              <input value={form.ft_apikey} onChange={e => setForm(f => ({ ...f, ft_apikey: e.target.value }))}
                placeholder="apiKey..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Secret Key de Fulltrack</label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={form.ft_secretkey}
                  onChange={e => setForm(f => ({ ...f, ft_secretkey: e.target.value }))}
                  placeholder="secretKey..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <button type="button" onClick={() => setShowSecret(v => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-300">Estado de la cuenta</span>
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? "bg-sky-500" : "bg-slate-700"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.ft_apikey || !form.ft_secretkey}
              className="px-4 py-2 text-sm text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors">
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
