from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.sucursal_services import SucursalServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from src.schemas import SucursalUpdateResponse

# Sucursal Controller

router = APIRouter()
servicio = SucursalServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_sucursal(sucursal: schemas.SucursalCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_sucursal(sucursal)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
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
def actualizar_sucursal(sucursal_id: int, sucursal_actualizar: schemas.SucursalCreate, current_user=Depends(get_current_user)):
    try:
        servicio = SucursalServices()
        sucursal_actualizada = servicio.actualizar_sucursal(sucursal_id, sucursal_actualizar)
        return sucursal_actualizada
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_sucursal:")
        print(traceback.format_exc())  
        return {"message": "Error inesperado al actualizar el producto.", "success": False, "data": sucursal_actualizada.get("data")}



@router.delete("/delete/{sucursal_id}", response_model=UpdateMessage)
def eliminar_sucursal(sucursal_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_sucursal(sucursal_id)
        return UpdateMessage(message="Sucursal eliminada exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al eliminar la sucursal")