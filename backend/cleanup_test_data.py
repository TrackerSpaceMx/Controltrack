"""
Script para limpiar los datos del tenant de prueba.
Ejecutar UNA SOLA VEZ: python cleanup_test_data.py
"""
import asyncio
import aiomysql
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup():
    conn = await aiomysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "12345678"),
        db=os.getenv("DB_NAME", "controltrack"),
        autocommit=True,
        charset="utf8mb4",
    )
    async with conn.cursor() as cur:
        # Borrar datos de dispositivos que no tienen tenant_id asignado
        # (son los del cliente prueba que sincronizaste con el .env global)
        await cur.execute("SELECT COUNT(*) FROM devices WHERE tenant_id IS NULL")
        row = await cur.fetchone()
        count = row[0]
        print(f"Dispositivos sin tenant asignado (prueba): {count}")

        if count > 0:
            confirm = input(f"¿Eliminar {count} dispositivos de prueba? (escribe 'si' para confirmar): ")
            if confirm.strip().lower() == "si":
                await cur.execute("DELETE FROM devices WHERE tenant_id IS NULL")
                await cur.execute("DELETE FROM client_config WHERE tenant_id IS NULL")
                await cur.execute("DELETE FROM custom_fields WHERE device_id NOT IN (SELECT id FROM devices)")
                print(f"✅ {count} dispositivos eliminados.")
            else:
                print("Cancelado.")
        else:
            print("No hay datos de prueba que limpiar.")

    conn.close()

asyncio.run(cleanup())