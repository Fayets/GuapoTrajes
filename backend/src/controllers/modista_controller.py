from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.modista_services import ModistaServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date

router = APIRouter()
servicio = ModistaServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_modista(modista: schemas.ModistaCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_modista(modista)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"Error: {e}")  
        return {"message": "Error al crear modista", "success": False, "data": None}

@router.get("/all", response_model=List[schemas.ModistaResponse])
def obtener_todas_modistas(current_user=Depends(get_current_user)):
    try:
        return servicio.get_todas_modistas()
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error inesperado al obtener modistas.")

class UpdateMessage(BaseModel):
    message: str
    success: bool

@router.put("/update/{modista_id}", response_model=RegisterMessage)
def actualizar_modista(modista_id: int, modista_actualizar: schemas.ModistaCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.actualizar_modista(modista_id, modista_actualizar)
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_modista:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al actualizar la modista.", "success": False, "data": None}

@router.delete("/delete/{modista_id}", response_model=UpdateMessage)
def eliminar_modista(modista_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_modista(modista_id)
        return UpdateMessage(message="Modista eliminada exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar la modista")

@router.post("/asignar-producto")
def asignar_producto_a_modista(modista_id: int, producto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.asignar_producto(modista_id, producto_id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error al asignar producto a modista", "success": False, "data": None}

@router.post("/regresar-producto/{producto_id}", response_model=schemas.RegresoProductoModistaResponse)
def regresar_producto_modista(producto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.regresar_producto_de_modista(producto_id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error al regresar el producto de modista", "success": False, "data": None}
    

@router.get("/productos")
def obtener_productos_modista(current_user=Depends(get_current_user)):
    try:
        productos = servicio.get_productos_modista()
        if not productos:
            return {"message": "No hay productos con estado MODISTA", "success": False, "data": []}
        return {"message": "Productos obtenidos correctamente", "success": True, "data": productos}
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": []}
    except Exception as e:
        print(e)
        import traceback
        print("❌ Error inesperado en obtener_productos_modista:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al obtener productos en modista", "success": False, "data": []}
