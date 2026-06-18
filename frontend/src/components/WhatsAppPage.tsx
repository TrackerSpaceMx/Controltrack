import React, { useState, useEffect } from "react";
import { adminApi, WhatsAppHistoryRecord, SessionInfo } from "../api";
import { MessageCircle, Loader2, CheckCircle, XCircle, Clock, RefreshCw, Phone } from "lucide-react";

interface Props {
  session: SessionInfo;
}

export function WhatsAppPage({ session }: Props) {
  const [history, setHistory] = useState<WhatsAppHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setHistory(await adminApi.getWhatsAppHistory()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const STATUS_CFG: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    sent:    { icon: <CheckCircle className="w-3.5 h-3.5" />, cls: "text-emerald-400", label: "Enviado"   },
    failed:  { icon: <XCircle    className="w-3.5 h-3.5" />, cls: "text-rose-400",    label: "Fallido"   },
    pending: { icon: <Clock      className="w-3.5 h-3.5" />, cls: "text-amber-400",   label: "Pendiente" },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header — sin botón scheduler */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-emerald-400" /> WhatsApp
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Notificaciones automáticas de renovación vía Twilio</p>
      </div>

      {/* Info cards */}
      <div className={`mb-6 grid grid-cols-1 gap-4 ${session.is_superadmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>

        {session.is_superadmin && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Configuración</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Variables requeridas en <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.env</code>:<br/>
              <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-400 text-[10px]">TWILIO_ACCOUNT_SID</code><br/>
              <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-400 text-[10px]">TWILIO_AUTH_TOKEN</code><br/>
              <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-400 text-[10px]">TWILIO_WHATSAPP_FROM</code>
            </p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Envío automático</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Las notificaciones se envían automáticamente cuando faltan{" "}
            <strong className="text-slate-300">1 y 3 días</strong> para el vencimiento.<br/>
            Configura el número en cada cliente desde el botón{" "}
            <strong className="text-slate-300">Configurar carencia</strong>.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Envío manual</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Abre el detalle de un cliente, ingresa un número en el campo de WhatsApp
            y haz clic en <strong className="text-slate-300">Enviar</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* History */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-300">Historial de notificaciones</p>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                {["Fecha", "Cliente", "Vehículo", "Teléfono", "Días antes", "Estado"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {history.map(n => {
                const sc = STATUS_CFG[n.status] ?? STATUS_CFG.pending;
                return (
                  <tr key={n.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {n.sent_at ? new Date(n.sent_at).toLocaleString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{n.client_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{n.device_name || n.plate || `ID ${n.device_id}`}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        {n.phone_number?.replace("whatsapp:", "") || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {n.days_before != null ? `${n.days_before}d` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${sc.cls}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Sin notificaciones enviadas aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
