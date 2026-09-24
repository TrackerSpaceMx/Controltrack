from datetime import date, datetime, timedelta
from typing import Optional, List


# ─── Contract type → delta days ───────────────────────────────────────────────

CONTRACT_DAYS = {
    "monthly":    30,
    "quarterly":  90,
    "semiannual": 180,
    "annual":     365,
    "lease":      365,  # arrendamiento: se define manualmente, default 1 año
}

CONTRACT_LABELS = {
    "monthly":    "Mensual",
    "quarterly":  "Trimestral",
    "semiannual": "Semestral",
    "annual":     "Anual",
    "lease":      "Arrendamiento",
}


def compute_expiration_from_contract(contract_type: str, base_date: date) -> date:
    days = CONTRACT_DAYS.get(contract_type, 30)
    return base_date + timedelta(days=days)


# ─── Status helpers ───────────────────────────────────────────────────────────

def _compute_status(expiration_date, client_liberado: str, current_status: str, from_sync: bool = False) -> str:
    if client_liberado == "N":
        return "deactivated"
    if not from_sync and current_status == "deactivated":
        return "deactivated"
    if expiration_date is None:
        return "active"
    today = date.today()
    if isinstance(expiration_date, str):
        try:
            expiration_date = date.fromisoformat(expiration_date)
        except Exception:
            return "active"
    if expiration_date < today:
        return "expired"
    if expiration_date <= today + timedelta(days=15):
        return "expiring"
    return "active"


def _days_until_expiration(expiration_date) -> Optional[int]:
    if expiration_date is None:
        return None
    today = date.today()
    if isinstance(expiration_date, str):
        try:
            expiration_date = date.fromisoformat(expiration_date)
        except Exception:
            return None
    return (expiration_date - today).days


def _enrich_row(row: dict) -> dict:
    row["status"] = _compute_status(
        row.get("expiration_date"), row.get("client_liberado", "S"), row.get("status", "active")
    )
    row["days_until_expiration"] = _days_until_expiration(row.get("expiration_date"))
    if row.get("monthly_price") is not None:
        row["monthly_price"] = float(row["monthly_price"])
    return row


# ─── Sync ─────────────────────────────────────────────────────────────────────

