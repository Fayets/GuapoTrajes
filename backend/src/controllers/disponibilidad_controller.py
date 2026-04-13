from fastapi import APIRouter, HTTPException, Query
from datetime import date
from src.services.disponibilidad_services import verificar_disponibilidad

router = APIRouter(prefix="/productos")

@router.get("/{producto_id}/disponibilidad")
def disponibilidad(
    producto_id: int,
    fecha_retiro: date = Query(..., description="Fecha de retiro"),
    fecha_devolucion: date = Query(..., description="Fecha de devolución")
):
    try:
        disponible = verificar_disponibilidad(producto_id, fecha_retiro, fecha_devolucion)
        return {
            "producto_id": producto_id,
            "fecha_retiro": fecha_retiro,
            "fecha_devolucion": fecha_devolucion,
            "disponible": disponible
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
