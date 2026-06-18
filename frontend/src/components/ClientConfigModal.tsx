import React, { useState, useEffect } from "react";
import { X, Loader2, Shield, Clock, MessageCircle, Trash2, Phone } from "lucide-react";
import { api, ClientConfig } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  clientName: string;
}

export function ClientConfigModal({ isOpen, onClose, clientId, clientName }: Props) {
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState(false);
  const [graceDays,      setGraceDays]      = useState(0);
  const [autoDeactivate, setAutoDeactivate] = useState(true);
  const [waNumber,       setWaNumber]       = useState<string>("");
  const [waEditing,      setWaEditing]      = useState(false);
  const [waDraft,        setWaDraft]        = useState("");
  const [waDeleting,     setWaDeleting]     = useState(false);

  // Reset y recarga cada vez que el modal se abre, sin importar si clientId cambió
  useEffect(() => {
    if (!isOpen || !clientId) {
      // Reset al cerrar
      setError("");
      setWaEditing(false);
      setWaNumber("");
      setWaDraft("");
      setSuccess(false);
      return;
    }

    setLoading(true);
    setError("");
    setWaEditing(false);

    api.getClientConfig(clientId)
      .then(cfg => {
        setGraceDays(cfg.grace_days);
        setAutoDeactivate(cfg.auto_deactivate);
        const wa = (cfg as any).whatsapp_number ?? "";
        setWaNumber(wa);
        setWaDraft(wa);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, clientId]);  // se ejecuta cada vez que isOpen cambia a true

  if (!isOpen || !clientId) return null;

  const handleClose = () => {
    setWaEditing(false);
    setError("");
    onClose();
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await api.updateClientConfig(clientId, {
        grace_days:      graceDays,
        auto_deactivate: autoDeactivate,
        client_name:     clientName,
      } as any);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); handleClose(); }, 1200);
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleWaSave = async () => {
    const trimmed = waDraft.trim();
    setSaving(true); setError("");
    try {
      await api.updateClientConfig(clientId, { whatsapp_number: trimmed || null } as any);
      setWaNumber(trimmed);
      setWaDraft(trimmed);
      setWaEditing(false);
    } catch (e: any) {
      setError(e.message ?? "Error al guardar número");
    } finally {
      setSaving(false);
    }
  };

  const handleWaDelete = async () => {
    setWaDeleting(true); setError("");
    try {
      await api.updateClientConfig(clientId, { whatsapp_number: null } as any);
      setWaNumber("");
      setWaDraft("");
      setWaEditing(false);
    } catch (e: any) {
      setError(e.message ?? "Error al eliminar número");
    } finally {
      setWaDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Configuración de cuenta</h3>
            <p className="text-xs text-slate-400 mt-0.5">{clientName}</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          ) : (
            <>
              {/* Auto-desactivación */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Desactivación automática</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        Desactiva los GPS automáticamente al vencer (respetando los días de carencia)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoDeactivate(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 mt-1 ${
                      autoDeactivate ? "bg-sky-500" : "bg-slate-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoDeactivate ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Días de carencia */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Días de carencia</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Días extra después del vencimiento antes de desactivar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={60} step={1} value={graceDays}
                    onChange={e => setGraceDays(Number(e.target.value))}
                    disabled={!autoDeactivate}
                    className="flex-1 accent-sky-500 disabled:opacity-40"
                  />
                  <div className="flex items-center gap-1 min-w-[80px]">
                    <input
                      type="number" min={0} max={365} value={graceDays}
                      onChange={e => setGraceDays(Math.max(0, Number(e.target.value)))}
                      disabled={!autoDeactivate}
                      className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-40"
                    />
                    <span className="text-xs text-slate-400">días</span>
                  </div>
                </div>
                {graceDays > 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    Los GPS se desactivarán {graceDays} día{graceDays !== 1 ? "s" : ""} después de la fecha de vencimiento
                  </p>
                )}
                {graceDays === 0 && autoDeactivate && (
                  <p className="text-xs text-slate-500 mt-2">
                    Los GPS se desactivarán el mismo día del vencimiento
                  </p>
                )}
              </div>

              {/* WhatsApp */}
              <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/20">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Número WhatsApp</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Se usará para enviar recordatorios automáticos de renovación
                    </p>
                  </div>
                </div>

                {/* Sin número y no editando */}
                {!waNumber && !waEditing && (
                  <button
                    onClick={() => { setWaDraft(""); setWaEditing(true); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 border-dashed rounded-lg text-xs text-emerald-400 font-medium transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Agregar número
                  </button>
                )}

                {/* Número guardado — vista */}
                {waNumber && !waEditing && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-sm text-white font-mono">{waNumber}</span>
                    </div>
                    <button
                      onClick={() => { setWaDraft(waNumber); setWaEditing(true); }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={handleWaDelete}
                      disabled={waDeleting}
                      title="Eliminar número"
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-rose-400 transition-colors disabled:opacity-50"
                    >
                      {waDeleting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                )}

                {/* Formulario edición / creación */}
                {waEditing && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="tel"
                        value={waDraft}
                        onChange={e => setWaDraft(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        autoFocus
                        className="w-full bg-slate-800 border border-emerald-500/40 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Incluye código de país. Ej: +52 para México, +1 para USA
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setWaDraft(waNumber); setWaEditing(false); }}
                        className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleWaSave}
                        disabled={saving || !waDraft.trim()}
                        className="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50"
                      >
                        {saving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                          : "Guardar número"
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : success ? "✓ Guardado" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
