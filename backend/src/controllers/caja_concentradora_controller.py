from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Any, Dict

from src.controllers.auth_controller import get_current_user
from src.services.caja_concentradora_services import CajaConcentradoraServices


router = APIRouter(prefix="/caja_concentradora", tags=["Caja Concentradora"])
service = CajaConcentradoraServices()


@router.get("/listar/{sucursal_id}")
def listar_envios(sucursal_id: int, current_user=Depends(get_current_user)):
    try:
        response = service.listar_envios(sucursal_id, current_user)
        return response
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"❌ Error al listar envíos de la concentradora: {e}")
        return {
            "message": "Error inesperado al listar los envíos",
            "success": False,
            "data": None,
        }


@router.get("/saldo/{sucursal_id}")
def obtener_saldo(sucursal_id: int, current_user=Depends(get_current_user)):
    try:
        response = service.obtener_saldo(sucursal_id, current_user)
        return response
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"❌ Error al obtener saldo de la concentradora: {e}")
        return {
            "message": "Error inesperado al obtener el saldo",
            "success": False,
            "data": None,
        }


@router.get("/movimientos", response_model=Dict[str, Any])
def listar_movimientos(
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: INGRESO o EGRESO"),
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    current_user=Depends(get_current_user),
):
    """Listar todos los movimientos de caja concentradora."""
    try:
        return service.listar_movimientos(
            sucursal_id=sucursal_id,
            current_user=current_user,
            tipo=tipo,
            estado=estado,
        )
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error inesperado al listar movimientos")


@router.post("/enviar-caja-chica", response_model=Dict[str, Any])
def enviar_a_caja_chica(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
):
    """Enviar dinero desde Caja Concentradora a Caja Chica (solo administradores)."""
    try:
        return service.enviar_a_caja_chica(payload, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al enviar a caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al enviar a caja chica")


@router.post("/retiro", response_model=Dict[str, Any])
def registrar_retiro(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
):
    """Registrar un egreso manual (solo administradores)."""
    try:
        return service.registrar_egreso(payload, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al registrar retiro: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al registrar retiro")


@router.put("/movimientos/{movimiento_id}", response_model=Dict[str, Any])
def actualizar_movimiento(
    movimiento_id: int,
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
):
    """Actualizar un movimiento de caja concentradora (solo administradores)."""
    try:
        return service.actualizar_movimiento(movimiento_id, payload, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al actualizar movimiento de caja concentradora: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al actualizar el movimiento")


@router.delete("/movimientos/{movimiento_id}", response_model=Dict[str, Any])
def eliminar_movimiento(
    movimiento_id: int,
    current_user=Depends(get_current_user),
):
    """Eliminar un movimiento de caja concentradora (solo administradores)."""
    try:
        return service.eliminar_movimiento(movimiento_id, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al eliminar movimiento de caja concentradora: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al eliminar el movimiento")


@router.post("/vaciar/{sucursal_id}")
def vaciar_caja(sucursal_id: int, current_user=Depends(get_current_user)):
    try:
        response = service.vaciar_caja(sucursal_id, current_user)
        return response
    except HTTPException as e:
        return {"message": e.detail, "success": False, "data": None}
    except Exception as e:
        print(f"❌ Error al vaciar la concentradora: {e}")
        return {
            "message": "Error inesperado al vaciar la caja concentradora",
            "success": False,
            "data": None,
        }

