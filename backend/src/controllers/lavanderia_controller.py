from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.lavanderia_services import LavanderiaServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date

router = APIRouter()
servicio = LavanderiaServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_lavanderia(lavanderia: schemas.LavanderiaCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_lavanderia(lavanderia)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"Error: {e}")  
        return {"message": "Error al crear lavandería", "success": False, "data": None}

@router.get("/all", response_model=List[schemas.LavanderiaResponse])
def obtener_todas_lavanderias(current_user=Depends(get_current_user)):
    try:
        return servicio.get_todas_lavanderias()
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error inesperado al obtener lavanderías.")

class UpdateMessage(BaseModel):
    message: str
    success: bool

@router.put("/update/{lavanderia_id}", response_model=RegisterMessage)
def actualizar_lavanderia(lavanderia_id: int, lavanderia_actualizar: schemas.LavanderiaCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.actualizar_lavanderia(lavanderia_id, lavanderia_actualizar)
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_lavanderia:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al actualizar la lavandería.", "success": False, "data": None}

@router.delete("/delete/{lavanderia_id}", response_model=UpdateMessage)
def eliminar_lavanderia(lavanderia_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_lavanderia(lavanderia_id)
        return UpdateMessage(message="Lavandería eliminada exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar la lavandería")

@router.post("/asignar-producto")
def asignar_producto_a_lavanderia(lavanderia_id: int, producto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.asignar_producto(lavanderia_id, producto_id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error al asignar producto a lavandería", "success": False, "data": None}


@router.post("/regresar-producto/{producto_id}", response_model=schemas.RegresoProductoLavanderiaResponse)
def regresar_producto_lavanderia(producto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.regresar_producto_de_lavanderia(producto_id)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        return {"message": "Error al regresar el producto de lavandería", "success": False, "data": None}

@router.get("/productos")
def obtener_productos_lavanderia(current_user=Depends(get_current_user)):
    try:
        productos = servicio.get_productos_lavanderia()
        if not productos:
            return {"message": "No hay productos con estado LAVANDERIA", "success": False, "data": []}
        return {"message": "Productos obtenidos correctamente", "success": True, "data": productos}
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": []}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en obtener_productos_lavanderia:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al obtener productos en lavandería", "success": False, "data": []}