async def sync_data(cur, clients_data, trackers_data, vehicles_data, events_data, products_data, workshop_data=None, tenant_id=None) -> int:
    clients_map  = {c["ras_cli_id"]: c for c in clients_data}
    vehicles_map = {v["ras_vei_id"]: v for v in vehicles_data}
    products_map = {p["ras_prd_id"]: p.get("ras_prd_desc", "") for p in products_data}

    workshop_map = {}
    if workshop_data:
        for w in workshop_data:
            imei_w = str(w.get("ras_ras_id_aparelho", ""))
            if imei_w:
                workshop_map[imei_w] = {
                    "ras_ins_id": w.get("ras_ins_id"),
                    "ras_vei_id": w.get("ras_vei_id"),
                }

    events_map = {}
    for e in events_data:
        tid = e.get("ras_ras_id")
        if tid and e.get("ras_ras_id_aparelho"):
            events_map[tid] = e

    trackers_map = {t["ras_ras_id"]: t for t in trackers_data}
    synced = 0
    seen_imeis = set()  # IMEIs que SÍ vinieron en este events/all (para detectar desinstalados)

    for tracker_id, event in events_map.items():
        tracker = trackers_map.get(tracker_id, {})

        imei      = event.get("ras_ras_id_aparelho", "") or ""
        cli_id    = event.get("ras_cli_id", "") or tracker.get("ras_ras_cli_id", "") or ""
        vei_id    = event.get("ras_vei_id", "")
        vei_placa = event.get("ras_vei_placa", "")
        vei_desc  = event.get("ras_vei_veiculo", "")
        vei_chassi = ""

        if vei_id and vei_id in vehicles_map:
            v = vehicles_map[vei_id]
            if not vei_desc:
                vei_desc  = v.get("ras_vei_veiculo", "") or v.get("ras_vei_placa", "")
                vei_placa = v.get("ras_vei_placa", "") or vei_placa
            vei_chassi = v.get("ras_vei_chassi", "") or ""

        prd_id = tracker.get("ras_ras_prd_id", "") or event.get("ras_prd_id", "")
        model  = products_map.get(prd_id, prd_id)

        client      = clients_map.get(cli_id, {})
        client_name = client.get("ras_cli_desc", f"Cliente {cli_id}")
        liberado    = client.get("ras_cli_liberado", "S")

        sim = tracker.get("ras_ras_linha", "") or tracker.get("ras_ras_chip", "") or ""

        if not imei:
            continue

        seen_imeis.add(str(imei))

        workshop_info = workshop_map.get(str(imei), {})
        ins_id   = workshop_info.get("ras_ins_id")
        w_vei_id = workshop_info.get("ras_vei_id") or vei_id

        reg_date = None
        reg_date_raw = tracker.get("ras_ras_data_alterado", "")
        if reg_date_raw:
            try:
                reg_date = datetime.strptime(reg_date_raw[:10], "%Y-%m-%d").date()
            except Exception:
                pass

        await cur.execute("""
            INSERT INTO devices
                (tracker_id, imei, client_fulltrack_id, vehicle_id,
                 client_name, device_name, plate, model, sim,
                 registration_date, client_liberado, ras_ins_id, tenant_id, chassis)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                tenant_id           = VALUES(tenant_id),
                client_fulltrack_id = VALUES(client_fulltrack_id),
                vehicle_id          = VALUES(vehicle_id),
                client_name         = VALUES(client_name),
                device_name         = VALUES(device_name),
                plate               = VALUES(plate),
                model               = VALUES(model),
                sim                 = COALESCE(VALUES(sim), sim),
                client_liberado     = VALUES(client_liberado),
                registration_date   = IF(registration_date IS NULL, VALUES(registration_date), registration_date),
                ras_ins_id          = IF(VALUES(ras_ins_id) IS NOT NULL, VALUES(ras_ins_id), ras_ins_id),
                chassis             = IF(VALUES(chassis) IS NOT NULL AND VALUES(chassis) != '', VALUES(chassis), chassis)
        
        """, (
            tracker_id, imei, cli_id, w_vei_id or None,
            client_name, vei_desc or None, vei_placa or None, model or None, sim or None,
            reg_date, liberado, ins_id, tenant_id, vei_chassi or None
        ))

        if tenant_id is not None:
            await cur.execute(
                "SELECT id, expiration_date, status, client_liberado FROM devices WHERE imei=%s AND tenant_id=%s",
                (imei, tenant_id)
            )
        else:
            await cur.execute(
                "SELECT id, expiration_date, status, client_liberado FROM devices WHERE imei=%s", (imei,)
            )
        row = await cur.fetchone()
        if row:
            new_status = _compute_status(
                row["expiration_date"], row["client_liberado"], row["status"], from_sync=True
            )
            await cur.execute("UPDATE devices SET status=%s WHERE id=%s", (new_status, row["id"]))

        synced += 1

    # ── Marcar como desactivados los dispositivos que ya NO aparecen en events/all ──
    # Si Fulltrack reporta 0 eventos, es casi seguro un error/timeout de la API y no
    # que "se desinstalaron todos los GPS". Por seguridad, en ese caso NO se toca nada.
    if seen_imeis:
        if tenant_id is not None:
            await cur.execute(
                "SELECT id, imei FROM devices WHERE tenant_id=%s AND status != 'deactivated'",
                (tenant_id,)
            )
        else:
            await cur.execute(
                "SELECT id, imei FROM devices WHERE status != 'deactivated'"
            )
        current_rows = await cur.fetchall()

        missing_ids = [r["id"] for r in current_rows if str(r["imei"]) not in seen_imeis]

        if missing_ids:
            placeholders = ",".join(["%s"] * len(missing_ids))
            # Solo se actualiza la columna status. Ningún otro dato (cliente, placa,
            # vencimiento, precio, RFC, campos personalizados, etc.) se modifica ni se borra.
            await cur.execute(
                f"UPDATE devices SET status='deactivated' WHERE id IN ({placeholders})",
                missing_ids
            )

    return synced


