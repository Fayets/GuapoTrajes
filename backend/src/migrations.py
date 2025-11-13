from decouple import config
from pony.orm import db_session
import logging

from src.db import db

logger = logging.getLogger(__name__)


def _is_postgres() -> bool:
    provider = config("DB_PROVIDER", default="postgres").lower()
    return provider in {"postgres", "postgresql"}


def apply_schema_migrations() -> None:
    """Aplica migraciones mínimas necesarias para el nuevo flujo financiero."""
    if not _is_postgres():
        return

    try:
        with db_session:
            # Migraciones para CajaChica
            alter_statements = [
                'ALTER TABLE "CajaChica" ADD COLUMN IF NOT EXISTS "metodo_pago" VARCHAR(32)',
                'ALTER TABLE "CajaChica" ADD COLUMN IF NOT EXISTS "tipo_egreso" VARCHAR(32)',
                'ALTER TABLE "CajaChica" ADD COLUMN IF NOT EXISTS "estado" VARCHAR(32)',
                'ALTER TABLE "CajaChica" ADD COLUMN IF NOT EXISTS "referencia" VARCHAR(255)',
                'ALTER TABLE "CajaChica" ADD COLUMN IF NOT EXISTS "caja_movimiento_id" INTEGER',
                'ALTER TABLE "CajaMovimientos" ADD COLUMN IF NOT EXISTS "destino" VARCHAR(255)',
                # Migraciones para CajaConcentradora
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "usuario_id" INTEGER',
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "tipo_movimiento" VARCHAR(32)',
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "origen" VARCHAR(32)',
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "destino" VARCHAR(32)',
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "estado" VARCHAR(32)',
                'ALTER TABLE "CajaConcentradora" ADD COLUMN IF NOT EXISTS "caja_movimiento_id" INTEGER',
            ]

            for statement in alter_statements:
                try:
                    db.execute(statement)
                except Exception as e:
                    # Ignorar errores si la columna ya existe o la tabla no existe aún
                    logger.debug(f"Error ejecutando migración (puede ser ignorado): {e}")

            # Actualizaciones de valores por defecto (solo si hay datos)
            update_statements = [
                'UPDATE "CajaChica" SET "metodo_pago" = \'EFECTIVO\' WHERE "metodo_pago" IS NULL',
                'UPDATE "CajaChica" SET "estado" = \'PENDIENTE\' WHERE "estado" IS NULL',
                # Actualizar valores por defecto en CajaConcentradora
                'UPDATE "CajaConcentradora" SET "tipo_movimiento" = \'INGRESO\' WHERE "tipo_movimiento" IS NULL',
                'UPDATE "CajaConcentradora" SET "origen" = \'Caja Diaria\' WHERE "origen" IS NULL',
                'UPDATE "CajaConcentradora" SET "estado" = \'Confirmado\' WHERE "estado" IS NULL',
            ]

            for statement in update_statements:
                try:
                    db.execute(statement)
                except Exception as e:
                    # Ignorar errores si la tabla no existe o no hay datos
                    logger.debug(f"Error ejecutando actualización (puede ser ignorado): {e}")

    except Exception as e:
        # Si hay un error crítico, lo registramos pero no detenemos la aplicación
        logger.warning(f"Error en migraciones (continuando): {e}")

