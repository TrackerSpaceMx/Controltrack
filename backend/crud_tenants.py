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

async def create_tenant(cur, name: str, ft_apikey: str, ft_secretkey: str) -> int:
    await cur.execute("""
        INSERT INTO tenants (name, ft_apikey, ft_secretkey)
        VALUES (%s, %s, %s)
    """, (name, ft_apikey, ft_secretkey))
    await cur.execute("SELECT LAST_INSERT_ID() as id")
    row = await cur.fetchone()
    return row["id"]

async def update_tenant(cur, tenant_id: int, data: dict) -> bool:
    fields = {k: v for k, v in data.items() if v is not None and k in
              ["name", "ft_apikey", "ft_secretkey", "active"]}
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