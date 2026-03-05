
from fastapi import APIRouter, HTTPException, Depends
from src.services.presupuestos_services import PresupuestosServices
from src.schemas import PresupuestoCreate
from pony.orm import db_session
from src.models import Presupuesto
from src.controllers.auth_controller import get_current_user
from typing import List

router = APIRouter(prefix="/presupuestos")
servicio = PresupuestosServices()

@router.post("/")
def crear(data: PresupuestoCreate, current_user=Depends(get_current_user)):
    try:
        resultado = servicio.crear_presupuesto(data, current_user)
        return resultado
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/")
def obtener_todos(current_user=Depends(get_current_user)):
    try:
        return servicio.listar_presupuestos()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener presupuestos: {str(e)}")

@router.get("/{presupuesto_id}")
def obtener_por_id(presupuesto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.obtener_presupuesto_por_id(presupuesto_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener presupuesto: {str(e)}")

@router.put("/{presupuesto_id}")
def actualizar_presupuesto(presupuesto_id: int, data: PresupuestoCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.editar_presupuesto(presupuesto_id, data, current_user)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar presupuesto: {str(e)}")

@router.delete("/{presupuesto_id}")
def eliminar_presupuesto(presupuesto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.eliminar_presupuesto(presupuesto_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar presupuesto: {str(e)}")