# ─── Get devices ──────────────────────────────────────────────────────────────

async def get_devices(cur, search_client=None, search_imei=None, search_device=None,
                      status_filter=None, expiring_days=None,
                      expire_from=None, expire_to=None,
                      seller_filter=None, installer_filter=None,
                      contract_type_filter=None,
                      search_rfc=None, search_custom=None,
                      page=1, page_size=10, tenant_id=None, client_scope=None):
    base = "FROM devices d WHERE 1=1"
    params = []

    if client_scope:
        placeholders = ",".join(["%s"] * len(client_scope))
        base += f" AND d.client_fulltrack_id IN ({placeholders})"
        params.extend(client_scope)

    if tenant_id is not None:
        base += " AND d.tenant_id = %s"
        params.append(tenant_id)

    if search_client:
        base += " AND d.client_name LIKE %s"
        params.append(f"%{search_client}%")
    if search_imei:
        base += " AND d.imei LIKE %s"
        params.append(f"%{search_imei}%")
    if search_device:
        base += " AND (d.device_name LIKE %s OR d.plate LIKE %s OR d.sim LIKE %s)"
        params.extend([f"%{search_device}%", f"%{search_device}%", f"%{search_device}%"])
    if status_filter and status_filter != "all":
        base += " AND d.status = %s"
        params.append(status_filter)
    if seller_filter:
        base += " AND d.seller_name LIKE %s"
        params.append(f"%{seller_filter}%")
    if installer_filter:
        base += " AND d.installer_name LIKE %s"
        params.append(f"%{installer_filter}%")
    if contract_type_filter:
        base += " AND d.contract_type = %s"
        params.append(contract_type_filter)
    if search_rfc:
        # Busca tanto en el RFC del dispositivo como en la razón social
        base += " AND (d.rfc LIKE %s OR d.razon_social LIKE %s)"
        params.extend([f"%{search_rfc}%", f"%{search_rfc}%"])
    if search_custom:
        # Busca por etiqueta o valor de cualquier campo personalizado asociado al dispositivo
        base += """ AND d.id IN (
            SELECT device_id FROM custom_fields
            WHERE field_label LIKE %s OR field_value LIKE %s
        )"""
        params.extend([f"%{search_custom}%", f"%{search_custom}%"])
    if expiring_days is not None:
        today = date.today()
        limit = today + timedelta(days=int(expiring_days))
        base += " AND d.expiration_date >= %s AND d.expiration_date <= %s"
        params.extend([today.isoformat(), limit.isoformat()])
    if expire_from:
        base += " AND d.expiration_date >= %s"
        params.append(expire_from)
    if expire_to:
        base += " AND d.expiration_date <= %s"
        params.append(expire_to)

    count_sql = "SELECT COUNT(*) as cnt " + base
    await cur.execute(count_sql, params)
    count_row = await cur.fetchone()
    total = int(count_row["cnt"]) if count_row else 0

    sql = "SELECT d.* " + base + " ORDER BY d.client_name, d.device_name"
    offset = (page - 1) * page_size
    sql += " LIMIT %s OFFSET %s"
    params.extend([page_size, offset])

    await cur.execute(sql, params)
    rows = await cur.fetchall()
    devices = [_enrich_row(dict(r)) for r in rows]

    # Enriquecer con campos personalizados en una sola consulta (evita N+1)
    if devices:
        ids = [d["id"] for d in devices]
        placeholders = ",".join(["%s"] * len(ids))
        await cur.execute(
            f"SELECT device_id, field_key, field_label, field_type, field_value "
            f"FROM custom_fields WHERE device_id IN ({placeholders}) ORDER BY id",
            ids
        )
        cf_rows = await cur.fetchall()
        by_device = {}
        for f in cf_rows:
            by_device.setdefault(f["device_id"], []).append({
                "field_key": f["field_key"], "field_label": f["field_label"],
                "field_type": f["field_type"], "field_value": f["field_value"],
            })
        for d in devices:
            d["custom_fields"] = by_device.get(d["id"], [])

    return {"devices": devices, "total": total, "page": page, "page_size": page_size}


