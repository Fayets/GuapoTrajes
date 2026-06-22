from fastapi import APIRouter, HTTPException, Depends
from src.services.pagos_services import PagosServices
from src.controllers.auth_controller import get_current_user
from src.schemas import PagoAdicionalRequest, CreditoManualRequest
from src.deps import require_role
from src.models import Roles

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


@router.post("/credito-manual")
def registrar_credito_manual(
    data: CreditoManualRequest,
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """Alta manual de saldo a favor (solo ADMIN o SUPER_ADMIN)."""
    try:
        return servicio.registrar_credito_manual(data, current_user.id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error inesperado al registrar crédito manual: {str(e)}"
        )
