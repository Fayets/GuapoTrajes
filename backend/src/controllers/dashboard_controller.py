from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.controllers.auth_controller import get_current_user
from src.fechas_ar import hoy_ar
from src.services.dashboard_services import DashboardServices

router = APIRouter()
servicio = DashboardServices()


@router.get("/kpis")
def obtener_kpis(
    fecha: date = Query(default_factory=hoy_ar, description="Día de las ventas y del efectivo"),
    sucursal_id: Optional[int] = Query(
        None, description="Sucursal de la caja en pantalla. Las ventas usan la sucursal del usuario."
    ),
    current_user=Depends(get_current_user),
):
    """Tarjetas del dashboard en un solo pedido."""
    return servicio.kpis(
        fecha=fecha,
        user_id=current_user.id,
        sucursal_caja_id=sucursal_id,
    )
