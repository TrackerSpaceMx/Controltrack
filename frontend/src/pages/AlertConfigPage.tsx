import React, { useState, useMemo } from "react";
import {
  ArrowLeft, Bell, Clock, MessageCircle, Mail, Save,
  CheckCircle, AlertTriangle, Info, Loader2, Radio, Search, X,
} from "lucide-react";
import { getAuthToken, api } from "../api";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://0.0.0.0:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertConfig {
  warning_minutes: number;       // minutos sin señal → Advertencia
  notification_minutes: number;  // minutos sin señal → enviar notificación
  notify_whatsapp: boolean;
  notify_email: boolean;
  email_address: string;
  whatsapp_number: string;
}

const DEFAULTS: AlertConfig = {
  warning_minutes: 15,
  notification_minutes: 60,
  notify_whatsapp: true,
  notify_email: false,
  email_address: "",
  whatsapp_number: "",
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

function minutesToLabel(m: number): string {
  if (m <= 0)   return "—";
  if (m < 60)   return `${m} min`;
  if (m < 1440) {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
  }
  const d = m / 1440;
  return Number.isInteger(d) ? `${d} día${d > 1 ? "s" : ""}` : `${d.toFixed(1)} días`;
}

// Presets shown as quick chips
const QUICK_OPTIONS = [
  { label: "5 min",  value: 5    },
  { label: "15 min", value: 15   },
  { label: "30 min", value: 30   },
  { label: "1 h",    value: 60   },
  { label: "2 h",    value: 120  },
  { label: "6 h",    value: 360  },
  { label: "12 h",   value: 720  },
  { label: "1 día",  value: 1440 },
];

// Unit options for the custom input
type TimeUnit = "minutes" | "hours" | "days";
const UNIT_OPTIONS: { value: TimeUnit; label: string; toMinutes: (n: number) => number; fromMinutes: (m: number) => number }[] = [
  { value: "minutes", label: "minutos", toMinutes: n => n,        fromMinutes: m => m       },
  { value: "hours",   label: "horas",   toMinutes: n => n * 60,   fromMinutes: m => m / 60  },
  { value: "days",    label: "días",    toMinutes: n => n * 1440, fromMinutes: m => m / 1440 },
];

function TimePicker({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  // Detect which unit fits the current value cleanly
  const defaultUnit = (): TimeUnit => {
    if (value >= 1440 && value % 1440 === 0) return "days";
    if (value >= 60   && value % 60   === 0) return "hours";
    return "minutes";
  };

  const [unit, setUnit]         = React.useState<TimeUnit>(defaultUnit);
  const [inputVal, setInputVal] = React.useState<string>(() => {
    const u = UNIT_OPTIONS.find(o => o.value === defaultUnit())!;
    return String(u.fromMinutes(value));
  });

  // When a preset chip is clicked, sync the raw input field
  const handlePreset = (minutes: number) => {
    const u = UNIT_OPTIONS.find(o => o.value === unit)!;
    const display = u.fromMinutes(minutes);
    setInputVal(Number.isInteger(display) ? String(display) : display.toFixed(2));
    onChange(minutes);
  };

  // When the user types in the input
  const handleInput = (raw: string) => {
    setInputVal(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      const u = UNIT_OPTIONS.find(o => o.value === unit)!;
      onChange(Math.round(u.toMinutes(n)));
    }
  };

  // When unit changes, convert the display value
  const handleUnit = (newUnit: TimeUnit) => {
    const oldU = UNIT_OPTIONS.find(o => o.value === unit)!;
    const newU = UNIT_OPTIONS.find(o => o.value === newUnit)!;
    const currentMinutes = Math.round(oldU.toMinutes(parseFloat(inputVal) || 0));
    const newDisplay = newU.fromMinutes(currentMinutes);
    setInputVal(Number.isInteger(newDisplay) ? String(newDisplay) : newDisplay.toFixed(2));
    setUnit(newUnit);
  };

  const isPreset = (minutes: number) => QUICK_OPTIONS.some(o => o.value === minutes);

  return (
    <div className="space-y-3">
      {/* Custom input + unit selector */}
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          step="1"
          value={inputVal}
          onChange={e => handleInput(e.target.value)}
          placeholder="Ej. 45"
          className={`flex-1 px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-colors ${
            error ? "border-rose-500" : !isPreset(value) && value > 0
              ? "border-sky-500/60"
              : "border-slate-700 focus:border-sky-500"
          }`}
        />
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          {UNIT_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => handleUnit(o.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                unit === o.value
                  ? "bg-sky-500/20 text-sky-300"
                  : "bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live summary */}
      {value > 0 && (
        <p className="text-[11px] text-slate-400">
          Equivale a{" "}
          <span className={`font-semibold ${!isPreset(value) ? "text-sky-400" : "text-slate-300"}`}>
            {minutesToLabel(value)}
          </span>
          {" "}({value} min)
        </p>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, description, icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 p-4 rounded-xl border text-left w-full transition-colors ${
        checked
          ? "bg-sky-500/10 border-sky-500/40"
          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
      }`}
    >
      <div className={`mt-0.5 shrink-0 ${checked ? "text-sky-400" : "text-slate-500"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${checked ? "text-white" : "text-slate-400"}`}>
          {label}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      {/* pill switch */}
      <div className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors ${
        checked ? "bg-sky-500" : "bg-slate-700"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? "left-4" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sky-400">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-xs font-medium text-slate-300">{children}</span>
      {hint && (
        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function toMinutes(value: number, unit: string): number {
  if (unit === "hours") return value * 60;
  if (unit === "days")  return value * 1440;
  return value;
}

interface Props {
  onBack: () => void;
}

export function AlertConfigPage({ onBack }: Props) {
  const [config,       setConfig]       = useState<AlertConfig>(DEFAULTS);
  const [saved,        setSaved]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [errors,       setErrors]       = useState<Partial<Record<keyof AlertConfig, string>>>({});
  const [allDevices,   setAllDevices]   = useState<{ imei: string; vehicle_name: string; plate: string }[]>([]);
  const [monitoredImeIs, setMonitoredImeIs] = useState<Set<string>>(new Set());
  const [deviceSearch, setDeviceSearch] = useState("");

  React.useEffect(() => {
    (async () => {
      try {
        // Config de alertas
        const res = await fetch(`${BASE}/api/monitoring`, {
          headers: { "Authorization": `Bearer ${getAuthToken()}` },
        });
        if (res.ok) {
          const { data } = await res.json();
          const channel = data.notification_channel ?? "";
          setConfig({
            warning_minutes:      toMinutes(data.warning_time_value, data.warning_time_unit),
            notification_minutes: toMinutes(data.alert_time_value,   data.alert_time_unit),
            notify_whatsapp:      channel === "whatsapp" || channel === "both",
            notify_email:         channel === "email"    || channel === "both",
            whatsapp_number:      data.phone_number ?? "",
            email_address:        data.email        ?? "",
          });
        }

        // Dispositivos con flag in_database
        const monRes = await fetch(`${BASE}/api/monitored_devices`, {
          headers: { "Authorization": `Bearer ${getAuthToken()}` },
        });
        console.log("[monitored_devices] status:", monRes.status);
        if (monRes.ok && monRes.status !== 204) {
          const json = await monRes.json();
          console.log("[monitored_devices] data:", json);
          const data = json.data;
          setAllDevices(data);
          const allFalse = data.every((d: any) => !d.in_database);
          if (allFalse) {
            // Primera vez — todos seleccionados por defecto
            setMonitoredImeIs(new Set(data.map((d: any) => d.imei)));
          } else {
            // Ya tiene configuración — solo los marcados
            setMonitoredImeIs(new Set(data.filter((d: any) => d.in_database).map((d: any) => d.imei)));
          }
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleDevice = (imei: string) => {
    setMonitoredImeIs(prev => {
      const next = new Set(prev);
      next.has(imei) ? next.delete(imei) : next.add(imei);
      return next;
    });
    setSaved(false);
  };

  const toggleAll = () => {
    if (monitoredImeIs.size === allDevices.length) {
      setMonitoredImeIs(new Set());
    } else {
      setMonitoredImeIs(new Set(allDevices.map(d => d.imei)));
    }
    setSaved(false);
  };

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return allDevices;
    const q = deviceSearch.toLowerCase();
    return allDevices.filter(d =>
      d.vehicle_name.toLowerCase().includes(q) ||
      d.plate.toLowerCase().includes(q) ||
      d.imei.toLowerCase().includes(q)
    );
  }, [allDevices, deviceSearch]);

  const set = <K extends keyof AlertConfig>(key: K, value: AlertConfig[K]) => {
    setConfig(c => ({ ...c, [key]: value }));
    setSaved(false);
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (config.notification_minutes <= config.warning_minutes) {
      e.notification_minutes = "Debe ser mayor que el tiempo de advertencia";
    }
    if (config.notify_whatsapp && !config.whatsapp_number.trim()) {
      e.whatsapp_number = "Ingresa un número de WhatsApp";
    }
    if (config.notify_email && !config.email_address.trim()) {
      e.email_address = "Ingresa un correo electrónico";
    }
    if (!config.notify_whatsapp && !config.notify_email) {
      e.notify_whatsapp = "Selecciona al menos un canal de notificación";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Converts total minutes to the most readable value+unit pair
  const minutesToValueUnit = (totalMinutes: number): { value: number; unit: string } => {
    if (totalMinutes >= 1440 && totalMinutes % 1440 === 0)
      return { value: totalMinutes / 1440, unit: "days" };
    if (totalMinutes >= 60 && totalMinutes % 60 === 0)
      return { value: totalMinutes / 60, unit: "hours" };
    return { value: totalMinutes, unit: "minutes" };
  };

  const handleSave = async () => {
    if (!validate()) return;

    const notification_channel =
      config.notify_whatsapp && config.notify_email ? "both"
      : config.notify_whatsapp ? "whatsapp"
      : "email";

    const { value: warning_time_value, unit: warning_time_unit }   = minutesToValueUnit(config.warning_minutes);
    const { value: alert_time_value,   unit: alert_time_unit   }   = minutesToValueUnit(config.notification_minutes);

    const payload = {
      warning_time_value,
      warning_time_unit,
      alert_time_value,
      alert_time_unit,
      notification_channel,
      phone_number: config.notify_whatsapp ? config.whatsapp_number.trim() : null,
      email:        config.notify_email    ? config.email_address.trim()   : null,
    };

    setSaving(true);
    setApiError(null);

    try {
      // Guardar config + unidades en un solo request
      const res = await fetch(`${BASE}/api/alert_configuration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          ...payload,
          devices: allDevices
            .filter(d => monitoredImeIs.has(d.imei))
            .map(d => ({ imei: d.imei, plate: d.plate, vehicle_name: d.vehicle_name })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 1200);
    } catch (e: any) {
      setApiError(e.message ?? "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const noChannelError = errors.notify_whatsapp && !errors.whatsapp_number;

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Bell className="w-5 h-5 text-amber-400" />
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Configuración de alertas</h2>
          <p className="text-xs text-slate-500">Define cuándo y cómo recibir notificaciones de señal</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
          </div>
        ) : (
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Timeline visual */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              Señal activa →{" "}
              <span className="text-amber-400 font-medium">
                sin señal {minutesToLabel(config.warning_minutes)}
              </span>
              {" "}→ Advertencia →{" "}
              <span className="text-rose-400 font-medium">
                sin señal {minutesToLabel(config.notification_minutes)}
              </span>
              {" "}→ Notificación enviada
            </span>
          </div>

          {/* Tiempo de advertencia */}
          <Section title="Tiempo para mostrar advertencia" icon={<AlertTriangle className="w-4 h-4" />}>
            <FieldLabel hint={`actual: ${minutesToLabel(config.warning_minutes)}`}>
              Sin señal por…
            </FieldLabel>
            <TimePicker value={config.warning_minutes} onChange={v => set("warning_minutes", v)} />
            <p className="text-[11px] text-slate-500 mt-2">
              La unidad aparecerá en estado <span className="text-amber-400">Advertencia</span> en el panel de monitoreo.
            </p>
          </Section>

          {/* Tiempo para notificar */}
          <Section title="Tiempo para enviar notificación" icon={<Clock className="w-4 h-4" />}>
            <FieldLabel hint={`actual: ${minutesToLabel(config.notification_minutes)}`}>
              Sin señal por…
            </FieldLabel>
            <TimePicker value={config.notification_minutes} onChange={v => set("notification_minutes", v)} error={errors.notification_minutes} />
            {errors.notification_minutes && (
              <p className="text-[11px] text-rose-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.notification_minutes}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              Se enviará un aviso cuando la unidad lleve este tiempo sin comunicarse.
            </p>
          </Section>

          {/* Canal de notificación */}
          <Section title="Canal de notificación" icon={<Bell className="w-4 h-4" />}>
            {noChannelError && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <p className="text-xs text-rose-400">Selecciona al menos un canal.</p>
              </div>
            )}

            <div className="space-y-2">
              <Toggle
                checked={config.notify_whatsapp}
                onChange={v => set("notify_whatsapp", v)}
                label="WhatsApp"
                description="Notificación vía Twilio al número configurado"
                icon={<MessageCircle className="w-4 h-4" />}
              />
              {config.notify_whatsapp && (
                <div className="pl-4 pr-1">
                  <FieldLabel>Número de WhatsApp</FieldLabel>
                  <input
                    type="tel"
                    placeholder="+52 55 1234 5678"
                    value={config.whatsapp_number}
                    onChange={e => set("whatsapp_number", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.whatsapp_number ? "border-rose-500" : "border-slate-700 focus:border-sky-500"
                    }`}
                  />
                  {errors.whatsapp_number && (
                    <p className="text-[11px] text-rose-400 mt-1">{errors.whatsapp_number}</p>
                  )}
                </div>
              )}

              <Toggle
                checked={config.notify_email}
                onChange={v => set("notify_email", v)}
                label="Correo electrónico"
                description="Envío automático al email registrado"
                icon={<Mail className="w-4 h-4" />}
              />
              {config.notify_email && (
                <div className="pl-4 pr-1">
                  <FieldLabel>Dirección de correo</FieldLabel>
                  <input
                    type="email"
                    placeholder="ejemplo@empresa.com"
                    value={config.email_address}
                    onChange={e => set("email_address", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-colors ${
                      errors.email_address ? "border-rose-500" : "border-slate-700 focus:border-sky-500"
                    }`}
                  />
                  {errors.email_address && (
                    <p className="text-[11px] text-rose-400 mt-1">{errors.email_address}</p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Unidades a monitorear */}
          <Section title="Unidades monitoreadas" icon={<Radio className="w-4 h-4" />}>
            <p className="text-[11px] text-slate-500 mb-3">
              Solo las unidades seleccionadas recibirán monitoreo de señal y generarán alertas.
            </p>

            {/* Search + counters */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={deviceSearch}
                  onChange={e => setDeviceSearch(e.target.value)}
                  placeholder="Buscar por unidad, placa o IMEI…"
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {deviceSearch && (
                  <button onClick={() => setDeviceSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-slate-500 hover:text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Two-column transfer list */}
            <div className="grid grid-cols-2 gap-3">

              {/* Left — disponibles */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-slate-400">
                    Disponibles <span className="text-slate-600">({filteredDevices.filter(d => !monitoredImeIs.has(d.imei)).length})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setMonitoredImeIs(new Set(allDevices.map(d => d.imei)))}
                    className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    Agregar todas
                  </button>
                </div>
                <div className="border border-slate-700 rounded-xl overflow-hidden h-56 overflow-y-auto">
                  {filteredDevices.filter(d => !monitoredImeIs.has(d.imei)).length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-600">
                      Todas agregadas
                    </div>
                  ) : filteredDevices.filter(d => !monitoredImeIs.has(d.imei)).map(d => (
                    <button
                      key={d.imei}
                      type="button"
                      onClick={() => toggleDevice(d.imei)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 last:border-0 text-left hover:bg-slate-800/60 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate group-hover:text-white transition-colors">
                          {d.vehicle_name}
                          {d.plate && <span className="text-slate-500 font-normal ml-1">· {d.plate}</span>}
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">{d.imei}</p>
                      </div>
                      <svg className="w-3 h-3 text-slate-600 group-hover:text-sky-400 shrink-0 transition-colors" viewBox="0 0 10 10" fill="none">
                        <path d="M3 5h4M5 3l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right — monitoreadas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-slate-400">
                    Monitoreadas <span className="text-sky-400 font-semibold">({filteredDevices.filter(d => monitoredImeIs.has(d.imei)).length})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setMonitoredImeIs(new Set())}
                    className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    Quitar todas
                  </button>
                </div>
                <div className="border border-sky-500/30 rounded-xl overflow-hidden h-56 overflow-y-auto bg-sky-500/5">
                  {filteredDevices.filter(d => monitoredImeIs.has(d.imei)).length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-600">
                      Ninguna seleccionada
                    </div>
                  ) : filteredDevices.filter(d => monitoredImeIs.has(d.imei)).map(d => (
                    <button
                      key={d.imei}
                      type="button"
                      onClick={() => toggleDevice(d.imei)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-sky-500/10 last:border-0 text-left hover:bg-rose-500/10 transition-colors group"
                    >
                      <svg className="w-3 h-3 text-sky-500/40 group-hover:text-rose-400 shrink-0 transition-colors" viewBox="0 0 10 10" fill="none">
                        <path d="M7 5H3M5 3L3 5l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-sky-100 truncate group-hover:text-rose-300 transition-colors">
                          {d.vehicle_name}
                          {d.plate && <span className="text-sky-400/50 font-normal ml-1">· {d.plate}</span>}
                        </p>
                        <p className="text-[10px] text-sky-500/40 truncate">{d.imei}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </Section>

        </div>
        )}
      </div>

      {/* Footer — save button */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>

        <div className="flex flex-col items-end gap-1.5">
          {apiError && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {apiError}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              saved
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                : "bg-sky-500 hover:bg-sky-400 text-white"
            }`}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4" /> Guardado</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar configuración</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}