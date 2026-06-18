const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface DeviceRecord {
  id: number;
  tracker_id: string;
  imei: string;
  client_fulltrack_id: string;
  vehicle_id: string | null;
  client_name: string;
  device_name: string | null;
  plate: string | null;
  model: string | null;
  sim: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  status: "active" | "expiring" | "expired" | "deactivated";
  client_liberado: string;
  days_until_expiration: number | null;
  // Nuevos v2
  contract_type: ContractType | null;
  seller_name: string | null;
  installer_name: string | null;
  install_date: string | null;
  monthly_price: number | null;
  rfc: string | null;
  custom_fields?: CustomField[];
}

export type ContractType = "monthly" | "quarterly" | "semiannual" | "annual" | "lease";

export const CONTRACT_LABELS: Record<ContractType | string, string> = {
  monthly:    "Mensual",
  quarterly:  "Trimestral",
  semiannual: "Semestral",
  annual:     "Anual",
  lease:      "Arrendamiento",
};

export const CONTRACT_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "monthly",    label: "Mensual"       },
  { value: "quarterly",  label: "Trimestral"    },
  { value: "semiannual", label: "Semestral"     },
  { value: "annual",     label: "Anual"         },
  { value: "lease",      label: "Arrendamiento" },
];

export interface CustomField {
  field_key: string;
  field_label: string;
  field_type: "text" | "number" | "date";
  field_value: string | null;
}

export interface DeviceListResponse {
  devices: DeviceRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardStats {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  deactivated: number;
  expiring_this_month: number;
}

export interface MonthlyExpiration {
  month: string;
  count: number;
}

export interface SellerStats {
  seller_name: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
  deactivated: number;
  monthly_revenue: number;
}

export interface ClientConfig {
  client_fulltrack_id: string;
  client_name: string | null;
  grace_days: number;
  auto_deactivate: boolean;
}

export interface InvoiceItem {
  device_id: number;
  device_name: string | null;
  plate: string | null;
  imei: string;
  contract_type: string | null;
  monthly_price: number;
  status: string;
  expiration_date: string | null;
}

export interface InvoicePreview {
  client_fulltrack_id: string;
  client_name: string;
  items: InvoiceItem[];
  subtotal_by_type: Record<string, number>;
  total: number;
  total_devices: number;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : JSON.stringify(err.detail) ?? "Error en el servidor"
    );
  }
  return res.json() as Promise<T>;
}

function enrichDevice(d: any): DeviceRecord {
  if (d.days_until_expiration === undefined || d.days_until_expiration === null) {
    if (d.expiration_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exp = new Date(d.expiration_date + "T12:00:00");
      d.days_until_expiration = Math.round((exp.getTime() - today.getTime()) / 86400000);
    } else {
      d.days_until_expiration = null;
    }
  }
  if (d.sim === undefined)              d.sim = null;
  if (d.contract_type === undefined)    d.contract_type = null;
  if (d.seller_name === undefined)      d.seller_name = null;
  if (d.installer_name === undefined)   d.installer_name = null;
  if (d.install_date === undefined)     d.install_date = null;
  if (d.monthly_price === undefined)    d.monthly_price = null;
  if (d.rfc === undefined)              d.rfc = null;
  if (d.custom_fields === undefined)    d.custom_fields = [];
  return d as DeviceRecord;
}

