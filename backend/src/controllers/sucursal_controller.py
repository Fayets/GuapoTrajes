from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.sucursal_services import SucursalServices
from pydantic import BaseModel
from typing import List, Optional, Dict
from src.schemas import SucursalUpdateResponse
from src.models import Roles
from src.deps import require_role, get_current_user
import logging

# Sucursal Controller

router = APIRouter()
servicio = SucursalServices()
logger = logging.getLogger("guapotrajes")


class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None


@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_sucursal(
    sucursal: schemas.SucursalCreate,
    current_user=Depends(require_role(Roles.SUPER_ADMIN)),
):
    try:
        result = servicio.crear_sucursal(sucursal)
        logger.info(
            "Sucursal creada",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "sucursal_nombre": sucursal.nombre,
            },
        )
        return result
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception:
        logger.exception("Error inesperado al crear la sucursal")
        return {"message": "Error al crear la sucursal", "success": False, "data": None}
    

@router.get("/all", response_model=List[schemas.SucursalResponse])
def obtener_todas_sucursales(current_user=Depends(get_current_user)):
    try:
        all_sucursales = servicio.get_todas_sucursales()
        return all_sucursales
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener sucursales."
        )

class UpdateMessage(BaseModel):
    message: str
    success: bool

@router.get("/get_by_id/{sucursal_id}", response_model=schemas.SucursalResponse)
def obtener_sucursal_por_id(sucursal_id: int, current_user=Depends(get_current_user)):
    try:
        sucursal = servicio.buscar_sucursal_por_id(sucursal_id)
        return sucursal
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener la sucursal")

@router.put("/update/{sucursal_id}", response_model=SucursalUpdateResponse)
def actualizar_sucursal(
    sucursal_id: int,
    sucursal_actualizar: schemas.SucursalCreate,
    current_user=Depends(require_role(Roles.SUPER_ADMIN)),
):
    try:
        servicio = SucursalServices()
        sucursal_actualizada = servicio.actualizar_sucursal(sucursal_id, sucursal_actualizar)
        logger.info(
            "Sucursal actualizada",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "sucursal_id": sucursal_id,
            },
        )
        return sucursal_actualizada
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        logger.exception("Error inesperado en actualizar_sucursal")
        return {"message": "Error inesperado al actualizar la sucursal.", "success": False, "data": None}



@router.delete("/delete/{sucursal_id}", response_model=UpdateMessage)
def eliminar_sucursal(
    sucursal_id: int,
    current_user=Depends(require_role(Roles.SUPER_ADMIN)),
):
    try:
        servicio.eliminar_sucursal(sucursal_id)
        logger.info(
            "Sucursal eliminada",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "sucursal_id": sucursal_id,
            },
        )
        return UpdateMessage(message="Sucursal eliminada exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception("Error inesperado al eliminar la sucursal")
        raise HTTPException(status_code=500, detail="Error al eliminar la sucursal")