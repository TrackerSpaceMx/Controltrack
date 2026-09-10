"""CRUD para tenants y usuarios."""
import hashlib
from typing import Optional

def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# ─── Tenants ──────────────────────────────────────────────────────────────────

async def get_tenants(cur) -> list:
    await cur.execute("""
        SELECT t.*, COUNT(u.id) as user_count
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        GROUP BY t.id
        ORDER BY t.name
    """)
    rows = await cur.fetchall()
    return [dict(r) for r in rows]

async def get_tenant(cur, tenant_id: int) -> Optional[dict]:
    await cur.execute("""
        SELECT t.*, COUNT(u.id) as user_count
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        WHERE t.id = %s
        GROUP BY t.id
    """, (tenant_id,))
    row = await cur.fetchone()
    return dict(row) if row else None

async def create_tenant(cur, name: str, ft_apikey: str, ft_secretkey: str, activos_enabled: bool = False) -> int:
    await cur.execute("""
        INSERT INTO tenants (name, ft_apikey, ft_secretkey, activos_enabled)
        VALUES (%s, %s, %s, %s)
    """, (name, ft_apikey, ft_secretkey, int(activos_enabled)))
    await cur.execute("SELECT LAST_INSERT_ID() as id")
    row = await cur.fetchone()
    return row["id"]

async def update_tenant(cur, tenant_id: int, data: dict) -> bool:
    fields = {k: v for k, v in data.items() if v is not None and k in
              ["name", "ft_apikey", "ft_secretkey", "active", "activos_enabled"]}
    if not fields:
        return True
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    await cur.execute(
        f"UPDATE tenants SET {set_clause} WHERE id=%s",
        (*fields.values(), tenant_id)
    )
    return True

async def delete_tenant(cur, tenant_id: int) -> bool:
    await cur.execute("DELETE FROM tenants WHERE id=%s", (tenant_id,))
    return True

# ─── Activos (caché de última posición GPS válida por tenant) ─────────────────
# Reemplaza el data/ultima_posicion_valida.json de Holkan-Services: aquí sí es
# seguro con varios workers de gunicorn escribiendo al mismo tiempo.

async def get_last_positions(cur, tenant_id: int) -> dict:
    """Devuelve {vehiculo_id: {lat, lon, fecha_gps}} para un tenant."""
    await cur.execute(
        "SELECT vehiculo_id, lat, lon, fecha_gps FROM activos_last_position WHERE tenant_id=%s",
        (tenant_id,)
    )
    rows = await cur.fetchall()
    return {r["vehiculo_id"]: {"lat": r["lat"], "lon": r["lon"], "fecha_gps": r["fecha_gps"]} for r in rows}

async def upsert_last_position(cur, tenant_id: int, vehiculo_id: str, lat, lon, fecha_gps: str):
    await cur.execute("""
        INSERT INTO activos_last_position (tenant_id, vehiculo_id, lat, lon, fecha_gps)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE lat=VALUES(lat), lon=VALUES(lon), fecha_gps=VALUES(fecha_gps)
    """, (tenant_id, str(vehiculo_id), str(lat), str(lon), fecha_gps))

# ─── Geocodificación (caché de direcciones por coordenada) ────────────────────

async def get_cached_address(cur, tenant_id: int, lat, lon) -> Optional[str]:
    await cur.execute(
        "SELECT address FROM geocode_cache WHERE tenant_id=%s AND lat=%s AND lon=%s",
        (tenant_id, str(lat), str(lon))
    )
    row = await cur.fetchone()
    return row["address"] if row else None

async def save_cached_address(cur, tenant_id: int, lat, lon, address: str):
    await cur.execute("""
        INSERT INTO geocode_cache (tenant_id, lat, lon, address)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE address=VALUES(address)
    """, (tenant_id, str(lat), str(lon), address))

# ─── Users ────────────────────────────────────────────────────────────────────

async def get_users(cur, tenant_id: Optional[int] = None) -> list:
    if tenant_id:
        await cur.execute("""
            SELECT u.*, t.name as tenant_name
            FROM users u JOIN tenants t ON t.id = u.tenant_id
            WHERE u.tenant_id = %s ORDER BY u.username
        """, (tenant_id,))
    else:
        await cur.execute("""
            SELECT u.*, t.name as tenant_name
            FROM users u JOIN tenants t ON t.id = u.tenant_id
            ORDER BY t.name, u.username
        """)
    rows = await cur.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d.pop("password", None)  # nunca exponer el hash
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result

async def create_user(cur, tenant_id: int, username: str, password: str,
                       full_name: Optional[str], role: str) -> int:
    await cur.execute("""
        INSERT INTO users (tenant_id, username, password, full_name, role)
        VALUES (%s, %s, %s, %s, %s)
    """, (tenant_id, username, _hash(password), full_name, role))
    await cur.execute("SELECT LAST_INSERT_ID() as id")
    row = await cur.fetchone()
    return row["id"]

