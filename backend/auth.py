"""
Sistema de autenticación multi-tenant.
- Super-admin: usa ADMIN_USER / ADMIN_PASSWORD del .env  →  acceso total
- Tenant-user: usuario en tabla users con tenant_id       →  solo ve sus datos
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Header, Depends
import aiomysql

ADMIN_USER     = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "controltrack2024")

# Token store en memoria (para producción usar Redis o JWT)
_sessions: dict[str, dict] = {}

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_session(user_id: Optional[int], tenant_id: Optional[int],
                   username: str, role: str, is_superadmin: bool = False) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "user_id":      user_id,
        "tenant_id":    tenant_id,
        "username":     username,
        "role":         role,
        "is_superadmin": is_superadmin,
        "expires":      datetime.utcnow() + timedelta(hours=12),
    }
    return token

def get_session(token: str) -> Optional[dict]:
    s = _sessions.get(token)
    if not s:
        return None
    if datetime.utcnow() > s["expires"]:
        del _sessions[token]
        return None
    return s

def revoke_session(token: str):
    _sessions.pop(token, None)

async def authenticate_user(username: str, password: str, cur) -> dict:
    # Super-admin
    if username == ADMIN_USER and password == ADMIN_PASSWORD:
        token = create_session(None, None, username, "superadmin", is_superadmin=True)
        return {"token": token, "role": "superadmin", "tenant_id": None, "username": username}

    # Tenant user
    await cur.execute("""
        SELECT u.id, u.tenant_id, u.username, u.password, u.role, u.active,
               t.name as tenant_name, t.ft_apikey, t.ft_secretkey, t.active as tenant_active
        FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        WHERE u.username = %s
    """, (username,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not row["active"] or not row["tenant_active"]:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
    if row["password"] != _hash_password(password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_session(row["id"], row["tenant_id"], username, row["role"])
    return {
        "token":       token,
        "role":        row["role"],
        "tenant_id":   row["tenant_id"],
        "tenant_name": row["tenant_name"],
        "username":    username,
        "ft_apikey":   row["ft_apikey"],
        "ft_secretkey": row["ft_secretkey"],
    }

# ── FastAPI dependency ──────────────────────────────────────────────────────

def _extract_token(authorization: str = Header(default="")) -> str:
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization

async def get_current_session(authorization: str = Header(default="")) -> dict:
    token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
    return session

async def require_superadmin(session: dict = Depends(get_current_session)) -> dict:
    if not session.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo el super-admin puede realizar esta acción")
    return session