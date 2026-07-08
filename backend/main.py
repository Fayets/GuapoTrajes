from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.db import db
from pony.orm import *
from fastapi import FastAPI
from src.controllers.auth_controller import router as auth_router
from src.controllers.sucursal_controller import router as sucursal_router
from src.controllers.productos_controller import router as productos_router
from src.controllers.cliente_controller import router as cliente_router
from src.controllers.lavanderia_controller import router as lavanderia_router
from src.controllers.modista_controller import router as modista_router
from src.controllers.precliente_controller import router as precliente_router
from src.controllers.presupuestos_controller import router as presupuestos_router
from src.controllers.orden_trabajo_controller import router as orden_trabajo_router
from src.controllers.ventas_controller import router as ventas_router
from src.controllers.caja_controller import router as caja_router
from src.controllers.caja_chica_controller import router as caja_chica_router
from src.controllers.caja_concentradora_controller import router as caja_concentradora_router
from src.controllers.pagos_controller import router as pagos_router
from src.controllers.eventos_controller import router as eventos_router
from src.controllers.reportes_controller import router as reportes_router
from src.controllers.cuenta_destino_controller import router as cuenta_destino_router
from src.controllers.metodos_pago_controller import router as metodos_pago_router
from src.controllers.logs_controller import router as logs_router
from src.controllers.usuario_controller import router as usuario_router
from src.controllers.health_controller import router as health_router
from src.controllers.config_productos_controller import router as config_productos_router
from src.migrations import apply_schema_migrations, ensure_contrato_generado_at_column, ensure_etiquetas_armado_impresas_at_column, ensure_etiqueta_inventario_impresa_at_column, ensure_conjunto_separado_column, ensure_producto_reservado_modista_columns, ensure_notas_productos_lavanderias, ensure_cliente_columnas_lavanderia_modista, ensure_descripcion_extra_productos, ensure_caja_movimientos_fecha_hora_ar, reparar_presupuestos_huerfanos_al_inicio
from src import schemas, models
from src.services.usuario_services import UsuariosServices
from pony.orm import db_session
from decouple import config
import logging
import os


# Configuración de logging global hacia archivo
LOG_FILE_PATH = config("SYSTEM_LOG_FILE", default="logs/system.log")
os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("guapotrajes")


def _cors_origins() -> list[str]:
    raw = config("CORS_ORIGINS", default="")
    if raw.strip():
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def ensure_initial_super_admin():
    """
    Crea un usuario SUPER_ADMIN inicial solo en desarrollo o con BOOTSTRAP_ADMIN=true.
    Credenciales por defecto (solo bootstrap):
      - Usuario: DesarrolloGuapo
      - Contraseña: Roma123!
    """
    env = config("ENV", default="production").lower()
    bootstrap = config("BOOTSTRAP_ADMIN", default="false").lower() in (
        "true",
        "1",
        "yes",
    )
    if env != "development" and not bootstrap:
        logger.info(
            "Bootstrap SUPER_ADMIN omitido (ENV != development y BOOTSTRAP_ADMIN no activo)"
        )
        return

    with db_session:
        # Verificar si ya existe el usuario específico o cualquier SUPER_ADMIN
        existing_by_username = models.Usuario.get(username="DesarrolloGuapo")
        existing_by_email = models.Usuario.get(email="desarrollo@guapotrajes.com")
        
        if existing_by_username or existing_by_email:
            if existing_by_username and existing_by_username.rol == models.Roles.SUPER_ADMIN:
                logger.debug("Usuario SUPER_ADMIN 'DesarrolloGuapo' ya existe")
                return
            if existing_by_email and existing_by_email.rol == models.Roles.SUPER_ADMIN:
                logger.debug("Usuario SUPER_ADMIN con email 'desarrollo@guapotrajes.com' ya existe")
                return

        # Determinar sucursal
        sucursal_id_env = config("SUPER_ADMIN_SUCURSAL_ID", default=None)
        sucursal = None
        if sucursal_id_env is not None:
            try:
                sucursal = models.Sucursal.get(id=int(sucursal_id_env))
            except ValueError:
                logger.warning("SUPER_ADMIN_SUCURSAL_ID inválido; se ignorará.")

        if sucursal is None:
            sucursal = models.Sucursal.select().first()

        if sucursal is None:
            logger.warning(
                "No hay sucursales disponibles; no se pudo crear usuario SUPER_ADMIN inicial."
            )
            return

        servicio = UsuariosServices()
        user_data = schemas.UserCreate(
            username="DesarrolloGuapo",
            email="desarrollo@guapotrajes.com",
            password="Roma123!",
            nombre="Super",
            apellido="Admin",
            role=models.Roles.SUPER_ADMIN,
            sucursal=sucursal.id,
        )
        try:
            servicio.crear_usuario(user_data)
            logger.debug(
                "Usuario SUPER_ADMIN inicial creado",
                extra={"username": "DesarrolloGuapo", "sucursal_id": sucursal.id},
            )
        except Exception as e:
            logger.warning(f"No se pudo crear usuario SUPER_ADMIN: {e}")