async def update_user(cur, user_id: int, data: dict) -> bool:
    fields = {}
    for k, v in data.items():
        if v is None:
            continue
        if k == "password":
            fields["password"] = _hash(v)
        elif k in ["full_name", "role", "active"]:
            fields[k] = v
    if not fields:
        return True
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    await cur.execute(
        f"UPDATE users SET {set_clause} WHERE id=%s",
        (*fields.values(), user_id)
    )
    return True

async def delete_user(cur, user_id: int) -> bool:
    await cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
    return True

# ─── WhatsApp notification history ───────────────────────────────────────────

async def get_notification_history(cur, tenant_id: Optional[int] = None,
                                    limit: int = 100) -> list:
    sql = """
        SELECT n.*, d.device_name, d.plate
        FROM whatsapp_notifications n
        LEFT JOIN devices d ON d.id = n.device_id
        WHERE 1=1
    """
    params = []
    if tenant_id:
        sql += " AND n.tenant_id = %s"
        params.append(tenant_id)
    sql += " ORDER BY n.sent_at DESC LIMIT %s"
    params.append(limit)
    await cur.execute(sql, params)
    rows = await cur.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("sent_at"):
            d["sent_at"] = str(d["sent_at"])
        result.append(d)
    return result


async def create_alert_configuration(cur, tenant_id: int, body: dict) -> int:
    await cur.execute("""
        INSERT INTO alert_configuration
            (tenant_id, warning_time_value, warning_time_unit,
             alert_time_value, alert_time_unit, notification_channel,
             phone_number, email)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            warning_time_value   = VALUES(warning_time_value),
            warning_time_unit    = VALUES(warning_time_unit),
            alert_time_value     = VALUES(alert_time_value),
            alert_time_unit      = VALUES(alert_time_unit),
            notification_channel = VALUES(notification_channel),
            phone_number         = VALUES(phone_number),
            email                = VALUES(email)
    """, (tenant_id, body["warning_time_value"], body["warning_time_unit"], body["alert_time_value"],
          body["alert_time_unit"], body["notification_channel"], body["phone_number"], body["email"]))

    await cur.execute("SELECT id FROM alert_configuration WHERE tenant_id = %s", (tenant_id,))
    row = await cur.fetchone()
    return row["id"]


async def get_alert_configuration(cur, tenant_id: int) -> dict | None:
    await cur.execute("""
        SELECT
            id,
            tenant_id,
            warning_time_value,
            warning_time_unit,
            alert_time_value,
            alert_time_unit,
            notification_channel,
            phone_number,
            email
        FROM alert_configuration
        WHERE tenant_id = %s
    """, (tenant_id,))

    row = await cur.fetchone()
    return row


async def get_keys(cur, tenant_id: int) -> dict | None:
    await cur.execute("""
        SELECT
            id,
            ft_apikey,
            ft_secretkey
        FROM tenants
        WHERE id = %s
    """, (tenant_id,))

    row = await cur.fetchone()
    return row



async def select_monitored_devices(cur, tenant_id: int) -> dict | None:
    await cur.execute("""
        SELECT
            id,
            tenant_id,
            imei,
            plate,
            vehicle_name,
            active,
            in_maintenance,
            last_signal_at,
            last_whatsapp_alert_at,
            last_email_alert_at
        FROM monitored_devices
        WHERE tenant_id = %s
    """, (tenant_id,))

    rows = await cur.fetchall()
    return rows



async def insert_monitored_devices(cur, tenant_id: int, devices: list) -> dict:
    if not devices:
        return {"success": True, "affected": 0, "processed": 0}

    values = [
        (tenant_id, d["imei"], d.get("plate"), d.get("vehicle_name"), d.get("active"), d.get("in_maintenance"))
        for d in devices
    ]

    try:
        await cur.executemany("""
            INSERT INTO monitored_devices (tenant_id, imei, plate, vehicle_name, active, in_maintenance)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                plate          = VALUES(plate),
                vehicle_name   = VALUES(vehicle_name),
                active         = VALUES(active),
                in_maintenance = VALUES(in_maintenance)
        """, values)
        return  True
    except Exception as e:
        return False


async def select_whatsapp_alert_status(cur, tenant_id: int,imei) -> dict | None:
    await cur.execute("""
        SELECT
            id,
            last_signal_at,
            last_whatsapp_alert_at
        FROM monitored_devices
        WHERE tenant_id = %s AND imei = %s
    """, (tenant_id,imei))

    rows = await cur.fetchall()
    return rows


async def get_phone_number_for_alert(cur, tenant_id: int) -> dict | None:
    await cur.execute("""
        SELECT
            id,
            phone_number
        FROM alert_configuration
        WHERE tenant_id = %s
    """, (tenant_id,))

    row = await cur.fetchone()
    return row



async def update_whatsapp_alert_status(cur, last_signal_at, last_whatsapp_alert_at, tenant_id: int, imei) -> int:
    await cur.execute("""
        UPDATE monitored_devices SET  
            last_signal_at = %s,
            last_whatsapp_alert_at = %s
        WHERE tenant_id = %s AND imei = %s
    """, (last_signal_at, last_whatsapp_alert_at, tenant_id, imei))

    return cur.rowcount