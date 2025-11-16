from fastapi.security import OAuth2PasswordBearer
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
<<<<<<< HEAD
from src.controllers.caja_chica_controller import router as caja_chica_router
from src.controllers.caja_concentradora_controller import router as caja_concentradora_router
from src.controllers.pagos_controller import router as pagos_router
from src.controllers.eventos_controller import router as eventos_router
from src.migrations import apply_schema_migrations

app = FastAPI()

# Aplicar migraciones primero, luego mapear entidades
# Las migraciones agregan las columnas necesarias antes de que Pony ORM verifique la estructura
apply_schema_migrations()

# Generar mapeo - las migraciones ya agregaron las columnas necesarias
db.generate_mapping(create_tables=True, check_tables=False)
=======
from src.controllers.pagos_controller import router as pagos_router
from src.controllers.eventos_controller import router as eventos_router

app = FastAPI()

# Mapeando las entidades a tablas (si no existe la tabla, la crea)
# db.generate_mapping(create_tables=True)  # Comentado temporalmente para evitar errores
# db.generate_mapping(create_tables=False, check_tables=False)  # Solo mapear, no verificar tablas
db.generate_mapping(create_tables=False, check_tables=True)  # Mapear y verificar tablas existentes
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
<<<<<<< HEAD
app.include_router(caja_chica_router)
app.include_router(caja_concentradora_router)
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

#Pagos
app.include_router(pagos_router, tags=["Pagos"])

#Eventos
app.include_router(eventos_router, prefix="/eventos", tags=["Eventos"])


# Personalizar el esquema de seguridad en OpenAPI para usar Bearer tokens
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = app._original_openapi()  # Cambiado a _original_openapi
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
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