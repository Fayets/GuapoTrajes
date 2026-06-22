from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from src import schemas
from src.services.ventas_services import VentasServices
from src.controllers.auth_controller import get_current_user

router = APIRouter()
service = VentasServices()

class VentaRegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None


@router.post("/register", response_model=VentaRegisterMessage, status_code=201)
def register_venta(venta: schemas.VentaCreate, current_user=Depends(get_current_user)):
    try:
        venta_creada = service.create_venta(venta, current_user)
        return {
            "message": "Venta registrada con éxito.",
            "success": True,
            "data": venta_creada,
        }
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        print(f"❌ Error al registrar venta: {e}")
        return {"message": "Error inesperado al registrar la venta.", "success": False}


@router.get("/get/{id}", response_model=schemas.VentaOut)
def get_venta_by_id(id: int, current_user=Depends(get_current_user)):
    try:
        return service.get_venta_by_id(id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error inesperado al obtener la venta.")


@router.get("/all", response_model=List[schemas.VentaOut])
def get_all_ventas(current_user=Depends(get_current_user)):
    try:
        return service.get_all_ventas(current_user)
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error inesperado GET /ventas/all: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error inesperado al obtener las ventas.")


@router.delete("/{id}", status_code=200)
def delete_venta(id: int, current_user=Depends(get_current_user)):
    try:
        result = service.delete_venta(id)
        return {"message": result["message"], "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        return {"message": "Error inesperado al eliminar la venta.", "success": False}
