from decouple import config
from pony.orm import db_session
import logging

from src.db import db

logger = logging.getLogger(__name__)


def _is_postgres() -> bool:
    provider = config("DB_PROVIDER", default="postgres").lower()
    return provider in {"postgres", "postgresql"}


def ensure_producto_reservado_modista_columns() -> None:
    """Añade requiere_modista y notas_modista en productos reservados por orden."""
    if not _is_postgres():
        return
    from src.models import ProductoReservado

    table_name = getattr(ProductoReservado, "_table_", "ProductosReservados")
    for name in (table_name, table_name.lower()):
        try:
            with db_session:
                db.execute(
                    f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS '
                    f'"requiere_modista" BOOLEAN DEFAULT FALSE'
                )
                db.execute(
                    f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS '
                    f'"notas_modista" TEXT'
                )
            logger.debug("Columnas modista OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err:
                continue
            logger.debug("Error añadiendo columnas modista en '%s': %s", name, e)


def ensure_conjunto_separado_column() -> None:
    """Añade conjunto_separado en órdenes de trabajo si no existe."""
    if not _is_postgres():
        return
    from src.models import OrdenTrabajo

    table_name = getattr(OrdenTrabajo, "_table_", "OrdenesTrabajo")
    for name in (table_name, table_name.lower()):
        try:
            with db_session:
                db.execute(
                    f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS '
                    f'"conjunto_separado" BOOLEAN DEFAULT FALSE'
                )
            logger.debug("Columna conjunto_separado OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err:
                continue
            logger.debug("Error añadiendo conjunto_separado en '%s': %s", name, e)


def ensure_etiqueta_inventario_impresa_at_column() -> None:
    """Añade etiqueta_inventario_impresa_at en productos si no existe."""
    if not _is_postgres():
        return
    from src.models import Producto

    table_name = getattr(Producto, "_table_", "Productos")
    for name in (table_name, table_name.lower()):
        try:
            with db_session:
                db.execute(
                    f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS '
                    f'"etiqueta_inventario_impresa_at" TIMESTAMP'
                )
            logger.debug("Columna etiqueta_inventario_impresa_at OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err:
                continue
            logger.debug(
                "Error añadiendo etiqueta_inventario_impresa_at en '%s': %s", name, e
            )
    logger.debug(
        "No se pudo añadir etiqueta_inventario_impresa_at (probados: %s, %s)",
        table_name,
        table_name.lower(),
    )


def ensure_etiquetas_armado_impresas_at_column() -> None:
    """Añade etiquetas_armado_impresas_at en órdenes de trabajo si no existe."""
    if not _is_postgres():
        return
    from src.models import OrdenTrabajo

    table_name = getattr(OrdenTrabajo, "_table_", "OrdenesTrabajo")
    for name in (table_name, table_name.lower()):
        try:
            with db_session:
                db.execute(
                    f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS '
                    f'"etiquetas_armado_impresas_at" TIMESTAMP'
                )
            logger.debug("Columna etiquetas_armado_impresas_at OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err:
                continue
            logger.debug(
                "Error añadiendo etiquetas_armado_impresas_at en '%s': %s", name, e
            )
    logger.debug(
        "No se pudo añadir etiquetas_armado_impresas_at (probados: %s, %s)",
        table_name,
        table_name.lower(),
    )


def ensure_contrato_generado_at_column() -> None:
    """Añade la columna contrato_generado_at en la tabla de órdenes si no existe."""
    if not _is_postgres():
        return
    from src.models import OrdenTrabajo
    table_name = getattr(OrdenTrabajo, "_table_", "OrdenesTrabajo")
    # Probar nombre del modelo y versión en minúsculas (PostgreSQL sin comillas crea en minúscula)
    for name in (table_name, table_name.lower()):
        try:
            with db_session:
                db.execute(f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS "contrato_generado_at" TIMESTAMP')
            logger.debug("Columna contrato_generado_at OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err:
                continue
            logger.debug("Error añadiendo contrato_generado_at en '%s': %s", name, e)
    logger.debug("No se pudo añadir contrato_generado_at (probados: %s, %s)", table_name, table_name.lower())


def ensure_notas_productos_lavanderias() -> None:
    """Asegura que la tabla de productos en lavandería tenga columna notas (motivo de devolución)."""
    if not _is_postgres():
        return
    for name in ("ProductosLavanderias", "productoslavanderias"):
        try:
            with db_session:
                db.execute(f'ALTER TABLE "{name}" ADD COLUMN IF NOT EXISTS "notas" TEXT')
            logger.debug("Columna 'notas' OK en tabla '%s'", name)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err or "no exist" in err:
                continue
            logger.debug("Error añadiendo notas en '%s': %s", name, e)
    logger.debug("No se pudo añadir columna notas en tabla de lavandería (probados: ProductosLavanderias, productoslavanderias)")


def ensure_cliente_columnas_lavanderia_modista() -> None:
    """Asegura que las tablas de lavandería y modista tengan columnas cliente_nombre y cliente_celular."""
    if not _is_postgres():
        return
    for table in ("ProductosLavanderias", "productoslavanderias"):
        try:
            with db_session:
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT')
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT')
            logger.debug("Columnas cliente_nombre/cliente_celular OK en tabla '%s'", table)
            break
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err or "no exist" in err:
                continue
            logger.debug("Error en tabla lavandería '%s': %s", table, e)
    for table in ("ProductosModistas", "productosmodistas"):
        try:
            with db_session:
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT')
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT')
            logger.debug("Columnas cliente_nombre/cliente_celular OK en tabla '%s'", table)
            break
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err or "no exist" in err:
                continue
            logger.debug("Error en tabla modista '%s': %s", table, e)


def ensure_descripcion_extra_productos() -> None:
    """Asegura la columna descripcion_extra en la tabla de productos."""
    if not _is_postgres():
        return
    for table in ("Productos", "productos"):
        try:
            with db_session:
                db.execute(
                    f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "descripcion_extra" TEXT'
                )
            logger.debug("Columna descripcion_extra OK en tabla '%s'", table)
            return
        except Exception as e:
            err = str(e).lower()
            if "does not exist" in err or "no existe" in err or "no exist" in err:
                continue
            logger.debug("Error añadiendo descripcion_extra en '%s': %s", table, e)
    logger.debug("No se pudo añadir descripcion_extra (probados: Productos, productos)")


def ensure_caja_movimientos_fecha_hora_ar() -> None:
    """
    Corrige movimientos de caja guardados en UTC (backend en Render) a hora Argentina.
    Se ejecuta una sola vez en producción.
    """
    if not _is_postgres():
        return
    env = config("ENV", default="production").lower()
    if env != "production":
        logger.debug("Patch caja_movimientos_fecha_hora_ar omitido (ENV=%s)", env)
        return

    patch_name = "caja_movimientos_fecha_hora_ar"
    try:
        with db_session:
            db.execute(
                'CREATE TABLE IF NOT EXISTS "_schema_patches" ('
                '"name" VARCHAR(255) PRIMARY KEY, '
                '"applied_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)'
            )
            conn = db.get_connection()
            cur = conn.cursor()
            cur.execute('SELECT 1 FROM "_schema_patches" WHERE "name" = %s', (patch_name,))
            if cur.fetchone():
                logger.debug("Patch %s ya aplicado", patch_name)
                return
            cur.execute(
                'UPDATE "CajaMovimientos" SET "fecha_hora" = '
                '("fecha_hora" AT TIME ZONE \'UTC\') AT TIME ZONE \'America/Argentina/Buenos_Aires\''
            )
            cur.execute('INSERT INTO "_schema_patches" ("name") VALUES (%s)', (patch_name,))
            conn.commit()
            logger.info(
                "Patch %s aplicado: fechas de caja diaria normalizadas a hora Argentina",
                patch_name,
            )
    except Exception as e:
        err = str(e).lower()
        if "does not exist" in err and "cajamovimientos" in err.replace(" ", ""):
            logger.debug("Omitiendo patch %s: tabla CajaMovimientos aún no existe", patch_name)
            return
        logger.warning("Error aplicando patch %s: %s", patch_name, e)


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
                # Migraciones para descuentos extra
                'ALTER TABLE "Presupuesto" ADD COLUMN IF NOT EXISTS "extra_discount_percentage" DOUBLE PRECISION',
                'ALTER TABLE "Presupuesto" ADD COLUMN IF NOT EXISTS "extra_discount_amount" DOUBLE PRECISION',
                'ALTER TABLE "Presupuesto" ADD COLUMN IF NOT EXISTS "extra_discount_reason" TEXT',
                'ALTER TABLE "Presupuesto" ADD COLUMN IF NOT EXISTS "extra_discount_applied_by" INTEGER',
                'ALTER TABLE "Presupuesto" ADD COLUMN IF NOT EXISTS "extra_discount_created_at" TIMESTAMP',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "extra_discount_percentage" DOUBLE PRECISION',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "extra_discount_amount" DOUBLE PRECISION',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "extra_discount_reason" TEXT',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "extra_discount_applied_by" INTEGER',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "extra_discount_created_at" TIMESTAMP',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "contrato_generado_at" TIMESTAMP',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "etiquetas_armado_impresas_at" TIMESTAMP',
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "etiqueta_inventario_impresa_at" TIMESTAMP',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "extra_discount_percentage" DOUBLE PRECISION',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "extra_discount_amount" DOUBLE PRECISION',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "extra_discount_reason" TEXT',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "extra_discount_applied_by" INTEGER',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "extra_discount_created_at" TIMESTAMP',
                # Migraciones para CuentaDestino
                'CREATE TABLE IF NOT EXISTS "CuentasDestino" ('
                '    "id" SERIAL PRIMARY KEY,'
                '    "sucursal" INTEGER NOT NULL REFERENCES "Sucursales"("id"),'
                '    "nombre_titular" VARCHAR(255) NOT NULL,'
                '    "activa" BOOLEAN NOT NULL DEFAULT TRUE'
                ')',
                'ALTER TABLE "CajaMovimientos" ADD COLUMN IF NOT EXISTS "cuenta_destino_id" INTEGER REFERENCES "CuentasDestino"("id")',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "cuenta_destino_id" INTEGER REFERENCES "CuentasDestino"("id")',
                # Migraciones para Métodos de Pago Configurables
                'CREATE TABLE IF NOT EXISTS "MetodosPagoConfigurables" ('
                '    "id" SERIAL PRIMARY KEY,'
                '    "sucursal" INTEGER NOT NULL REFERENCES "Sucursales"("id"),'
                '    "nombre" VARCHAR(255) NOT NULL,'
                '    "activo" BOOLEAN NOT NULL DEFAULT TRUE,'
                '    "tiene_submetodos" BOOLEAN NOT NULL DEFAULT FALSE,'
                '    "orden" INTEGER DEFAULT 0,'
                '    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
                ')',
                'CREATE TABLE IF NOT EXISTS "SubmetodosPago" ('
                '    "id" SERIAL PRIMARY KEY,'
                '    "metodo_pago" INTEGER NOT NULL REFERENCES "MetodosPagoConfigurables"("id") ON DELETE CASCADE,'
                '    "nombre" VARCHAR(255) NOT NULL,'
                '    "activo" BOOLEAN NOT NULL DEFAULT TRUE,'
                '    "orden" INTEGER DEFAULT 0,'
                '    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
                ')',
                # Agregar columnas a tablas existentes para métodos configurables
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "metodo_pago_id" INTEGER REFERENCES "MetodosPagoConfigurables"("id")',
                'ALTER TABLE "Ventas" ADD COLUMN IF NOT EXISTS "submetodo_pago_id" INTEGER REFERENCES "SubmetodosPago"("id")',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "metodo_pago_id" INTEGER REFERENCES "MetodosPagoConfigurables"("id")',
                'ALTER TABLE "OrdenesTrabajo" ADD COLUMN IF NOT EXISTS "submetodo_pago_id" INTEGER REFERENCES "SubmetodosPago"("id")',
                'ALTER TABLE "CajaMovimientos" ADD COLUMN IF NOT EXISTS "metodo_pago_id" INTEGER REFERENCES "MetodosPagoConfigurables"("id")',
                'ALTER TABLE "CajaMovimientos" ADD COLUMN IF NOT EXISTS "submetodo_pago_id" INTEGER REFERENCES "SubmetodosPago"("id")',
                'ALTER TABLE "CuentaCorriente" ADD COLUMN IF NOT EXISTS "metodo_pago_id" INTEGER REFERENCES "MetodosPagoConfigurables"("id")',
                'ALTER TABLE "CuentaCorriente" ADD COLUMN IF NOT EXISTS "submetodo_pago_id" INTEGER REFERENCES "SubmetodosPago"("id")',
                # Catálogos de atributos de producto
                'CREATE TABLE IF NOT EXISTS "ProductoLineas" ("id" SERIAL PRIMARY KEY, "nombre" VARCHAR(255) NOT NULL UNIQUE, "codigo" VARCHAR(3))',
                'CREATE TABLE IF NOT EXISTS "ProductoTalles" ("id" SERIAL PRIMARY KEY, "nombre" VARCHAR(255) NOT NULL UNIQUE, "codigo" VARCHAR(2))',
                'CREATE TABLE IF NOT EXISTS "ProductoTelas" ("id" SERIAL PRIMARY KEY, "nombre" VARCHAR(255) NOT NULL UNIQUE, "codigo" VARCHAR(2))',
                'CREATE TABLE IF NOT EXISTS "ProductoColores" ("id" SERIAL PRIMARY KEY, "nombre" VARCHAR(255) NOT NULL UNIQUE, "codigo" VARCHAR(2))',
                # Columnas FK en Productos (nullable)
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "linea_id" INTEGER REFERENCES "ProductoLineas"("id")',
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "talle_id" INTEGER REFERENCES "ProductoTalles"("id")',
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "tela_id" INTEGER REFERENCES "ProductoTelas"("id")',
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "color_id" INTEGER REFERENCES "ProductoColores"("id")',
                'ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "descripcion_extra" TEXT',
                'ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "descripcion_extra" TEXT',
                # Asegurar columnas codigo en catálogos (para instalaciones existentes)
                'ALTER TABLE "ProductoLineas" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(3)',
                'ALTER TABLE "ProductoTalles" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(2)',
                'ALTER TABLE "ProductoTelas" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(2)',
                'ALTER TABLE "ProductoColores" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(2)',
                # Motivo en devoluciones a lavandería/modista (probamos ambos nombres por si PostgreSQL tiene la tabla en minúsculas)
                'ALTER TABLE "ProductosLavanderias" ADD COLUMN IF NOT EXISTS "notas" TEXT',
                'ALTER TABLE "productoslavanderias" ADD COLUMN IF NOT EXISTS "notas" TEXT',
                'ALTER TABLE "ProductosModistas" ADD COLUMN IF NOT EXISTS "notas" TEXT',
                'ALTER TABLE "productosmodistas" ADD COLUMN IF NOT EXISTS "notas" TEXT',
                # Cliente en devoluciones (lavandería/modista; probar ambos nombres de tabla)
                'ALTER TABLE "ProductosLavanderias" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT',
                'ALTER TABLE "ProductosLavanderias" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT',
                'ALTER TABLE "productoslavanderias" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT',
                'ALTER TABLE "productoslavanderias" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT',
                'ALTER TABLE "ProductosModistas" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT',
                'ALTER TABLE "ProductosModistas" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT',
                'ALTER TABLE "productosmodistas" ADD COLUMN IF NOT EXISTS "cliente_nombre" TEXT',
                'ALTER TABLE "productosmodistas" ADD COLUMN IF NOT EXISTS "cliente_celular" TEXT',
                # Cierre de caja diaria (efectivo en cero)
                'CREATE TABLE IF NOT EXISTS "CierresCaja" ('
                '    "id" SERIAL PRIMARY KEY,'
                '    "fecha" DATE NOT NULL,'
                '    "sucursal" INTEGER NOT NULL REFERENCES "Sucursales"("id"),'
                '    "usuario_id" INTEGER NOT NULL REFERENCES "Usuarios"("id"),'
                '    "fecha_hora" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
                '    UNIQUE("fecha", "sucursal")'
                ')',
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

            # Migración de datos: pasar linea/talle/tela/color (str) a FKs (solo si existen columnas viejas)
            data_migration_sql = [
                (
                    'INSERT INTO "ProductoLineas" ("nombre") SELECT DISTINCT "linea" FROM "Productos" '
                    'WHERE "linea" IS NOT NULL AND TRIM("linea") != \'\' ON CONFLICT ("nombre") DO NOTHING'
                ),
                'UPDATE "Productos" p SET "linea_id" = (SELECT pl.id FROM "ProductoLineas" pl WHERE pl.nombre = p.linea LIMIT 1) WHERE p."linea" IS NOT NULL',
                (
                    'INSERT INTO "ProductoTalles" ("nombre") SELECT DISTINCT "talle" FROM "Productos" '
                    'WHERE "talle" IS NOT NULL AND TRIM("talle") != \'\' ON CONFLICT ("nombre") DO NOTHING'
                ),
                'UPDATE "Productos" p SET "talle_id" = (SELECT pt.id FROM "ProductoTalles" pt WHERE pt.nombre = p.talle LIMIT 1) WHERE p."talle" IS NOT NULL',
                (
                    'INSERT INTO "ProductoTelas" ("nombre") SELECT DISTINCT "tela" FROM "Productos" '
                    'WHERE "tela" IS NOT NULL AND TRIM("tela") != \'\' ON CONFLICT ("nombre") DO NOTHING'
                ),
                'UPDATE "Productos" p SET "tela_id" = (SELECT pt.id FROM "ProductoTelas" pt WHERE pt.nombre = p.tela LIMIT 1) WHERE p."tela" IS NOT NULL',
                (
                    'INSERT INTO "ProductoColores" ("nombre") SELECT DISTINCT "color" FROM "Productos" '
                    'WHERE "color" IS NOT NULL AND TRIM("color") != \'\' ON CONFLICT ("nombre") DO NOTHING'
                ),
                'UPDATE "Productos" p SET "color_id" = (SELECT pc.id FROM "ProductoColores" pc WHERE pc.nombre = p.color LIMIT 1) WHERE p."color" IS NOT NULL',
                # Inicializar códigos por defecto en catálogos existentes (relleno con id)
                'UPDATE "ProductoLineas" SET "codigo" = LPAD(CAST("id" AS TEXT), 3, \'0\') WHERE "codigo" IS NULL OR TRIM("codigo") = \'\'',
                'UPDATE "ProductoTalles" SET "codigo" = LPAD(CAST("id" AS TEXT), 2, \'0\') WHERE "codigo" IS NULL OR TRIM("codigo") = \'\'',
                'UPDATE "ProductoTelas" SET "codigo" = LPAD(CAST("id" AS TEXT), 2, \'0\') WHERE "codigo" IS NULL OR TRIM("codigo") = \'\'',
                'UPDATE "ProductoColores" SET "codigo" = LPAD(CAST("id" AS TEXT), 2, \'0\') WHERE "codigo" IS NULL OR TRIM("codigo") = \'\'',
                # Índices únicos para códigos
                'CREATE UNIQUE INDEX IF NOT EXISTS "ProductoLineas_codigo_key" ON "ProductoLineas"("codigo")',
                'CREATE UNIQUE INDEX IF NOT EXISTS "ProductoTalles_codigo_key" ON "ProductoTalles"("codigo")',
                'CREATE UNIQUE INDEX IF NOT EXISTS "ProductoTelas_codigo_key" ON "ProductoTelas"("codigo")',
                'CREATE UNIQUE INDEX IF NOT EXISTS "ProductoColores_codigo_key" ON "ProductoColores"("codigo")',
            ]
            for statement in data_migration_sql:
                try:
                    db.execute(statement)
                except Exception as e:
                    logger.debug(f"Migración datos atributos producto (puede ser ignorado si columnas ya no existen): {e}")

            for drop_col in ['"linea"', '"talle"', '"tela"', '"color"']:
                try:
                    db.execute(f'ALTER TABLE "Productos" DROP COLUMN IF EXISTS {drop_col}')
                except Exception as e:
                    logger.debug(f"Drop column Productos {drop_col}: {e}")

            # Crear métodos de pago por defecto para todas las sucursales
            # Esto se hace después del mapeo en un script separado para evitar problemas
            # El servicio de métodos de pago se encargará de crearlos si no existen

    except Exception as e:
        # Si hay un error crítico, lo registramos pero no detenemos la aplicación
        logger.warning(f"Error en migraciones (continuando): {e}")

