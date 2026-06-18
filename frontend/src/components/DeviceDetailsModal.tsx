import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Loader2, ChevronDown } from "lucide-react";
import { api, DeviceRecord, CONTRACT_OPTIONS, CONTRACT_LABELS, CustomField } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceRecord | null;
  onSaved: (updated: DeviceRecord) => void;
}

const FIELD_TYPES = [
  { value: "text",   label: "Texto"  },
  { value: "number", label: "Número" },
  { value: "date",   label: "Fecha"  },
];

export function DeviceDetailsModal({ isOpen, onClose, device, onSaved }: Props) {
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [contractType,   setContractType]   = useState<string>("");
  const [sellerName,     setSellerName]     = useState("");
  const [installerName,  setInstallerName]  = useState("");
  const [installDate,    setInstallDate]    = useState("");
  const [monthlyPrice,   setMonthlyPrice]   = useState("");
  const [rfc,            setRfc]            = useState("");
  const [autoCompute,    setAutoCompute]    = useState(false);

  // Custom fields
  const [customFields,   setCustomFields]   = useState<CustomField[]>([]);
  const [newFieldLabel,  setNewFieldLabel]  = useState("");
  const [newFieldType,   setNewFieldType]   = useState<"text"|"number"|"date">("text");
  const [savingField,    setSavingField]    = useState(false);

  useEffect(() => {
    if (!device || !isOpen) return;
    setContractType(device.contract_type   ?? "");
    setSellerName(  device.seller_name     ?? "");
    setInstallerName(device.installer_name ?? "");
    setInstallDate( device.install_date    ?? "");
    setMonthlyPrice(device.monthly_price   != null ? String(device.monthly_price) : "");
    setRfc(         device.rfc             ?? "");
    setAutoCompute(false);
    setCustomFields(device.custom_fields   ?? []);
    setError("");
    setSuccess(false);
  }, [device, isOpen]);

  if (!isOpen || !device) return null;

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await api.updateDeviceDetails(device.id, {
        contract_type:           contractType   || undefined,
        seller_name:             sellerName     || undefined,
        installer_name:          installerName  || undefined,
        install_date:            installDate    || undefined,
        monthly_price:           monthlyPrice   ? parseFloat(monthlyPrice) : undefined,
        rfc:                     rfc            || undefined,
        auto_compute_expiration: autoCompute,
      });
      setSuccess(true);
      onSaved(res.device);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = async () => {
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    setSavingField(true);
    try {
      await api.upsertCustomField(device.id, {
        field_key:   key,
        field_label: newFieldLabel,
        field_type:  newFieldType,
        field_value: null,
      });
      setCustomFields(prev => [...prev.filter(f => f.field_key !== key), {
        field_key: key, field_label: newFieldLabel, field_type: newFieldType, field_value: ""
      }]);
      setNewFieldLabel(""); setNewFieldType("text");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingField(false);
    }
  };

  const handleUpdateCustomField = async (field: CustomField, newValue: string) => {
    const updated = { ...field, field_value: newValue };
    setCustomFields(prev => prev.map(f => f.field_key === field.field_key ? updated : f));
    await api.upsertCustomField(device.id, updated).catch(() => {});
  };

  const handleDeleteCustomField = async (key: string) => {
    setCustomFields(prev => prev.filter(f => f.field_key !== key));
    await api.deleteCustomField(device.id, key).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white">Datos del dispositivo</h3>
            <p className="text-xs text-slate-400 mt-0.5">{device.device_name ?? device.plate ?? device.imei}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Tipo de contratación */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Tipo de contratación</label>
            <div className="relative">
              <select
                value={contractType}
                onChange={e => setContractType(e.target.value)}
                className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-8"
              >
                <option value="">— Sin asignar —</option>
                {CONTRACT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
            {contractType && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autocompute"
                  checked={autoCompute}
                  onChange={e => setAutoCompute(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="autocompute" className="text-xs text-slate-400 cursor-pointer">
                  Calcular fecha de vencimiento automáticamente a partir de la fecha de instalación
                </label>
              </div>
            )}
          </div>

          {/* Precio mensual */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Precio mensual (MXN)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyPrice}
              onChange={e => setMonthlyPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Vendedor */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Vendedor</label>
            <input
              type="text"
              value={sellerName}
              onChange={e => setSellerName(e.target.value)}
              placeholder="Nombre del vendedor"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Instalador + fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Instalador</label>
              <input
                type="text"
                value={installerName}
                onChange={e => setInstallerName(e.target.value)}
                placeholder="Nombre del instalador"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Fecha de instalación</label>
              <input
                type="date"
                value={installDate}
                onChange={e => setInstallDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
          </div>

          {/* RFC */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">RFC del cliente</label>
            <input
              type="text"
              value={rfc}
              onChange={e => setRfc(e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
              maxLength={13}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Campos personalizados */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Campos personalizados</p>

            {customFields.length > 0 && (
              <div className="space-y-2 mb-3">
                {customFields.map(field => (
                  <div key={field.field_key} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-28 truncate shrink-0">{field.field_label}</span>
                    <input
                      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                      value={field.field_value ?? ""}
                      onChange={e => handleUpdateCustomField(field, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 [color-scheme:dark]"
                    />
                    <button
                      onClick={() => handleDeleteCustomField(field.field_key)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar campo nuevo */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={newFieldLabel}
                onChange={e => setNewFieldLabel(e.target.value)}
                placeholder="Nombre del campo"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button
                onClick={handleAddCustomField}
                disabled={savingField || !newFieldLabel.trim()}
                className="p-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors disabled:opacity-40"
              >
                {savingField ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors"
          >
            {saving   ? <Loader2 className="w-4 h-4 animate-spin" /> :
             success  ? "✓ Guardado" :
             <><Save className="w-4 h-4" /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
