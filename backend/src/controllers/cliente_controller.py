from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.cliente_services import ClientServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from src.schemas import ClientUpdateResponse

#Cliente Controller


router = APIRouter()
servicio = ClientServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None


@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_cliente(cliente: schemas.ClientCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_cliente(cliente)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"Error: {e}")  
        return {"message": f"Error al crear cliente: {str(e)}", "success": False, "data": None}

   

@router.get("/all", response_model=List[schemas.ClientResponse])
def obtener_todos_clientes(current_user=Depends(get_current_user)):
    try:
        all_clients = servicio.get_todos_clientes()
        return all_clients
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener clientes."
        )
    
class UpdateMessage(BaseModel):
    message: str
    success: bool

@router.get("/get_by_id/{cliente_id}", response_model=schemas.ClientResponse)
def obtener_cliente_por_id(cliente_id: int, current_user=Depends(get_current_user)):
    try:
        cliente = servicio.buscar_cliente_por_id(cliente_id)
        return cliente
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener el cliente")

@router.get("/relaciones/{cliente_id}")
def obtener_relaciones_cliente(cliente_id: int, current_user=Depends(get_current_user)):
    try:
        relaciones = servicio.obtener_relaciones_cliente(cliente_id)
        return relaciones
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener las relaciones del cliente")


@router.put("/update/{cliente_id}", response_model=ClientUpdateResponse)
def actualizar_cliente(cliente_id: int, cliente_actualizar: schemas.ClientCreate, current_user=Depends(get_current_user)):
    try:
        servicio = ClientServices()
        cliente_actualizado = servicio.actualizar_cliente(cliente_id, cliente_actualizar)
        return cliente_actualizado
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_cliente:")
        print(traceback.format_exc())  
        return {"message": "Error inesperado al actualizar el cliente.", "success": False, "data": cliente_actualizado.get("data")}


@router.delete("/delete/{cliente_id}", response_model=UpdateMessage)
def eliminar_cliente(cliente_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_cliente(cliente_id)
        return UpdateMessage(message="Cliente eliminado exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al eliminar el cliente")