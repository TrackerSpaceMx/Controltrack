import React, { useEffect, useState } from "react";
import { X, Power, Calendar, Loader2, Settings, FileText, MessageCircle, Phone } from "lucide-react";
import { api, adminApi, DeviceRecord } from "../api";
import { StatusBadge } from "./Badge";
import { ClientConfigModal } from "./ClientConfigModal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";

interface ClientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  onRenewDevice: (device: DeviceRecord) => void;
  onToggleDevice: (device: DeviceRecord, deactivate: boolean) => Promise<void>;
  onRefresh: () => void;
}

export function ClientDrawer({ isOpen, onClose, clientId, onRenewDevice, onToggleDevice, onRefresh }: ClientDrawerProps) {
  const [devices,        setDevices]        = useState<DeviceRecord[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [togglingClient, setTogglingClient] = useState(false);
  const [togglingDevice, setTogglingDevice] = useState<number | null>(null);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [isConfigOpen,   setIsConfigOpen]   = useState(false);
  const [isInvoiceOpen,  setIsInvoiceOpen]  = useState(false);
  const [waNumber,       setWaNumber]       = useState("");
  const [waSending,      setWaSending]      = useState(false);
  const [waMsg,          setWaMsg]          = useState("");

  useEffect(() => {
    if (!isOpen || !clientId) return;
    setLoading(true);
    setErrorMsg("");
    api.getClientDevices(clientId)
      .then(setDevices)
      .catch(e => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const clientName     = devices[0]?.client_name ?? `Cliente ${clientId}`;
  const allDeactivated = devices.length > 0 && devices.every(d => d.status === "deactivated");
  const accountActive  = !allDeactivated;

  const handleAccountToggle = async () => {
    if (!clientId) return;
    setTogglingClient(true); setErrorMsg("");
    try {
      const deactivate = accountActive;
      await api.toggleClient(clientId, deactivate);
      const newStatus = deactivate ? "deactivated" : "active";
      setDevices(prev => prev.map(d => ({ ...d, status: newStatus as any })));
      onRefresh();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error al cambiar estado de la cuenta");
    } finally { setTogglingClient(false); }
  };

  const handleDeviceToggle = async (device: DeviceRecord) => {
    setTogglingDevice(device.id); setErrorMsg("");
    try {
      const deactivate = device.status !== "deactivated";
      await onToggleDevice(device, deactivate);
      const newStatus = deactivate ? "deactivated" : "active";
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: newStatus as any } : d));
      onRefresh();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error al cambiar estado del dispositivo");
    } finally { setTogglingDevice(null); }
  };

  const handleSendWhatsApp = async () => {
    if (!waNumber.trim() || devices.length === 0) return;
    setWaSending(true); setWaMsg("");
    try {
      const ids = devices.filter(d => d.status !== "deactivated").map(d => d.id);
      const res = await adminApi.sendWhatsApp(ids, waNumber.trim());
      setWaMsg(`✅ Mensaje enviado a ${res.sent} dispositivo${res.sent !== 1 ? "s" : ""}`);
    } catch (e: any) {
      setWaMsg(`❌ ${e.message}`);
    } finally { setWaSending(false); }
  };

  // Revenue summary
  const totalRevenue = devices
    .filter(d => d.status !== "deactivated" && d.monthly_price != null)
    .reduce((sum, d) => sum + (d.monthly_price ?? 0), 0);

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Detalle de Cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Client info + actions */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-4">{clientName}</h3>

            {/* Revenue summary (if any device has price) */}
            {totalRevenue > 0 && (
              <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-400 font-medium">Facturación mensual estimada</p>
                  <p className="text-lg font-bold text-white">
                    ${totalRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </p>
                </div>
                <button
                  onClick={() => setIsInvoiceOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Pre-factura
                </button>
              </div>
            )}

            {/* Account toggle */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-white">Estado de la cuenta</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {accountActive ? "Desactiva todos los dispositivos" : "Activa la cuenta del cliente"}
                </p>
              </div>
              <button
                onClick={handleAccountToggle}
                disabled={togglingClient || loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  accountActive ? "bg-sky-500" : "bg-slate-700"
                }`}
              >
                {togglingClient
                  ? <Loader2 className="w-3 h-3 text-white animate-spin mx-auto" />
                  : <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${accountActive ? "translate-x-6" : "translate-x-1"}`} />
                }
              </button>
            </div>

            {/* Config button */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors mb-3"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Configurar carencia y auto-desactivación
            </button>

            {/* WhatsApp send */}
            <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/20">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-3">
                <MessageCircle className="w-3.5 h-3.5" /> Enviar recordatorio por WhatsApp
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="tel"
                    value={waNumber}
                    onChange={e => setWaNumber(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={waSending || !waNumber.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {waSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  Enviar
                </button>
              </div>
              {waMsg && (
                <p className={`mt-2 text-xs ${waMsg.startsWith("✅") ? "text-emerald-400" : "text-rose-400"}`}>{waMsg}</p>
              )}
            </div>
          </div>

          {/* Device list */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Dispositivos GPS {!loading && `(${devices.length})`}
            </h4>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map(device => (
                  <div key={device.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-white text-sm">{device.device_name ?? device.plate ?? "Sin nombre"}</div>
                      <StatusBadge status={device.status as any} />
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5 mb-3">
                      <p>IMEI: <span className="text-slate-300 font-mono">{device.imei}</span></p>
                      {device.model && <p>Modelo: <span className="text-slate-300">{device.model}</span></p>}
                      {device.contract_type && <p>Contrato: <span className="text-slate-300">{
                        { monthly: "Mensual", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual", lease: "Arrendamiento" }[device.contract_type] ?? device.contract_type
                      }</span></p>}
                      {device.seller_name && <p>Vendedor: <span className="text-slate-300">{device.seller_name}</span></p>}
                      {device.monthly_price != null && (
                        <p>Precio: <span className="text-emerald-400 font-medium">${device.monthly_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN/mes</span></p>
                      )}
                      <p>Vence: <span className="text-slate-300">
                        {device.expiration_date
                          ? new Date(device.expiration_date + "T12:00:00").toLocaleDateString("es-MX")
                          : "Sin fecha"}
                      </span></p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onRenewDevice(device)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        Renovar
                      </button>
                      <button
                        onClick={() => handleDeviceToggle(device)}
                        disabled={togglingDevice === device.id}
                        title={device.status === "deactivated" ? "Activar GPS" : "Desinstalar GPS de Fulltrack"}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          device.status === "deactivated"
                            ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                        }`}
                      >
                        {togglingDevice === device.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Power className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClientConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        clientId={clientId}
        clientName={clientName}
      />

      {clientId && (
        <InvoicePreviewModal
          isOpen={isInvoiceOpen}
          onClose={() => setIsInvoiceOpen(false)}
          clientId={clientId}
          clientName={clientName}
        />
      )}
    </>
  );
}
