from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional

from src.controllers.auth_controller import get_current_user
from src.schemas import (
    CajaChicaMovimientoCreate,
    CajaChicaMovimientoUpdate,
)
from src.services.caja_chica_services import CajaChicaService

router = APIRouter(prefix="/caja_chica", tags=["Caja Chica"])
service = CajaChicaService()


@router.get("/movimientos", response_model=Dict[str, Any])
def listar_movimientos(
    sucursal_id: int,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    current_user=Depends(get_current_user),
):
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
        print(f"❌ Error al listar movimientos de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al listar movimientos")


@router.post("/movimientos", response_model=Dict[str, Any])
def crear_movimiento(
    payload: CajaChicaMovimientoCreate,
    current_user=Depends(get_current_user),
):
    try:
        return service.registrar_egreso(payload.model_dump(), current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al registrar movimiento de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al registrar el movimiento")


@router.put("/movimientos/{movimiento_id}", response_model=Dict[str, Any])
def actualizar_movimiento(
    movimiento_id: int,
    payload: CajaChicaMovimientoUpdate,
    current_user=Depends(get_current_user),
):
    try:
        return service.actualizar_movimiento(movimiento_id, payload.model_dump(exclude_unset=True), current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al actualizar movimiento de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al actualizar el movimiento")


@router.delete("/movimientos/{movimiento_id}", response_model=Dict[str, Any])
def eliminar_movimiento(
    movimiento_id: int,
    current_user=Depends(get_current_user),
):
    try:
        return service.eliminar_movimiento(movimiento_id, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al eliminar movimiento de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al eliminar el movimiento")


@router.get("/ingresos", response_model=Dict[str, Any])
def obtener_ingresos(
    sucursal_id: int,
    current_user=Depends(get_current_user),
):
    try:
        return service.obtener_ingresos(sucursal_id, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al obtener ingresos de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener ingresos")


@router.get("/egresos", response_model=Dict[str, Any])
def obtener_egresos(
    sucursal_id: int,
    current_user=Depends(get_current_user),
):
    try:
        return service.obtener_egresos(sucursal_id, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al obtener egresos de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener egresos")


@router.post("/movimientos/{movimiento_id}/enviar-concentradora", response_model=Dict[str, Any])
def enviar_a_concentradora(
    movimiento_id: int,
    current_user=Depends(get_current_user),
):
    try:
        return service.enviar_a_concentradora(movimiento_id, current_user)
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        print(f"❌ Error al enviar a concentradora: {exc}")
        raise HTTPException(status_code=500, detail="Error inesperado al enviar a concentradora")
