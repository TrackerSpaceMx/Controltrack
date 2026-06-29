from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import date
from decimal import Decimal


class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    message: str


# ─── Device ───────────────────────────────────────────────────────────────────

class DeviceResponse(BaseModel):
    id: int
    tracker_id: str
    imei: str
    client_fulltrack_id: str
    vehicle_id: Optional[str] = None
    client_name: str
    device_name: Optional[str] = None
    plate: Optional[str] = None
    model: Optional[str] = None
    sim: Optional[str] = None
    registration_date: Optional[date] = None
    expiration_date: Optional[date] = None
    status: str
    client_liberado: Optional[str] = "S"
    days_until_expiration: Optional[int] = None
    # Nuevos campos v2
    contract_type: Optional[str] = None
    seller_name: Optional[str] = None
    installer_name: Optional[str] = None
    install_date: Optional[date] = None
    monthly_price: Optional[float] = None
    rfc: Optional[str] = None
    custom_fields: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class DeviceListResponse(BaseModel):
    devices: List[DeviceResponse]
    total: int
    page: int
    page_size: int

class UpdateExpirationRequest(BaseModel):
    expiration_date: date

class UpdateDeviceDetailsRequest(BaseModel):
    contract_type: Optional[str] = None
    seller_name: Optional[str] = None
    installer_name: Optional[str] = None
    install_date: Optional[date] = None
    monthly_price: Optional[float] = None
    rfc: Optional[str] = None
    # Auto-calcular vencimiento basado en contract_type e install_date
    auto_compute_expiration: Optional[bool] = False

class CustomFieldUpsert(BaseModel):
    field_key: str
    field_label: str
    field_type: str = "text"  # text | number | date
    field_value: Optional[str] = None

class ToggleStatusRequest(BaseModel):
    deactivate: bool

class BulkToggleRequest(BaseModel):
    device_ids: List[int]
    deactivate: bool

class DeactivateClientRequest(BaseModel):
    ras_cli_id: int

class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_devices: int

class DashboardStats(BaseModel):
    total: int
    active: int
    expiring: int
    expired: int
    deactivated: int
    expiring_this_month: int

class MonthlyExpiration(BaseModel):
    month: str
    count: int


# ─── Client config ─────────────────────────────────────────────────────────────

class ClientConfig(BaseModel):
    client_fulltrack_id: str
    client_name: Optional[str] = None
    grace_days: int = 0
    auto_deactivate: bool = True
    whatsapp_number: Optional[str] = None

class ClientConfigUpdate(BaseModel):
    grace_days: Optional[int] = None
    auto_deactivate: Optional[bool] = None
    client_name: Optional[str] = None
    whatsapp_number: Optional[str] = None  # None = borrar; str = guardar; no enviado = no tocar


# ─── Stats / Reports ──────────────────────────────────────────────────────────

class SellerStats(BaseModel):
    seller_name: str
    total: int
    active: int
    expiring: int
    expired: int
    deactivated: int
    monthly_revenue: Optional[float] = None

class InvoiceItem(BaseModel):
    device_id: int
    device_name: Optional[str]
    plate: Optional[str]
    imei: str
    contract_type: Optional[str]
    monthly_price: Optional[float]
    status: str
    expiration_date: Optional[date]

class InvoicePreview(BaseModel):
    client_fulltrack_id: str
    client_name: str
    items: List[InvoiceItem]
    subtotal_by_type: Dict[str, float]
    total: float
    total_devices: int


# ─── Tenant / Multi-tenant ────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    ft_apikey: str
    ft_secretkey: str

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    ft_apikey: Optional[str] = None
    ft_secretkey: Optional[str] = None
    active: Optional[bool] = None

class TenantResponse(BaseModel):
    id: int
    name: str
    ft_apikey: str
    ft_secretkey: str
    active: bool
    user_count: Optional[int] = 0
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    tenant_id: int
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "operator"  # admin | operator | viewer

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    tenant_id: int
    username: str
    full_name: Optional[str] = None
    role: str
    active: bool
    tenant_name: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Auth (nuevo multi-tenant) ────────────────────────────────────────────────

class LoginResponseV2(BaseModel):
    success: bool
    token: str
    role: str
    username: str
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    is_superadmin: bool = False


# ─── WhatsApp ─────────────────────────────────────────────────────────────────

class WhatsAppSendRequest(BaseModel):
    device_ids: List[int]
    whatsapp_number: str

class WhatsAppSchedulerResult(BaseModel):
    sent: int
    failed: int
    skipped: int

class WhatsAppNotificationRecord(BaseModel):
    id: int
    device_id: int
    client_name: Optional[str]
    phone_number: Optional[str]
    status: str
    days_before: Optional[int]
    sent_at: Optional[str]


# ─── Monitoring ─────────────────────────────────────────────────────────────────

class RegisterAlertConfiguration(BaseModel):
    warning_time_value : int
    warning_time_unit : str
    alert_time_value : int
    alert_time_unit : str
    notification_channel : str
    phone_number : Optional[str] = None
    email : Optional[str] = None
    devices : List[dict]

