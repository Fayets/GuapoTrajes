from fastapi import APIRouter, Depends, HTTPException
from src.schemas import OrdenTrabajoCreateSchema, OrdenTrabajoResponseSchema, ProductoReservadoSchema
from src.services.orden_trabajo_services import crear_orden_trabajo, listar_ordenes_trabajo
from pony.orm import db_session
from src.controllers.auth_controller import get_current_user
from fastapi.responses import FileResponse
from src.models import OrdenTrabajo


router = APIRouter(prefix="/ordenes", tags=["Ordenes de Trabajo"])

@db_session
@router.post("/", response_model=OrdenTrabajoResponseSchema)
def convertir_presupuesto_orden(data: OrdenTrabajoCreateSchema):
    try:
        orden = crear_orden_trabajo(data.presupuesto_id, data.seña_pagada, data.metodo_pago)

        return {
            "id": orden.id,
            "presupuesto_id": orden.presupuesto.id,
            "fecha_creacion": orden.fecha_creacion,
            "fecha_evento": orden.fecha_evento,
            "estado": orden.estado,
            "seña_pagada": orden.seña_pagada,
            "saldo_pendiente": orden.saldo_pendiente,
            "metodo_pago": orden.metodo_pago,
            "productos_reservados": [
                {
                    "producto_id": pr.producto.id,
                    "estado": pr.estado,
                    "fecha_bloqueo": pr.fecha_bloqueo,
                    "observaciones": pr.observaciones,
                }
                for pr in orden.productos_reservados
            ]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

ordenes_router = APIRouter()

@router.get("/ordenes-trabajo/")
def get_ordenes_trabajo(user: dict = Depends(get_current_user)):
    return listar_ordenes_trabajo()

