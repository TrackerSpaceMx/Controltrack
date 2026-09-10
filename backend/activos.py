"""
Módulo "Activos" (posiciones GPS en vivo).
------------------------------------------
Portado de Holkan-Services, adaptado para ControlTrack:
  - Usa las llaves ft_apikey/ft_secretkey propias de cada tenant (no un
    .env global), así que funciona para cualquier tenant que se habilite.
  - El caché de "última posición válida" vive en MySQL (tabla
    activos_last_position) en vez de un JSON en disco, porque el backend
    corre con varios workers de gunicorn.
  - Está pensado para llamarse SOLO cuando el tenant tiene
    activos_enabled=1 (ese chequeo se hace en main.py, no aquí).
"""
import os
import httpx
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import crud_tenants

TZ_UTC = ZoneInfo("UTC")
TZ_MEXICO = ZoneInfo("America/Mexico_City")
FORMATO_FECHA_API = "%d/%m/%Y %H:%M:%S"


def convertir_utc_a_mexico(fecha_str: str) -> str:
    if not fecha_str:
        return fecha_str
    try:
        dt_utc = datetime.strptime(fecha_str, FORMATO_FECHA_API).replace(tzinfo=TZ_UTC)
        return dt_utc.astimezone(TZ_MEXICO).strftime(FORMATO_FECHA_API)
    except (ValueError, TypeError):
        return fecha_str


def fecha_a_epoch(fecha_str: str) -> int:
    if not fecha_str:
        return 0
    try:
        return int(datetime.strptime(fecha_str, FORMATO_FECHA_API).replace(tzinfo=TZ_UTC).timestamp())
    except (ValueError, TypeError):
        return 0


def gps_valido(lat, lon) -> bool:
    try:
        return not (float(lat) == 0.0 and float(lon) == 0.0)
    except (TypeError, ValueError):
        return False


def _to_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _formatear_horas(segundos_raw):
    try:
        total = int(float(segundos_raw))
    except (TypeError, ValueError):
        return "00:00:00"
    h, resto = divmod(total, 3600)
    m, s = divmod(resto, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def normalizar_vehiculo(item: dict, cache_posiciones: dict) -> dict:
    """Misma lógica que Holkan-Services, incluyendo el fallback a la
    última posición válida cuando el dato más reciente trae lat=0/lon=0."""
    vehiculo_id = item.get("ras_vei_id") or item.get("ras_ras_id_aparelho") or item.get("ras_ras_id")

    lat_actual = item.get("ras_eve_latitude")
    lon_actual = item.get("ras_eve_longitude")
    actual_valida = gps_valido(lat_actual, lon_actual)

    nueva_posicion_valida = None  # si no es None, hay que persistirla en el caché

    if actual_valida:
        lat, lon = lat_actual, lon_actual
        posicion_obsoleta = False
        fecha_posicion = item.get("ras_eve_data_gps") or ""
        nueva_posicion_valida = (str(vehiculo_id), lat, lon, fecha_posicion)
    else:
        anterior = cache_posiciones.get(str(vehiculo_id))
        if anterior:
            lat, lon = anterior.get("lat"), anterior.get("lon")
            fecha_posicion = anterior.get("fecha_gps") or ""
            posicion_obsoleta = True
        else:
            lat, lon = None, None
            fecha_posicion = ""
            posicion_obsoleta = True

    outputs = item.get("ras_eve_output") or []
    bloqueado = len(outputs) > 1 and str(outputs[1]) == "1"

    conductor = item.get("ras_mot_nome") or ""
    if conductor.strip().upper() in ("", "PADRAO", "PADRÃO"):
        conductor = "Sin asignar"

    return {
        "vehiculo_id": vehiculo_id,
        "imei": item.get("ras_ras_id_aparelho") or "",
        "ultima_comunicacion": convertir_utc_a_mexico(item.get("ras_ras_data_ult_comunicacao") or ""),
        "ultima_comunicacion_ts": fecha_a_epoch(item.get("ras_ras_data_ult_comunicacao") or ""),
        "fecha_gps": convertir_utc_a_mexico(item.get("ras_eve_data_gps") or ""),
        "gps_ok": str(item.get("ras_eve_gps_status", "0")) == "1"
        or str(item.get("ras_ras_sinal_gps", "0")) == "1",
        "velocidad": _to_int(item.get("ras_eve_velocidade")),
        "ignicion_on": str(item.get("ras_eve_ignicao", "0")) == "1",
        "bloqueado": bloqueado,
        "latitud": lat,
        "longitud": lon,
        "posicion_obsoleta": posicion_obsoleta,
        "fecha_posicion": convertir_utc_a_mexico(fecha_posicion),
        "bateria_v": item.get("ras_eve_voltagem") or "0",
        "porcentaje_bateria": _to_int(item.get("ras_eve_porc_bat_backup")),
        "satelites": _to_int(item.get("ras_eve_satelites")),
        "producto": item.get("ras_prd_desc") or item.get("ras_prd_id") or "-",
        "conductor": conductor,
        "odometro": item.get("ras_eve_hodometro") or "0",
        "horometro": _formatear_horas(item.get("ras_eve_horimetro")),
        "_nueva_posicion_valida": nueva_posicion_valida,  # uso interno, no se manda al frontend
    }


async def obtener_activos(db, tenant_id: int, ft_apikey: str, ft_secretkey: str,
                           base_url: str = "http://ws.fulltrack2.com") -> list:
    """Llama a la API de Fulltrack con LAS LLAVES DEL TENANT, normaliza y
    actualiza el caché de última posición válida en MySQL."""
    url = f"{base_url}/events/all/apiKey/{ft_apikey}/secretKey/{ft_secretkey}"

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url)
        r.raise_for_status()
        payload = r.json()

    raw_data = payload.get("data", []) if isinstance(payload, dict) else []
    cache_posiciones = await crud_tenants.get_last_positions(db, tenant_id)

    resultado = []
    for item in raw_data:
        normalizado = normalizar_vehiculo(item, cache_posiciones)
        nueva = normalizado.pop("_nueva_posicion_valida", None)
        if nueva:
            vid, lat, lon, fecha_gps = nueva
            await crud_tenants.upsert_last_position(db, tenant_id, vid, lat, lon, fecha_gps)
        resultado.append(normalizado)

    return resultado


# ─── Geocodificación inversa (misma lógica/orden de proveedores que Holkan) ───

async def geocodificar(lat: str, lon: str) -> str:
    google_key   = os.getenv("GOOGLE_MAPS_API_KEY", "")
    mapbox_token = os.getenv("MAPBOX_ACCESS_TOKEN", "")
    locationiq   = os.getenv("LOCATIONIQ_API_KEY", "")

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            if google_key:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"latlng": f"{lat},{lon}", "key": google_key},
                )
                data = r.json()
                if data.get("results"):
                    return data["results"][0]["formatted_address"]

            elif mapbox_token:
                r = await client.get(
                    f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json",
                    params={"access_token": mapbox_token},
                )
                data = r.json()
                if data.get("features"):
                    return data["features"][0]["place_name"]

            elif locationiq:
                r = await client.get(
                    "https://us1.locationiq.com/v1/reverse",
                    params={"key": locationiq, "lat": lat, "lon": lon, "format": "json"},
                )
                data = r.json()
                if data.get("display_name"):
                    return data["display_name"]

            else:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                    headers={"User-Agent": "ControlTrack/1.0"},
                )
                data = r.json()
                if data.get("display_name"):
                    return data["display_name"]
        except Exception:
            pass

    return "Dirección no disponible"