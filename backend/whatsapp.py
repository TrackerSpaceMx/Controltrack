"""
Módulo de notificaciones WhatsApp via Twilio.
Una sola cuenta Twilio para todos los tenants.
"""
import os
from datetime import date, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

TWILIO_ACCOUNT_SID    = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN     = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM  = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")  # sandbox default

def _get_client():
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        raise ValueError("Twilio no configurado. Añade TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN al .env")
    from twilio.rest import Client
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

def _format_phone(phone: str) -> str:
    """
    Normaliza número a formato whatsapp:+521XXXXXXXXXX
    Twilio requiere +521 para móviles mexicanos (no +52).
    Ejemplos de entrada aceptados:
      5564379747        → whatsapp:+5215564379747
      525564379747      → whatsapp:+5215564379747
      +525564379747     → whatsapp:+5215564379747
      +5215564379747    → whatsapp:+5215564379747  (ya correcto, no toca)
    """
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Quitar el prefijo whatsapp: si ya lo tiene
    if phone.startswith("whatsapp:"):
        phone = phone[9:]

    # Asegurar que empiece con +
    if not phone.startswith("+"):
        if phone.startswith("521") and len(phone) == 13:
            phone = "+" + phone           # ya tiene 521 correcto
        elif phone.startswith("52") and len(phone) == 12:
            phone = "+521" + phone[2:]    # +52XXXXXXXXXX → +521XXXXXXXXXX
        elif phone.startswith("52") and len(phone) == 13:
            phone = "+" + phone           # +521XXXXXXXXXX sin el +
        elif len(phone) == 10:
            phone = "+521" + phone        # solo 10 dígitos mexicanos
        else:
            phone = "+" + phone

    # Corregir +52XXXXXXXXXX (12 dígitos después del +) → +521XXXXXXXXXX
    # Twilio necesita el 1 intermedio para móviles MX
    if phone.startswith("+52") and not phone.startswith("+521") and len(phone) == 13:
        phone = "+521" + phone[3:]

    return f"whatsapp:{phone}"

def build_renewal_message(client_name: str, vehicles: list[dict],
                           expiration_date: str, days_left: int) -> str:
    """Construye el mensaje de recordatorio."""
    vehicle_lines = "\n".join(
        f"  • {v.get('device_name') or v.get('plate') or v.get('imei', '?')}"
        + (f" — ${v['monthly_price']:.2f}" if v.get("monthly_price") else "")
        for v in vehicles
    )
    total = sum(v.get("monthly_price") or 0 for v in vehicles)

    urgency = "⚠️ URGENTE: " if days_left <= 3 else ("📅 " if days_left <= 7 else "🔔 ")

    try:
        from datetime import datetime
        exp_fmt = datetime.strptime(expiration_date, "%Y-%m-%d").strftime("%d/%m/%Y")
    except Exception:
        exp_fmt = expiration_date

    msg = f"{urgency}Recordatorio de renovación\n\n"
    msg += f"Hola *{client_name}*,\n\n"
    if days_left == 0:
        msg += "Tu servicio GPS *vence hoy*.\n\n"
    elif days_left < 0:
        msg += f"Tu servicio GPS venció hace *{abs(days_left)} días*.\n\n"
    else:
        msg += f"Tu servicio GPS vence en *{days_left} días* ({exp_fmt}).\n\n"
    msg += f"*Vehículos:*\n{vehicle_lines}\n\n"
    if total > 0:
        msg += f"*Total a renovar: ${total:,.2f} MXN*\n\n"
    msg += "Contáctanos para renovar tu servicio y evitar interrupciones. 🚗📡"
    return msg

async def send_whatsapp(to_phone: str, message: str) -> dict:
    """Envía mensaje por WhatsApp. Retorna dict con sid y status."""
    client = _get_client()
    to = _format_phone(to_phone)
    msg = client.messages.create(
        from_=TWILIO_WHATSAPP_FROM,
        to=to,
        body=message,
    )
    return {"sid": msg.sid, "status": msg.status}

