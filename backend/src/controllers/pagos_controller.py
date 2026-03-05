from fastapi import APIRouter, HTTPException, Depends
from pony.orm import db_session, select, desc
from datetime import datetime
from src.models import Presupuesto, CuentaCorriente, OrdenTrabajo
from src.services.pagos_services import PagosServices
from src.controllers.auth_controller import get_current_user
from src.schemas import PagoAdicionalRequest

router = APIRouter(prefix="/pagos")
servicio = PagosServices()

@router.post("/adicional")
def registrar_pago_adicional(data: PagoAdicionalRequest, current_user=Depends(get_current_user)):
    try:
        return servicio.registrar_pago_adicional(data, current_user.id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al registrar pago: {str(e)}")

@router.get("/movimientos/{cliente_id}")
def obtener_movimientos_cliente(cliente_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.obtener_movimientos_cliente(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener movimientos: {str(e)}")

@router.get("/saldo/{cliente_id}")
def obtener_saldo_cliente(cliente_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.obtener_saldo_actual_cliente(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener saldo: {str(e)}")
