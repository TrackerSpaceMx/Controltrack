import aiomysql
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "12345678")
DB_NAME = os.getenv("DB_NAME", "controltrack")

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await aiomysql.create_pool(
            host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS,
            db=DB_NAME, autocommit=True, charset="utf8mb4", minsize=2, maxsize=10,
        )
    return _pool

async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            yield cur

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:

            # ── Tenants (empresas que usan ControlTrack) ────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    name            VARCHAR(255) NOT NULL,
                    ft_apikey       VARCHAR(255) NOT NULL,
                    ft_secretkey    VARCHAR(255) NOT NULL,
                    active          TINYINT(1) DEFAULT 1,
                    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_apikey (ft_apikey)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Usuarios por tenant ─────────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id   INT NOT NULL,
                    username    VARCHAR(100) NOT NULL,
                    password    VARCHAR(255) NOT NULL,
                    full_name   VARCHAR(255),
                    role        ENUM('admin','operator','viewer') DEFAULT 'operator',
                    active      TINYINT(1) DEFAULT 1,
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user (tenant_id, username),
                    INDEX idx_tenant (tenant_id),
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Dispositivos ────────────────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS devices (
                    id                   INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id            INT DEFAULT NULL,
                    tracker_id           VARCHAR(50)  NOT NULL,
                    imei                 VARCHAR(50)  NOT NULL,
                    client_fulltrack_id  VARCHAR(50)  NOT NULL,
                    vehicle_id           VARCHAR(50),
                    client_name          VARCHAR(255) NOT NULL,
                    device_name          VARCHAR(255),
                    plate                VARCHAR(100),
                    model                VARCHAR(100),
                    sim                  VARCHAR(50),
                    registration_date    DATE,
                    expiration_date      DATE,
                    status               ENUM('active','expiring','expired','deactivated') DEFAULT 'active',
                    client_liberado      CHAR(1) DEFAULT 'S',
                    contract_type        ENUM('monthly','quarterly','semiannual','annual','lease') DEFAULT NULL,
                    seller_name          VARCHAR(255) DEFAULT NULL,
                    installer_name       VARCHAR(255) DEFAULT NULL,
                    install_date         DATE DEFAULT NULL,
                    monthly_price        DECIMAL(10,2) DEFAULT NULL,
                    rfc                  VARCHAR(20) DEFAULT NULL,
                    razon_social         VARCHAR(255) DEFAULT NULL,
                    ras_ins_id           VARCHAR(50) DEFAULT NULL,
                    whatsapp_number      VARCHAR(20) DEFAULT NULL,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_imei_tenant (imei, tenant_id),
                    INDEX idx_client     (client_fulltrack_id),
                    INDEX idx_rfc        (rfc),
                    INDEX idx_status     (status),
                    INDEX idx_expiration (expiration_date),
                    INDEX idx_tenant     (tenant_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Config por cliente final ────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS client_config (
                    id                   INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id            INT DEFAULT NULL,
                    client_fulltrack_id  VARCHAR(50) NOT NULL,
                    client_name          VARCHAR(255),
                    grace_days           INT DEFAULT 0,
                    auto_deactivate      TINYINT(1) DEFAULT 1,
                    whatsapp_number      VARCHAR(20) DEFAULT NULL,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_cfg (tenant_id, client_fulltrack_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Campos personalizados ───────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS custom_fields (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    device_id   INT NOT NULL,
                    field_key   VARCHAR(100) NOT NULL,
                    field_label VARCHAR(100) NOT NULL,
                    field_type  ENUM('text','number','date') DEFAULT 'text',
                    field_value TEXT,
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_device_key (device_id, field_key),
                    INDEX idx_device (device_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Historial de notificaciones WhatsApp ────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS whatsapp_notifications (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id       INT DEFAULT NULL,
                    device_id       INT NOT NULL,
                    client_name     VARCHAR(255),
                    phone_number    VARCHAR(20),
                    message_sid     VARCHAR(100),
                    status          ENUM('sent','failed','pending') DEFAULT 'pending',
                    days_before     INT DEFAULT 0,
                    sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_device (device_id),
                    INDEX idx_tenant (tenant_id),
                    INDEX idx_sent   (sent_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)


            await cur.execute("""
                CREATE TABLE IF NOT EXISTS alert_configuration (
                    id                    INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id             INT NOT NULL,
                    warning_time_value    INT NOT NULL DEFAULT 10,
                    warning_time_unit     ENUM('minutes','hours','days') NOT NULL DEFAULT 'hours',
                    alert_time_value      INT NOT NULL DEFAULT 2,
                    alert_time_unit       ENUM('minutes','hours','days') NOT NULL DEFAULT 'days',
                    notification_channel  ENUM('whatsapp','email','both') NOT NULL DEFAULT 'whatsapp',
                    phone_number          VARCHAR(20) DEFAULT NULL,
                    email                 VARCHAR(255) DEFAULT NULL,
                    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_tenant_alert (tenant_id),
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)


            # ── Caché de última posición GPS válida (módulo "Activos") ──────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS activos_last_position (
                    tenant_id    INT NOT NULL,
                    vehiculo_id  VARCHAR(50) NOT NULL,
                    lat          VARCHAR(50),
                    lon          VARCHAR(50),
                    fecha_gps    VARCHAR(50),
                    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (tenant_id, vehiculo_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Caché de geocodificación inversa (dirección por coordenada) ──
            # Clave por coordenada exacta, no por vehículo: si dos vehículos
            # están en el mismo lugar (ej. patio/base), comparten la dirección
            # ya geocodificada y no se vuelve a llamar al proveedor de mapas.
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS geocode_cache (
                    tenant_id  INT NOT NULL,
                    lat        VARCHAR(50) NOT NULL,
                    lon        VARCHAR(50) NOT NULL,
                    address    VARCHAR(500),
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (tenant_id, lat, lon)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Alcance de clientes por usuario (qué clientes puede ver) ─────
            # Sin filas para un usuario = sin restricción (ve todos los
            # clientes de su tenant, comportamiento actual sin cambios).
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS user_client_scope (
                    user_id             INT NOT NULL,
                    client_fulltrack_id VARCHAR(50) NOT NULL,
                    PRIMARY KEY (user_id, client_fulltrack_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            await cur.execute("""
                CREATE TABLE IF NOT EXISTS monitored_devices (
                    id                     INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id              INT NOT NULL,
                    imei                   VARCHAR(50) NOT NULL,
                    plate                  VARCHAR(100) DEFAULT NULL,
                    vehicle_name           VARCHAR(255) DEFAULT NULL,
                    active                 TINYINT(1) DEFAULT 0,
                    in_maintenance         TINYINT(1) DEFAULT 0,
                    last_signal_at         DATETIME DEFAULT NULL,
                    last_whatsapp_alert_at DATETIME DEFAULT NULL,
                    last_email_alert_at    DATETIME DEFAULT NULL,
                    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_tenant_imei (tenant_id, imei)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            await conn.commit()
            print("Base de datos inicializada")

async def migrate_tenants():
    """Migraciones aditivas sobre la tabla tenants. Igual patrón que migrate_db():
    ADD COLUMN envuelto en try/except, nunca DROP ni UPDATE masivo."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(
                    "ALTER TABLE tenants ADD COLUMN activos_enabled TINYINT(1) DEFAULT 0"
                )
                print("Columna tenants.activos_enabled agregada (default 0, no afecta tenants existentes)")
            except Exception:
                pass  # ya existe

            try:
                await cur.execute(
                    "ALTER TABLE users ADD COLUMN client_scope VARCHAR(255) DEFAULT NULL"
                )
                print("Columna users.client_scope agregada (default NULL = sin restricción, no afecta usuarios existentes)")
            except Exception:
                pass  # ya existe

            try:
                await cur.execute(
                    "ALTER TABLE tenants ADD COLUMN chassis_field_override VARCHAR(50) DEFAULT NULL"
                )
                print("Columna tenants.chassis_field_override agregada (default NULL = usa ras_vei_chassi normal)")
            except Exception:
                pass  # ya existe

            await conn.commit()

async def migrate_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            migrations = [
                ("ras_ins_id",      "VARCHAR(50) DEFAULT NULL"),
                ("sim",             "VARCHAR(50) DEFAULT NULL"),
                ("contract_type",   "ENUM('monthly','quarterly','semiannual','annual','lease') DEFAULT NULL"),
                ("seller_name",     "VARCHAR(255) DEFAULT NULL"),
                ("installer_name",  "VARCHAR(255) DEFAULT NULL"),
                ("install_date",    "DATE DEFAULT NULL"),
                ("monthly_price",   "DECIMAL(10,2) DEFAULT NULL"),
                ("rfc",             "VARCHAR(20) DEFAULT NULL"),
                ("razon_social",    "VARCHAR(255) DEFAULT NULL"),
                ("tenant_id",       "INT DEFAULT NULL"),
                ("whatsapp_number", "VARCHAR(20) DEFAULT NULL"),
                ("chassis",         "VARCHAR(50) DEFAULT NULL"),
                ("contracted_months", "INT DEFAULT NULL"),
            ]
            for col, definition in migrations:
                try:
                    await cur.execute(f"ALTER TABLE devices ADD COLUMN {col} {definition}")
                    print(f"Columna devices.{col} agregada")
                except Exception:
                    pass


            try:
                await cur.execute(
                    "ALTER TABLE client_config ADD COLUMN whatsapp_number VARCHAR(20) DEFAULT NULL"
                )
                print("Columna client_config.whatsapp_number agregada")
            except Exception:
                pass  # ya existe

            try:
                await cur.execute("ALTER TABLE devices ADD INDEX idx_rfc (rfc)")
                print("Índice devices.idx_rfc agregado")
            except Exception:
                pass  # ya existe

            await conn.commit()