async def send_renewal_notification(cur, device_ids: list[int],
                                     whatsapp_number: str, tenant_id: Optional[int] = None) -> dict:
    """
    Envía notificación de renovación para un grupo de dispositivos del mismo cliente.
    Guarda historial en whatsapp_notifications.
    """
    if not device_ids:
        return {"sent": 0, "failed": 0}

    placeholders = ",".join(["%s"] * len(device_ids))
    await cur.execute(
        f"SELECT * FROM devices WHERE id IN ({placeholders})", device_ids
    )
    devices = [dict(r) for r in await cur.fetchall()]
    if not devices:
        return {"sent": 0, "failed": 0, "error": "Dispositivos no encontrados"}

    client_name = devices[0].get("client_name", "Cliente")
    exp_dates = [d["expiration_date"] for d in devices if d.get("expiration_date")]
    if not exp_dates:
        return {"sent": 0, "failed": 0, "error": "Sin fecha de vencimiento"}

    earliest = min(str(e) for e in exp_dates)
    today = date.today()
    try:
        from datetime import datetime as dt
        exp = dt.strptime(earliest, "%Y-%m-%d").date()
        days_left = (exp - today).days
    except Exception:
        days_left = 0

    message = build_renewal_message(client_name, devices, earliest, days_left)

    try:
        result = await send_whatsapp(whatsapp_number, message)
        status = "sent"
        sid = result["sid"]
    except Exception as e:
        status = "failed"
        sid = None
        error_msg = str(e)

    for d in devices:
        await cur.execute("""
            INSERT INTO whatsapp_notifications
                (tenant_id, device_id, client_name, phone_number, message_sid, status, days_before)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (tenant_id, d["id"], client_name, whatsapp_number, sid, status, days_left))

    if status == "failed":
        return {"sent": 0, "failed": len(devices), "error": error_msg}
    return {"sent": len(devices), "failed": 0, "sid": sid}


async def run_whatsapp_scheduler(cur, tenant_id: Optional[int] = None,
                                  days_before: list[int] = None) -> dict:
    """
    Envía notificaciones automáticas a clientes con vencimiento próximo.
    days_before: lista de días antes del vencimiento para notificar (ej: [1, 3, 7, 15])
    """
    if days_before is None:
        days_before = [1, 3]

    today = date.today()
    sent_total = 0
    failed_total = 0
    skipped = 0

    for days in days_before:
        target_date = today + timedelta(days=days)

        sql = """
            SELECT d.*, cc.whatsapp_number as cc_whatsapp
            FROM devices d
            LEFT JOIN client_config cc
                ON cc.client_fulltrack_id = d.client_fulltrack_id
                AND (cc.tenant_id = d.tenant_id OR cc.tenant_id IS NULL)
            WHERE d.expiration_date = %s
              AND d.status != 'deactivated'
        """
        params = [target_date.isoformat()]
        if tenant_id:
            sql += " AND d.tenant_id = %s"
            params.append(tenant_id)

        await cur.execute(sql, params)
        rows = await cur.fetchall()

        # Agrupar por cliente
        client_groups: dict[str, list] = {}
        for row in rows:
            row = dict(row)
            key = row["client_fulltrack_id"]
            if key not in client_groups:
                client_groups[key] = []
            client_groups[key].append(row)

        for client_id, devices in client_groups.items():
            # Buscar número WhatsApp: primero en client_config, luego en devices
            phone = None
            for d in devices:
                phone = d.get("cc_whatsapp") or d.get("whatsapp_number")
                if phone:
                    break

            if not phone:
                skipped += 1
                continue

            # Verificar que no se envió ya hoy
            await cur.execute("""
                SELECT id FROM whatsapp_notifications
                WHERE device_id = %s AND DATE(sent_at) = %s AND status = 'sent'
                LIMIT 1
            """, (devices[0]["id"], today.isoformat()))
            if await cur.fetchone():
                skipped += 1
                continue

            ids = [d["id"] for d in devices]
            result = await send_renewal_notification(cur, ids, phone, tenant_id)
            sent_total  += result.get("sent", 0)
            failed_total += result.get("failed", 0)

    return {"sent": sent_total, "failed": failed_total, "skipped": skipped}