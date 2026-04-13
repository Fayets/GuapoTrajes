
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional

from src.fechas_ar import parse_fecha_query_presupuesto
from src.services.presupuestos_services import PresupuestosServices
from src.schemas import PresupuestoCreate, ConjuntoMismaFechaCategoriaOut
from src.controllers.auth_controller import get_current_user

router = APIRouter(prefix="/presupuestos")
servicio = PresupuestosServices()

@router.post("/")
def crear(data: PresupuestoCreate, current_user=Depends(get_current_user)):
    try:
        resultado = servicio.crear_presupuesto(data, current_user)
        return resultado
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/")
def obtener_todos(current_user=Depends(get_current_user)):
    try:
        return servicio.listar_presupuestos()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener presupuestos: {str(e)}")


@router.get(
    "/conjuntos-misma-fecha-categoria",
    response_model=List[ConjuntoMismaFechaCategoriaOut],
)
def conjuntos_misma_fecha_categoria(
    fecha_evento: str = Query(..., min_length=10, description="YYYY-MM-DD (solo día calendario)"),
    categoria_evento: str = Query(..., min_length=1, description="Categoría del evento"),
    excluir_id: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    """Lista presupuestos existentes con misma fecha de evento y categoría (para aviso en alta)."""
    try:
        fev = parse_fecha_query_presupuesto(fecha_evento)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="fecha_evento inválida; usar YYYY-MM-DD o ISO con zona",
        )
    try:
        return servicio.listar_conjuntos_misma_fecha_categoria(
            fecha_evento=fev,
            categoria_evento=categoria_evento,
            excluir_presupuesto_id=excluir_id,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")


@router.get("/{presupuesto_id}")
def obtener_por_id(presupuesto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.obtener_presupuesto_por_id(presupuesto_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener presupuesto: {str(e)}")

@router.put("/{presupuesto_id}")
def actualizar_presupuesto(presupuesto_id: int, data: PresupuestoCreate, current_user=Depends(get_current_user)):
    try:
        return servicio.editar_presupuesto(presupuesto_id, data, current_user)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar presupuesto: {str(e)}")

@router.delete("/{presupuesto_id}")
def eliminar_presupuesto(presupuesto_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.eliminar_presupuesto(presupuesto_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar presupuesto: {str(e)}")