async def get_device_by_id(cur, device_id: int):
    await cur.execute("SELECT * FROM devices WHERE id=%s", (device_id,))
    row = await cur.fetchone()
    if row:
        row = _enrich_row(dict(row))
        # Incluir campos personalizados
        await cur.execute(
            "SELECT field_key, field_label, field_type, field_value FROM custom_fields WHERE device_id=%s ORDER BY id",
            (device_id,)
        )
        cf = await cur.fetchall()
        row["custom_fields"] = [dict(f) for f in cf]
    return row


async def get_devices_by_client(cur, client_fulltrack_id: str):
    await cur.execute(
        "SELECT * FROM devices WHERE client_fulltrack_id=%s ORDER BY device_name",
        (client_fulltrack_id,)
    )
    rows = await cur.fetchall()
    return [_enrich_row(dict(r)) for r in rows]


async def get_client_billing_by_rfc(cur, client_fulltrack_id: str):
    """Agrupa la facturación mensual del cliente por RFC / razón social.

    Permite que un mismo cliente (ej. 'Alex') con varios vehículos, donde cada
    vehículo puede facturarse a un RFC/razón social distinto, muestre cuánto se
    le factura a cada RFC de forma independiente además del total general.
    """
    await cur.execute(
        """SELECT rfc, razon_social, monthly_price, client_name
           FROM devices
           WHERE client_fulltrack_id=%s AND status <> 'deactivated'""",
        (client_fulltrack_id,)
    )
    rows = await cur.fetchall()

    groups: dict = {}
    client_name = None
    total_general = 0.0
    for r in rows:
        client_name = r["client_name"] or client_name
        price = float(r["monthly_price"]) if r["monthly_price"] is not None else 0.0
        rfc = (r["rfc"] or "").strip() or None
        razon_social = (r["razon_social"] or "").strip() or None
        key = (rfc, razon_social) if (rfc or razon_social) else ("__sin_asignar__", None)
        if key not in groups:
            groups[key] = {"rfc": rfc, "razon_social": razon_social, "device_count": 0, "total": 0.0}
        groups[key]["device_count"] += 1
        groups[key]["total"] += price
        total_general += price

    group_list = sorted(groups.values(), key=lambda g: (g["rfc"] is None, g["rfc"] or "", g["razon_social"] or ""))
    return {
        "client_fulltrack_id": client_fulltrack_id,
        "client_name": client_name or client_fulltrack_id,
        "groups": group_list,
        "total_general": round(total_general, 2),
    }


# ─── Update device details ────────────────────────────────────────────────────

async def update_device_details(cur, device_id: int, data: dict) -> bool:
    # Campos actualizables
    fields = ["contract_type", "seller_name", "installer_name", "install_date", "monthly_price", "rfc", "razon_social"]
    updates = {k: v for k, v in data.items() if k in fields and v is not None}

    # Auto-calcular vencimiento si se pide
    if data.get("auto_compute_expiration") and updates.get("contract_type"):
        base = updates.get("install_date") or data.get("install_date")
        if not base:
            await cur.execute("SELECT install_date, registration_date FROM devices WHERE id=%s", (device_id,))
            row = await cur.fetchone()
            if row:
                base = row["install_date"] or row["registration_date"]
        if base:
            if isinstance(base, str):
                base = date.fromisoformat(base)
            updates["expiration_date"] = compute_expiration_from_contract(updates["contract_type"], base)

    if not updates:
        return True

    set_clause = ", ".join(f"{k}=%s" for k in updates)
    await cur.execute(f"UPDATE devices SET {set_clause} WHERE id=%s", (*updates.values(), device_id))

    # Recalcular status si cambió la fecha de vencimiento
    if "expiration_date" in updates:
        await cur.execute(
            "SELECT expiration_date, client_liberado, status FROM devices WHERE id=%s", (device_id,)
        )
        row = await cur.fetchone()
        if row:
            new_status = _compute_status(row["expiration_date"], row["client_liberado"], row["status"])
            await cur.execute("UPDATE devices SET status=%s WHERE id=%s", (new_status, device_id))
    return True


