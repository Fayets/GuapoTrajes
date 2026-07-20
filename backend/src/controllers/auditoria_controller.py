from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.deps import require_role
from src.models import Roles
from src.services.auditoria_services import AuditoriaServices

router = APIRouter()
servicio = AuditoriaServices()


@router.get("")
def listar_auditoria(
    usuario_id: Optional[int] = Query(None),
    accion: Optional[str] = Query(None),
    entidad_tipo: Optional[str] = Query(None),
    entidad_id: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    return servicio.listar(
        current_user=current_user,
        usuario_id=usuario_id,
        accion=accion,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        sucursal_id=sucursal_id,
        page=page,
        page_size=page_size,
    )
