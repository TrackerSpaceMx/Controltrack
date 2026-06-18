import React, { useState } from "react";
import { X, Download, FileText, Table, File } from "lucide-react";
import { api, CONTRACT_OPTIONS } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: "",            label: "Todos"           },
  { value: "active",      label: "Activos"         },
  { value: "expiring",    label: "Por vencer"      },
  { value: "expired",     label: "Vencidos"        },
  { value: "deactivated", label: "Desactivados"    },
];

const EXPIRY_OPTIONS = [
  { value: "",   label: "Sin filtro"     },
  { value: "7",  label: "Próximos 7 días" },
  { value: "15", label: "Próximos 15 días"},
  { value: "30", label: "Próximos 30 días"},
  { value: "60", label: "Próximos 60 días"},
];

type Format = "csv" | "xlsx" | "pdf";

const FORMAT_CONFIG: Record<Format, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  csv: {
    label: "CSV",
    icon: <FileText className="w-5 h-5" />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    desc: "Compatible con Excel, Google Sheets",
  },
  xlsx: {
    label: "Excel",
    icon: <Table className="w-5 h-5" />,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    desc: "Formato nativo de Microsoft Excel",
  },
  pdf: {
    label: "PDF",
    icon: <File className="w-5 h-5" />,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    desc: "Reporte listo para imprimir",
  },
};

export function ExportModal({ isOpen, onClose }: Props) {
  const [format,       setFormat]       = useState<Format>("xlsx");
  const [statusFilter, setStatusFilter] = useState("");
  const [contractType, setContractType] = useState("");
  const [expiringDays, setExpiringDays] = useState("");
  const [expireFrom,   setExpireFrom]   = useState("");
  const [expireTo,     setExpireTo]     = useState("");

  if (!isOpen) return null;

  const handleExport = () => {
    const url = api.getExportUrl({
      format,
      status_filter:        statusFilter     || undefined,
      contract_type_filter: contractType     || undefined,
      expiring_days:        expiringDays     ? Number(expiringDays) : undefined,
      expire_from:          expireFrom       || undefined,
      expire_to:            expireTo         || undefined,
    });
    window.open(url, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-sky-400" />
            Exportar datos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Formato */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Formato</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(FORMAT_CONFIG) as [Format, typeof FORMAT_CONFIG[Format]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    format === key
                      ? `${cfg.color} ring-1 ring-current`
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {cfg.icon}
                  <span className="text-xs font-semibold">{cfg.label}</span>
                  <span className="text-[10px] text-center leading-tight opacity-70">{cfg.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por estado */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Estado de los dispositivos</label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`py-1.5 px-2 text-xs rounded-lg border transition-colors ${
                    statusFilter === opt.value
                      ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro tipo contrato */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Tipo de contratación</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setContractType("")}
                className={`py-1.5 text-xs rounded-lg border transition-colors ${
                  contractType === ""
                    ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >Todos</button>
              {CONTRACT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setContractType(opt.value)}
                  className={`py-1.5 text-xs rounded-lg border transition-colors ${
                    contractType === opt.value
                      ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro vencimiento rápido */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Vencimiento</label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setExpiringDays(opt.value); setExpireFrom(""); setExpireTo(""); }}
                  className={`py-1.5 text-xs rounded-lg border transition-colors ${
                    expiringDays === opt.value && !expireFrom
                      ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-0.5">Desde</label>
                <input
                  type="date"
                  value={expireFrom}
                  onChange={e => { setExpireFrom(e.target.value); setExpiringDays(""); }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-0.5">Hasta</label>
                <input
                  type="date"
                  value={expireTo}
                  onChange={e => { setExpireTo(e.target.value); setExpiringDays(""); }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar {FORMAT_CONFIG[format].label}
          </button>
        </div>
      </div>
    </div>
  );
}
