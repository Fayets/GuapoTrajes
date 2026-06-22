from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.eventos_services import EventosServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date

router = APIRouter()
servicio = EventosServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_evento(evento: schemas.EventoCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_evento(evento)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"Error: {e}")  
        return {"message": "Error al crear evento", "success": False, "data": None}

@router.get("/all", response_model=List[schemas.EventoResponse])
def obtener_todos_eventos(current_user=Depends(get_current_user)):
    try:
        return servicio.get_todos_eventos()
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error inesperado al obtener eventos.")

class UpdateMessage(BaseModel):
    message: str
    success: bool

@router.put("/update/{evento_id}", response_model=RegisterMessage)
def actualizar_evento(evento_id: int, evento_actualizar: schemas.EventoCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.actualizar_evento(evento_id, evento_actualizar)
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar evento:")
        print(traceback.format_exc())
        return {"message": "Error inesperado al actualizar el evento.", "success": False, "data": None}

@router.delete("/delete/{evento_id}", response_model=UpdateMessage)
def eliminar_evento(evento_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_evento(evento_id)
        return UpdateMessage(message="Evento eliminado exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar el evento")