async def upsert_custom_field(cur, device_id: int, field_key: str, field_label: str, field_type: str, field_value: str):
    await cur.execute("""
        INSERT INTO custom_fields (device_id, field_key, field_label, field_type, field_value)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            field_label = VALUES(field_label),
            field_type  = VALUES(field_type),
            field_value = VALUES(field_value)
    """, (device_id, field_key, field_label, field_type, field_value))


async def delete_custom_field(cur, device_id: int, field_key: str):
    await cur.execute(
        "DELETE FROM custom_fields WHERE device_id=%s AND field_key=%s", (device_id, field_key)
    )


# ─── Expiration ───────────────────────────────────────────────────────────────

async def update_expiration(cur, device_id: int, new_date) -> bool:
    await cur.execute("UPDATE devices SET expiration_date=%s WHERE id=%s", (new_date, device_id))
    await cur.execute(
        "SELECT expiration_date, client_liberado, status FROM devices WHERE id=%s", (device_id,)
    )
    row = await cur.fetchone()
    if not row:
        return False
    new_status = _compute_status(row["expiration_date"], row["client_liberado"], row["status"])
    await cur.execute("UPDATE devices SET status=%s WHERE id=%s", (new_status, device_id))
    return True


# ─── Toggle / Status ──────────────────────────────────────────────────────────

async def update_device_status(cur, device_id: int, new_status: str):
    await cur.execute("UPDATE devices SET status=%s WHERE id=%s", (new_status, device_id))

async def update_device_install_info(cur, device_id: int, ins_id, vei_id):
    await cur.execute(
        "UPDATE devices SET ras_ins_id=%s, vehicle_id=COALESCE(%s, vehicle_id) WHERE id=%s",
        (ins_id, vei_id, device_id)
    )

async def update_client_devices_status(cur, client_fulltrack_id: str, new_status: str):
    await cur.execute(
        "UPDATE devices SET status=%s WHERE client_fulltrack_id=%s",
        (new_status, client_fulltrack_id)
    )

async def bulk_update_status(cur, device_ids: list, new_status: str):
    if not device_ids:
        return 0
    placeholders = ",".join(["%s"] * len(device_ids))
    await cur.execute(
        f"UPDATE devices SET status=%s WHERE id IN ({placeholders})",
        [new_status, *device_ids]
    )
    return len(device_ids)


# ─── Client config ────────────────────────────────────────────────────────────

async def get_client_config(cur, client_fulltrack_id: str) -> dict:
    await cur.execute(
        "SELECT * FROM client_config WHERE client_fulltrack_id=%s", (client_fulltrack_id,)
    )
    row = await cur.fetchone()
    if row:
        d = dict(row)
        d.setdefault("whatsapp_number", None)
        return d
    return {
        "client_fulltrack_id": client_fulltrack_id,
        "client_name":         None,
        "grace_days":          0,
        "auto_deactivate":     True,
        "whatsapp_number":     None,
    }

