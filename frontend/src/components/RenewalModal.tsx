import React, { useState } from "react";
import { X, Calendar, CheckCircle } from "lucide-react";
import { DeviceRecord } from "../api";

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceRecord | null;
  onConfirm: (deviceId: number, newDate: string) => Promise<void>;
}

export function RenewalModal({ isOpen, onClose, device, onConfirm }: RenewalModalProps) {
  const [newDate, setNewDate]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    setLoading(true);
    try {
      await onConfirm(device.id, newDate);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setNewDate(""); onClose(); }, 1800);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Renovar Suscripción</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <p className="text-white font-medium">¡Suscripción renovada!</p>
            <p className="text-slate-400 text-sm">Nueva fecha: {new Date(newDate + "T12:00:00").toLocaleDateString("es-MX")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Cliente</label>
                <div className="text-white font-medium">{device.client_name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Dispositivo</label>
                <div className="text-white">{device.device_name ?? device.plate ?? device.imei}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">IMEI</label>
                <div className="text-slate-300 font-mono text-sm">{device.imei}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Vencimiento actual</label>
                <div className="text-slate-300">
                  {device.expiration_date
                    ? new Date(device.expiration_date + "T12:00:00").toLocaleDateString("es-MX")
                    : "Sin fecha asignada"}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Nueva fecha de vencimiento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent sm:text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newDate || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Guardando…" : "Confirmar renovación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
