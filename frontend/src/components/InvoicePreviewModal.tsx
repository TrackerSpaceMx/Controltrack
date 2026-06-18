import React, { useEffect, useState } from "react";
import { X, Loader2, FileText, Download } from "lucide-react";
import { api, InvoicePreview, CONTRACT_LABELS } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

const STATUS_LABEL: Record<string, string> = {
  active:      "Activo",
  expiring:    "Por vencer",
  expired:     "Vencido",
  deactivated: "Desactivado",
};

export function InvoicePreviewModal({ isOpen, onClose, clientId, clientName }: Props) {
  const [data,    setData]    = useState<InvoicePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!isOpen || !clientId) return;
    setLoading(true); setError("");
    api.getInvoicePreview(clientId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Pre-factura</h3>
              <p className="text-xs text-slate-400">{clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Meta */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Fecha de emisión</p>
                  <p className="text-sm text-white font-medium">
                    {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-0.5">Total de unidades</p>
                  <p className="text-sm text-white font-medium">{data.total_devices} dispositivos activos</p>
                </div>
              </div>

              {/* Items table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden mb-6">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800/60">
                    <tr>
                      {["Vehículo / Placa", "IMEI", "Tipo contrato", "Estado", "Vencimiento", "Precio/mes"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-slate-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.items.map((item, i) => (
                      <tr key={item.device_id} className={i % 2 === 0 ? "" : "bg-slate-800/20"}>
                        <td className="px-3 py-2 text-white font-medium">
                          {item.device_name ?? item.plate ?? item.imei}
                          {item.plate && item.device_name && (
                            <span className="ml-1 text-slate-500 font-normal">({item.plate})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">{item.imei}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {item.contract_type ? CONTRACT_LABELS[item.contract_type] ?? item.contract_type : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            item.status === "active"      ? "bg-emerald-500/10 text-emerald-400" :
                            item.status === "expiring"    ? "bg-amber-500/10 text-amber-400" :
                            item.status === "expired"     ? "bg-rose-500/10 text-rose-400" :
                            "bg-slate-500/10 text-slate-400"
                          }`}>
                            {STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {item.expiration_date
                            ? new Date(item.expiration_date + "T12:00:00").toLocaleDateString("es-MX")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-white">
                          {item.monthly_price > 0
                            ? `$${item.monthly_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                            : <span className="text-slate-600 font-normal">Sin precio</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotals by contract type */}
              {Object.keys(data.subtotal_by_type).length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Desglose por tipo de contrato</p>
                  <div className="space-y-1.5">
                    {Object.entries(data.subtotal_by_type).map(([type, amount]) => (
                      <div key={type} className="flex justify-between items-center text-sm">
                        <span className="text-slate-300">
                          {CONTRACT_LABELS[type] ?? type}
                        </span>
                        <span className="font-medium text-white tabular-nums">
                          ${(amount as number).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total mensual estimado</p>
                  <p className="text-xs text-slate-600 mt-0.5">Solo incluye unidades activas con precio configurado</p>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  ${data.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  <span className="text-sm font-normal text-slate-400 ml-1">MXN</span>
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
