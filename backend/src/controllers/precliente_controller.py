from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.precliente_services import PreclientServices
from src.controllers.auth_controller import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict
from src.schemas import PreclientUpdateResponse

#Cliente Controller


router = APIRouter()
servicio = PreclientServices()

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None


@router.post("/register", response_model=RegisterMessage, status_code=201)
def registrar_cliente(cliente: schemas.PreclientCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.crear_cliente(cliente)
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"Error: {e}")  
        return {"message": f"Error al crear cliente: {str(e)}", "success": False, "data": None}

   

@router.get("/all", response_model=List[schemas.PreclientResponse])
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

@router.get("/get_by_id/{precliente_id}", response_model=schemas.PreclientResponse)
def obtener_cliente_por_id(precliente_id: str, current_user=Depends(get_current_user)):
    try:
        cliente = servicio.buscar_cliente_por_celular(precliente_id)
        return cliente
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener el cliente")


@router.put("/update/{precliente_id}", response_model=PreclientUpdateResponse)
def actualizar_cliente(precliente_id: int, cliente_actualizar: schemas.PreclientCreate, current_user=Depends(get_current_user)):
    try:
        servicio = PreclientServices()
        cliente_actualizado = servicio.actualizar_cliente(precliente_id, cliente_actualizar)
        return cliente_actualizado
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        import traceback
        print("❌ Error inesperado en actualizar_cliente:")
        print(traceback.format_exc())  
        return {"message": "Error inesperado al actualizar el cliente.", "success": False, "data": None}


@router.delete("/delete/{precliente_id}", response_model=UpdateMessage)
def eliminar_cliente(precliente_id: int, current_user=Depends(get_current_user)):
    try:
        servicio.eliminar_cliente(precliente_id)
        return UpdateMessage(message="Cliente eliminado exitosamente", success=True)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al eliminar el cliente")
    
@router.post("/convertir/{precliente_id}")
def convertir_precliente(
    precliente_id: int,
    datos: schemas.ConvertirPreclienteRequest,  # Crear este schema abajo
    current_user=Depends(get_current_user)
):
    try:
        return servicio.convertir_a_cliente(
            precliente_id,
            datos.direccion,
            datos.dni,
            datos.fecha_nacimiento,
        )
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
