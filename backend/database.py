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
                    ras_ins_id           VARCHAR(50) DEFAULT NULL,
                    whatsapp_number      VARCHAR(20) DEFAULT NULL,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_imei_tenant (imei, tenant_id),
                    INDEX idx_client     (client_fulltrack_id),
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

            await conn.commit()
            print("Base de datos inicializada")

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
                ("tenant_id",       "INT DEFAULT NULL"),
                ("whatsapp_number", "VARCHAR(20) DEFAULT NULL"),
            ]
            for col, definition in migrations:
                try:
                    await cur.execute(f"ALTER TABLE devices ADD COLUMN {col} {definition}")
                    print(f"Columna devices.{col} agregada")
                except Exception:
                    pass

            # Migración: whatsapp_number en client_config
            try:
                await cur.execute(
                    "ALTER TABLE client_config ADD COLUMN whatsapp_number VARCHAR(20) DEFAULT NULL"
                )
                print("Columna client_config.whatsapp_number agregada")
            except Exception:
                pass  # ya existe

            await conn.commit()