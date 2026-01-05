"""
Script de migración para agregar el campo veces_alquilado a la tabla Productos
"""
import sys
import os

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pony.orm import db_session
from decouple import config
from src.db import db as database

def aplicar_migracion():
    """Aplica la migración para agregar el campo veces_alquilado"""
    
    # Conectar a la base de datos
    database.generate_mapping(create_tables=False)
    
    # Verificar el proveedor de la base de datos
    provider = config("DB_PROVIDER", default="postgres").lower()
    
    if provider in {"postgres", "postgresql"}:
        # Para PostgreSQL
        try:
            with db_session:
                # Intentar agregar la columna
                database.execute('ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "veces_alquilado" INTEGER DEFAULT 0')
                # Actualizar productos existentes
                database.execute('UPDATE "Productos" SET "veces_alquilado" = 0 WHERE "veces_alquilado" IS NULL')
                print("OK: Migración aplicada correctamente para PostgreSQL")
        except Exception as e:
            # Si la columna ya existe, ignorar el error
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("OK: La columna veces_alquilado ya existe")
            else:
                print(f"ADVERTENCIA: Error al aplicar migración: {e}")
                print("Puede que la columna ya exista. Verifica manualmente.")
    else:
        # Para SQLite (no soporta IF NOT EXISTS en ALTER TABLE)
        try:
            with db_session:
                # Intentar agregar la columna (fallará si ya existe)
                database.execute('ALTER TABLE "Productos" ADD COLUMN "veces_alquilado" INTEGER DEFAULT 0')
                database.execute('UPDATE "Productos" SET "veces_alquilado" = 0 WHERE "veces_alquilado" IS NULL')
                print("OK: Migración aplicada correctamente para SQLite")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("OK: La columna veces_alquilado ya existe")
            else:
                print(f"ADVERTENCIA: Error al aplicar migración: {e}")
                print("Puede que la columna ya exista. Verifica manualmente.")

if __name__ == '__main__':
    try:
        aplicar_migracion()
    except Exception as e:
        print(f"ERROR al aplicar migración: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