export const api = {
  login: (username: string, password: string) =>
    req<{ success: boolean; message: string }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  sync: () =>
    authReq<{ success: boolean; message: string; synced_devices: number }>("/api/sync", {
      method: "POST",
    }),

  getStats: async (): Promise<DashboardStats> => {
    const data = await authReq<any>("/api/stats");
    return {
      total:               data.total               ?? 0,
      active:              data.active              ?? 0,
      expiring:            data.expiring            ?? 0,
      expired:             data.expired             ?? 0,
      deactivated:         data.deactivated         ?? 0,
      expiring_this_month: data.expiring_this_month ?? 0,
    };
  },

  getMonthlyStats: async (): Promise<MonthlyExpiration[]> => {
    try { return await authReq<MonthlyExpiration[]>("/api/stats/monthly"); }
    catch { return []; }
  },

  getSellerStats: async (): Promise<SellerStats[]> => {
    try { return await authReq<SellerStats[]>("/api/stats/by-seller"); }
    catch { return []; }
  },

  getDevices: async (params: {
    search_client?: string;
    search_imei?: string;
    search_device?: string;
    status_filter?: string;
    expiring_days?: number;
    expire_from?: string;
    expire_to?: string;
    seller_filter?: string;
    installer_filter?: string;
    contract_type_filter?: string;
    page?: number;
    page_size?: number;
  }): Promise<DeviceListResponse> => {
    const qs = new URLSearchParams();
    if (params.search_client)        qs.set("search_client",        params.search_client);
    if (params.search_imei)          qs.set("search_imei",          params.search_imei);
    if (params.search_device)        qs.set("search_device",        params.search_device);
    if (params.status_filter && params.status_filter !== "all")
      qs.set("status_filter", params.status_filter);
    if (params.expiring_days !== undefined)
      qs.set("expiring_days", String(params.expiring_days));
    if (params.expire_from)          qs.set("expire_from",          params.expire_from);
    if (params.expire_to)            qs.set("expire_to",            params.expire_to);
    if (params.seller_filter)        qs.set("seller_filter",        params.seller_filter);
    if (params.installer_filter)     qs.set("installer_filter",     params.installer_filter);
    if (params.contract_type_filter) qs.set("contract_type_filter", params.contract_type_filter);
    qs.set("page",      String(params.page      ?? 1));
    qs.set("page_size", String(params.page_size ?? 10));

    const raw = await authReq<any>(`/api/devices?${qs}`);
    if (raw && typeof raw === "object" && Array.isArray(raw.devices)) {
      return { ...raw, devices: raw.devices.map(enrichDevice) };
    }
    if (Array.isArray(raw)) {
      const devices = raw.map(enrichDevice);
      return { devices, total: devices.length, page: params.page ?? 1, page_size: params.page_size ?? 10 };
    }
    return { devices: [], total: 0, page: 1, page_size: 10 };
  },

  getClientDevices: async (clientId: string): Promise<DeviceRecord[]> => {
    const raw = await authReq<any[]>(`/api/clients/${clientId}/devices`);
    return raw.map(enrichDevice);
  },

  updateExpiration: (deviceId: number, expiration_date: string) =>
    authReq<{ success: boolean }>(`/api/devices/${deviceId}/expiration`, {
      method: "PUT",
      body: JSON.stringify({ expiration_date }),
    }),

  updateDeviceDetails: (deviceId: number, data: Partial<{
    contract_type: string;
    seller_name: string;
    installer_name: string;
    install_date: string;
    monthly_price: number;
    rfc: string;
    auto_compute_expiration: boolean;
  }>) =>
    authReq<{ success: boolean; device: DeviceRecord }>(`/api/devices/${deviceId}/details`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  upsertCustomField: (deviceId: number, field: CustomField) =>
    authReq<{ success: boolean }>(`/api/devices/${deviceId}/custom-fields`, {
      method: "PUT",
      body: JSON.stringify(field),
    }),

  deleteCustomField: (deviceId: number, fieldKey: string) =>
    authReq<{ success: boolean }>(`/api/devices/${deviceId}/custom-fields/${fieldKey}`, {
      method: "DELETE",
    }),

  toggleDevice: (deviceId: number, deactivate: boolean) =>
    authReq<{ success: boolean }>(`/api/devices/${deviceId}/toggle`, {
      method: "PUT",
      body: JSON.stringify({ deactivate }),
    }),

  bulkToggle: (deviceIds: number[], deactivate: boolean) =>
    authReq<{ success: boolean; updated: number }>("/api/devices/bulk-toggle", {
      method: "POST",
      body: JSON.stringify({ device_ids: deviceIds, deactivate }),
    }),

  toggleClient: (clientId: string, deactivate: boolean) =>
    authReq<{ success: boolean }>(`/api/clients/${clientId}/toggle`, {
      method: "PUT",
      body: JSON.stringify({ deactivate }),
    }),

  getClientConfig: (clientId: string) =>
    authReq<ClientConfig>(`/api/clients/${clientId}/config`),

  updateClientConfig: (clientId: string, data: { grace_days?: number; auto_deactivate?: boolean; client_name?: string }) =>
    authReq<{ success: boolean }>(`/api/clients/${clientId}/config`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getAllClientConfigs: () =>
    authReq<ClientConfig[]>("/api/client-configs"),

  getInvoicePreview: (clientId: string) =>
    authReq<InvoicePreview>(`/api/clients/${clientId}/invoice-preview`),

  runScheduler: () =>
    authReq<{ success: boolean; deactivated: number; skipped_grace: number; evaluated: number }>(
      "/api/scheduler/run", { method: "POST" }
    ),

  getExportUrl: (params: {
    format: "csv" | "xlsx" | "pdf";
    status_filter?: string;
    seller_filter?: string;
    contract_type_filter?: string;
    expire_from?: string;
    expire_to?: string;
    expiring_days?: number;
  }) => {
    const qs = new URLSearchParams({ format: params.format });
    if (params.status_filter)        qs.set("status_filter",        params.status_filter);
    if (params.seller_filter)        qs.set("seller_filter",        params.seller_filter);
    if (params.contract_type_filter) qs.set("contract_type_filter", params.contract_type_filter);
    if (params.expire_from)          qs.set("expire_from",          params.expire_from);
    if (params.expire_to)            qs.set("expire_to",            params.expire_to);
    if (params.expiring_days !== undefined) qs.set("expiring_days", String(params.expiring_days));
    if (_authToken) qs.set("token", _authToken);
    return `${BASE}/api/export?${qs}`;
  },
};

// ─── Multi-tenant auth ────────────────────────────────────────────────────────

export interface SessionInfo {
  token: string;
  role: string;
  username: string;
  tenant_id: number | null;
  tenant_name: string | null;
  is_superadmin: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  ft_apikey: string;
  ft_secretkey: string;
  active: boolean;
  user_count: number;
  created_at?: string;
}

export interface AppUser {
  id: number;
  tenant_id: number;
  username: string;
  full_name: string | null;
  role: string;
  active: boolean;
  tenant_name?: string;
  created_at?: string;
}

export interface WhatsAppHistoryRecord {
  id: number;
  device_id: number;
  client_name: string | null;
  phone_number: string | null;
  status: string;
  days_before: number | null;
  sent_at: string | null;
  device_name?: string | null;
  plate?: string | null;
}

let _authToken = "";
export function setAuthToken(t: string) { _authToken = t; }
export function getAuthToken() { return _authToken; }

let _impersonateTenantId: number | null = null;
export function setImpersonateTenant(id: number | null) { _impersonateTenantId = id; }
export function getImpersonateTenant() { return _impersonateTenantId; }

async function authReq<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${_authToken}`,
  };
  if (_impersonateTenantId !== null) {
    headers["X-Impersonate-Tenant"] = String(_impersonateTenantId);
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  loginV2: (username: string, password: string) =>
    req<SessionInfo & { success: boolean }>("/api/v2/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // Tenants
  getTenants: () => authReq<Tenant[]>("/api/tenants"),
  createTenant: (data: { name: string; ft_apikey: string; ft_secretkey: string }) =>
    authReq<{ success: boolean; id: number }>("/api/tenants", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateTenant: (id: number, data: Partial<Tenant>) =>
    authReq<{ success: boolean }>(`/api/tenants/${id}`, {
      method: "PUT", body: JSON.stringify(data),
    }),
  deleteTenant: (id: number) =>
    authReq<{ success: boolean }>(`/api/tenants/${id}`, { method: "DELETE" }),
  syncTenant: (id: number) =>
    authReq<{ success: boolean; synced: number }>(`/api/tenants/${id}/sync`, { method: "POST" }),

  // Users
  getUsers: (tenantId?: number) =>
    authReq<AppUser[]>(`/api/users${tenantId ? `?tenant_id=${tenantId}` : ""}`),
  createUser: (data: { tenant_id: number; username: string; password: string; full_name?: string; role: string }) =>
    authReq<{ success: boolean; id: number }>("/api/users", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateUser: (id: number, data: Partial<AppUser & { password?: string }>) =>
    authReq<{ success: boolean }>(`/api/users/${id}`, {
      method: "PUT", body: JSON.stringify(data),
    }),
  deleteUser: (id: number) =>
    authReq<{ success: boolean }>(`/api/users/${id}`, { method: "DELETE" }),

  // WhatsApp
  sendWhatsApp: (device_ids: number[], whatsapp_number: string) =>
    authReq<{ success: boolean; sent: number }>("/api/whatsapp/send", {
      method: "POST", body: JSON.stringify({ device_ids, whatsapp_number }),
    }),
  runWhatsAppScheduler: () =>
    authReq<{ success: boolean; sent: number; failed: number; skipped: number }>(
      "/api/whatsapp/scheduler", { method: "POST" }
    ),
  getWhatsAppHistory: () =>
    authReq<WhatsAppHistoryRecord[]>("/api/whatsapp/history"),
};