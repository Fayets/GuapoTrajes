from fastapi import APIRouter, Depends, HTTPException, Query
from pony.orm import db_session
from src import schemas
from src.services.cuenta_destino_services import CuentaDestinoServices
from src.deps import get_current_user, require_role
from pydantic import BaseModel
from typing import List, Optional, Dict

# Cuenta Destino Controller

router = APIRouter()
servicio = CuentaDestinoServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201, dependencies=[Depends(require_role("ADMIN"))])
def registrar_cuenta_destino(cuenta: schemas.CuentaDestinoCreate, current_user=Depends(get_current_user)):
    """Crear una nueva cuenta destino. Solo ADMIN."""
    try:
        return servicio.crear_cuenta_destino(cuenta, current_user.id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error al crear la cuenta destino", "success": False, "data": None}

@router.get("/sucursal/{sucursal_id}", response_model=List[schemas.CuentaDestinoResponse])
def obtener_cuentas_destino_por_sucursal(
    sucursal_id: int,
    solo_activas: bool = Query(False, description="Solo mostrar cuentas activas"),
    current_user=Depends(get_current_user)
):
    """Obtener todas las cuentas destino de una sucursal. EMPLEADO solo ve su sucursal."""
    try:
        if solo_activas:
            return servicio.get_cuentas_destino_activas_por_sucursal(sucursal_id, current_user.id)
        else:
            return servicio.get_cuentas_destino_por_sucursal(sucursal_id, current_user.id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener cuentas destino."
        )

@router.get("/{id}", response_model=schemas.CuentaDestinoResponse)
def obtener_cuenta_destino_por_id(id: int, current_user=Depends(get_current_user)):
    """Obtener una cuenta destino por ID."""
    try:
        cuenta = servicio.get_cuenta_destino_por_id(id, current_user.id)
        return cuenta
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener la cuenta destino")

@router.put("/update/{id}", response_model=schemas.CuentaDestinoUpdateResponse, dependencies=[Depends(require_role("ADMIN"))])
def actualizar_cuenta_destino(id: int, cuenta_update: schemas.CuentaDestinoUpdate, current_user=Depends(get_current_user)):
    """Actualizar una cuenta destino. Solo ADMIN."""
    try:
        cuenta_actualizada = servicio.actualizar_cuenta_destino(id, cuenta_update, current_user.id)
        return cuenta_actualizada
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_cuenta_destino:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al actualizar la cuenta destino.", "success": False, "data": None}

@router.patch("/activar/{id}", response_model=schemas.CuentaDestinoUpdateResponse, dependencies=[Depends(require_role("ADMIN"))])
def activar_cuenta_destino(id: int, current_user=Depends(get_current_user)):
    """Activar una cuenta destino. Solo ADMIN."""
    try:
        return servicio.activar_cuenta_destino(id, current_user.id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error inesperado al activar la cuenta destino", "success": False, "data": None}

@router.patch("/desactivar/{id}", response_model=schemas.CuentaDestinoUpdateResponse, dependencies=[Depends(require_role("ADMIN"))])
def desactivar_cuenta_destino(id: int, current_user=Depends(get_current_user)):
    """Desactivar una cuenta destino. Solo ADMIN."""
    try:
        return servicio.desactivar_cuenta_destino(id, current_user.id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error inesperado al desactivar la cuenta destino", "success": False, "data": None}