async def upsert_client_config(
    cur,
    client_fulltrack_id: str,
    grace_days: int,
    auto_deactivate: bool,
    client_name: str = None,
    whatsapp_number=...,  # sentinel: ... = no tocar; None = borrar; str = guardar
):
    """
    whatsapp_number=...   (default) -> no modifica el numero existente
    whatsapp_number=None            -> borra el numero (guarda NULL)
    whatsapp_number="..."           -> guarda el nuevo numero
    """
    wa_provided = whatsapp_number is not ...
    wa_value = (
        whatsapp_number.strip()
        if isinstance(whatsapp_number, str) and whatsapp_number.strip()
        else None
    ) if wa_provided else None

    # Verificar si ya existe el registro
    await cur.execute(
        "SELECT id FROM client_config WHERE client_fulltrack_id=%s", (client_fulltrack_id,)
    )
    exists = await cur.fetchone()

    if exists:
        set_parts = [
            "grace_days      = %s",
            "auto_deactivate = %s",
            "client_name     = COALESCE(%s, client_name)",
        ]
        params = [grace_days, int(auto_deactivate), client_name]
        if wa_provided:
            set_parts.append("whatsapp_number = %s")
            params.append(wa_value)
        params.append(client_fulltrack_id)
        await cur.execute(
            f"UPDATE client_config SET {', '.join(set_parts)} WHERE client_fulltrack_id = %s",
            params
        )
    else:
        await cur.execute("""
            INSERT INTO client_config
                (client_fulltrack_id, client_name, grace_days, auto_deactivate, whatsapp_number)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            client_fulltrack_id,
            client_name,
            grace_days,
            int(auto_deactivate),
            wa_value if wa_provided else None,
        ))

async def get_all_client_configs(cur) -> list:
    await cur.execute("""
        SELECT cc.*, 
               COUNT(d.id) as total_devices
        FROM client_config cc
        LEFT JOIN devices d ON d.client_fulltrack_id = cc.client_fulltrack_id
        GROUP BY cc.id
        ORDER BY cc.client_name
    """)
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ─── Scheduler (auto-deactivation) ───────────────────────────────────────────

async def run_auto_deactivation_scheduler(cur) -> dict:
    """
    Evalúa dispositivos expirados y desactiva los que superaron el período de carencia.
    Retorna cuántos fueron desactivados.
    """
    today = date.today()
    deactivated_count = 0
    skipped_count = 0

    # Obtener dispositivos expirados que aún no están desactivados
    await cur.execute("""
        SELECT d.id, d.client_fulltrack_id, d.expiration_date, d.client_name,
               COALESCE(cc.grace_days, 0) as grace_days,
               COALESCE(cc.auto_deactivate, 1) as auto_deactivate
        FROM devices d
        LEFT JOIN client_config cc ON cc.client_fulltrack_id = d.client_fulltrack_id
        WHERE d.status = 'expired'
          AND d.expiration_date IS NOT NULL
    """)
    rows = await cur.fetchall()

    for row in rows:
        if not row["auto_deactivate"]:
            skipped_count += 1
            continue
        grace_days = int(row["grace_days"] or 0)
        exp_date = row["expiration_date"]
        if isinstance(exp_date, str):
            exp_date = date.fromisoformat(exp_date)
        cutoff = exp_date + timedelta(days=grace_days)
        if today >= cutoff:
            await cur.execute(
                "UPDATE devices SET status='deactivated' WHERE id=%s", (row["id"],)
            )
            deactivated_count += 1
        else:
            skipped_count += 1

    return {
        "deactivated": deactivated_count,
        "skipped_grace": skipped_count,
        "evaluated": len(rows),
    }


# ─── Stats ────────────────────────────────────────────────────────────────────

async def get_stats(cur, tenant_id=None, client_scope=None):
    today = date.today()
    first_day = today.replace(day=1)
    if today.month == 12:
        last_day = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        last_day = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    tenant_filter = "AND tenant_id = %s" if tenant_id is not None else ""
    scope_filter = ""
    params = [first_day.isoformat(), last_day.isoformat()]
    if tenant_id is not None:
        params.append(tenant_id)
    if client_scope:
        placeholders = ",".join(["%s"] * len(client_scope))
        scope_filter = f" AND client_fulltrack_id IN ({placeholders})"
        params.extend(client_scope)

    await cur.execute(f"""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status='active'      THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status='expiring'    THEN 1 ELSE 0 END) as expiring,
            SUM(CASE WHEN status='expired'     THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN status='deactivated' THEN 1 ELSE 0 END) as deactivated,
            SUM(CASE WHEN expiration_date >= %s AND expiration_date <= %s THEN 1 ELSE 0 END) as expiring_this_month
        FROM devices
        WHERE 1=1 {tenant_filter} {scope_filter}
    """, params)
    row = await cur.fetchone()
    return {
        "total":               int(row["total"] or 0),
        "active":              int(row["active"] or 0),
        "expiring":            int(row["expiring"] or 0),
        "expired":             int(row["expired"] or 0),
        "deactivated":         int(row["deactivated"] or 0),
        "expiring_this_month": int(row["expiring_this_month"] or 0),
    }

async def get_monthly_expirations(cur, tenant_id=None, client_scope=None):
    today = date.today()
    end = today.replace(year=today.year + 1)
    tenant_filter = "AND tenant_id = %s" if tenant_id is not None else ""
    scope_filter = ""
    params = [today.isoformat(), end.isoformat()]
    if tenant_id is not None:
        params.append(tenant_id)
    if client_scope:
        placeholders = ",".join(["%s"] * len(client_scope))
        scope_filter = f" AND client_fulltrack_id IN ({placeholders})"
        params.extend(client_scope)
    await cur.execute(f"""
        SELECT DATE_FORMAT(expiration_date, '%%Y-%%m') as month, COUNT(*) as count
        FROM devices
        WHERE expiration_date >= %s AND expiration_date <= %s {tenant_filter} {scope_filter}
        GROUP BY month ORDER BY month
    """, params)
    rows = await cur.fetchall()
    return [{"month": r["month"], "count": int(r["count"])} for r in rows]

async def get_seller_stats(cur, tenant_id=None, client_scope=None) -> list:
    conditions, params = [], []
    if tenant_id is not None:
        conditions.append("tenant_id = %s")
        params.append(tenant_id)
    if client_scope:
        placeholders = ",".join(["%s"] * len(client_scope))
        conditions.append(f"client_fulltrack_id IN ({placeholders})")
        params.extend(client_scope)
    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    await cur.execute(f"""
        SELECT
            COALESCE(seller_name, 'Sin asignar') as seller_name,
            COUNT(*) as total,
            SUM(CASE WHEN status='active'      THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status='expiring'    THEN 1 ELSE 0 END) as expiring,
            SUM(CASE WHEN status='expired'     THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN status='deactivated' THEN 1 ELSE 0 END) as deactivated,
            SUM(CASE WHEN status != 'deactivated' THEN COALESCE(monthly_price, 0) ELSE 0 END) as monthly_revenue
        FROM devices
        {where_clause}
        GROUP BY COALESCE(seller_name, 'Sin asignar')
        ORDER BY total DESC
    """, params)
    rows = await cur.fetchall()
    return [
        {
            "seller_name": r["seller_name"],
            "total": int(r["total"]),
            "active": int(r["active"]),
            "expiring": int(r["expiring"]),
            "expired": int(r["expired"]),
            "deactivated": int(r["deactivated"]),
            "monthly_revenue": float(r["monthly_revenue"] or 0),
        }
        for r in rows
    ]


# ─── Invoice preview ──────────────────────────────────────────────────────────

async def get_invoice_preview(cur, client_fulltrack_id: str) -> dict:
    await cur.execute("""
        SELECT id, device_name, plate, imei, contract_type, monthly_price, status, expiration_date
        FROM devices
        WHERE client_fulltrack_id=%s AND status != 'deactivated'
        ORDER BY device_name
    """, (client_fulltrack_id,))
    rows = await cur.fetchall()
    items = []
    subtotals: dict = {}
    total = 0.0
    client_name = ""

    for r in rows:
        r = dict(r)
        price = float(r.get("monthly_price") or 0)
        ct = r.get("contract_type") or "sin_tipo"
        subtotals[ct] = subtotals.get(ct, 0.0) + price
        total += price
        if not client_name and r.get("client_name"):
            client_name = r["client_name"]
        items.append({
            "device_id": r["id"],
            "device_name": r.get("device_name"),
            "plate": r.get("plate"),
            "imei": r["imei"],
            "contract_type": r.get("contract_type"),
            "monthly_price": price,
            "status": r.get("status"),
            "expiration_date": r.get("expiration_date"),
        })

    # Get client name from any device
    if not client_name and items:
        await cur.execute(
            "SELECT client_name FROM devices WHERE client_fulltrack_id=%s LIMIT 1",
            (client_fulltrack_id,)
        )
        row = await cur.fetchone()
        if row:
            client_name = row["client_name"]

    return {
        "client_fulltrack_id": client_fulltrack_id,
        "client_name": client_name,
        "items": items,
        "subtotal_by_type": subtotals,
        "total": round(total, 2),
        "total_devices": len(items),
    }


# ─── Export data ──────────────────────────────────────────────────────────────

async def get_custom_fields_bulk(cur, device_ids: list) -> dict:
    """Devuelve {device_id: [{field_key, field_label, field_value}, ...]}
    para una lista de dispositivos, en una sola consulta."""
    if not device_ids:
        return {}
    placeholders = ",".join(["%s"] * len(device_ids))
    await cur.execute(
        f"SELECT device_id, field_key, field_label, field_type, field_value "
        f"FROM custom_fields WHERE device_id IN ({placeholders}) ORDER BY id",
        device_ids
    )
    by_device = {}
    for f in await cur.fetchall():
        by_device.setdefault(f["device_id"], []).append({
            "field_key": f["field_key"], "field_label": f["field_label"],
            "field_type": f["field_type"], "field_value": f["field_value"],
        })
    return by_device


async def get_export_data(cur, status_filter=None, seller_filter=None, contract_type_filter=None,
                          expire_from=None, expire_to=None, expiring_days=None, tenant_id=None,
                          search_client=None, search_imei=None, search_device=None,
                          search_rfc=None, search_custom=None, client_scope=None) -> list:
    sql = "SELECT * FROM devices WHERE 1=1"
    params = []

    if tenant_id is not None:
        sql += " AND tenant_id = %s"
        params.append(tenant_id)
    if client_scope:
        placeholders = ",".join(["%s"] * len(client_scope))
        sql += f" AND client_fulltrack_id IN ({placeholders})"
        params.extend(client_scope)
    if search_client:
        sql += " AND client_name LIKE %s"
        params.append(f"%{search_client}%")
    if search_imei:
        sql += " AND imei LIKE %s"
        params.append(f"%{search_imei}%")
    if search_device:
        sql += " AND (device_name LIKE %s OR plate LIKE %s OR sim LIKE %s)"
        params.extend([f"%{search_device}%", f"%{search_device}%", f"%{search_device}%"])
    if status_filter and status_filter != "all":
        sql += " AND status = %s"
        params.append(status_filter)
    if seller_filter:
        sql += " AND seller_name LIKE %s"
        params.append(f"%{seller_filter}%")
    if contract_type_filter:
        sql += " AND contract_type = %s"
        params.append(contract_type_filter)
    if search_rfc:
        sql += " AND (rfc LIKE %s OR razon_social LIKE %s)"
        params.extend([f"%{search_rfc}%", f"%{search_rfc}%"])
    if search_custom:
        sql += """ AND id IN (
            SELECT device_id FROM custom_fields
            WHERE field_label LIKE %s OR field_value LIKE %s
        )"""
        params.extend([f"%{search_custom}%", f"%{search_custom}%"])
    if expiring_days is not None:
        today = date.today()
        limit = today + timedelta(days=int(expiring_days))
        sql += " AND expiration_date >= %s AND expiration_date <= %s"
        params.extend([today.isoformat(), limit.isoformat()])
    if expire_from:
        sql += " AND expiration_date >= %s"
        params.append(expire_from)
    if expire_to:
        sql += " AND expiration_date <= %s"
        params.append(expire_to)

    sql += " ORDER BY client_name, device_name"
    await cur.execute(sql, params)
    rows = await cur.fetchall()
    return [_enrich_row(dict(r)) for r in rows]