app = FastAPI()

# Aplicar migraciones primero, luego mapear entidades
# Las migraciones agregan las columnas necesarias antes de que Pony ORM verifique la estructura
apply_schema_migrations()


# Generar mapeo - las migraciones ya agregaron las columnas necesarias
if db.schema is None:
    db.generate_mapping(create_tables=True, check_tables=False)

# Asegurar columna contrato_generado_at (necesaria para presupuestos/órdenes/contratos)
ensure_contrato_generado_at_column()
ensure_etiquetas_armado_impresas_at_column()
ensure_etiqueta_inventario_impresa_at_column()
ensure_conjunto_separado_column()
ensure_producto_reservado_modista_columns()
# Asegurar columna notas en ProductosLavanderias (motivo de devolución)
ensure_notas_productos_lavanderias()
# Asegurar columnas cliente_nombre y cliente_celular en lavandería/modista
ensure_cliente_columnas_lavanderia_modista()
# Asegurar descripcion_extra en productos (compatibilidad para instalaciones existentes)
ensure_descripcion_extra_productos()
ensure_caja_movimientos_fecha_hora_ar()

# Reparar presupuestos huérfanos (p. ej. precliente borrado sin convertir)
reparar_presupuestos_huerfanos_al_inicio()

# Crear SUPER_ADMIN inicial si corresponde
ensure_initial_super_admin()


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["X-Total-Count", "X-Page", "X-Size"],
)

# Lista de Rutas
# Auth
app.include_router(auth_router, prefix="/auth", tags=["Auth"])

# Sucursal
app.include_router(sucursal_router, prefix="/sucursales", tags=["Sucursales"])

# Productos
app.include_router(productos_router, prefix="/productos", tags=["Productos"])

# Clientes
app.include_router(cliente_router, prefix="/clientes", tags=["Clientes"])

# Lavanderia
app.include_router(lavanderia_router, prefix="/lavanderia", tags=["Lavandería"])

# Modistas
app.include_router(modista_router, prefix="/modistas", tags=["Modistas"])

#Preclientes
app.include_router(precliente_router, prefix="/preclientes", tags=["Preclientes"])

#Presupuestos
app.include_router(presupuestos_router, tags=["Presupuestos"])

#Orden de trabajo
app.include_router(orden_trabajo_router, tags=["Órdenes de Trabajo"])

#Ventas
app.include_router(ventas_router, prefix="/ventas", tags=["Ventas"])

#Caja
app.include_router(caja_router, prefix="/caja", tags=["Caja"])
app.include_router(caja_chica_router)
app.include_router(caja_concentradora_router)

#Pagos
app.include_router(pagos_router, tags=["Pagos"])

#Eventos
app.include_router(eventos_router, prefix="/eventos", tags=["Eventos"])

#Reportes
app.include_router(reportes_router, tags=["Reportes"])

#Cuentas Destino
app.include_router(
    cuenta_destino_router, prefix="/cuentas-destino", tags=["Cuentas Destino"]
)

#Métodos de Pago Configurables
app.include_router(metodos_pago_router, prefix="/metodos-pago", tags=["Métodos de Pago"])

# Config: atributos de producto (líneas, talles, telas, colores)
app.include_router(config_productos_router, prefix="/config", tags=["Config Productos"])

# Logs del sistema
app.include_router(logs_router, prefix="/logs", tags=["Logs"])

# Usuarios
app.include_router(usuario_router, prefix="/usuarios", tags=["Usuarios"])

# Health
app.include_router(health_router, prefix="/health", tags=["Health"])

# Personalizar el esquema de seguridad en OpenAPI para usar Bearer tokens
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = app._original_openapi()  # Cambiado a _original_openapi
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


# Guardamos la referencia original del método openapi
app._original_openapi = app.openapi
# Reemplazamos el método openapi por nuestra función personalizada
app.openapi = custom_openapi