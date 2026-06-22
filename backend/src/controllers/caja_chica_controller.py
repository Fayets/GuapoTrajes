from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
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


@router.get("/exportar-excel")
def exportar_caja_chica_excel(
    fecha_desde: date = Query(..., description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: date = Query(..., description="Fecha hasta (YYYY-MM-DD)"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    current_user=Depends(get_current_user),
):
    """Exportar movimientos de caja chica a Excel por rango de fechas."""
    try:
        import io

        import pandas as pd
        from fastapi.responses import StreamingResponse

        datos = service.obtener_movimientos_rango(
            sucursal_id=sucursal_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            current_user=current_user,
        )

        filas_mov = []
        for mov in datos["movimientos"]:
            fecha_raw = mov.get("fecha") or ""
            fecha_str = fecha_raw[:10] if isinstance(fecha_raw, str) else ""
            hora_str = fecha_raw[11:19] if isinstance(fecha_raw, str) and len(fecha_raw) > 11 else ""
            filas_mov.append(
                {
                    "Fecha": fecha_str,
                    "Hora": hora_str,
                    "Usuario": mov.get("usuario_nombre"),
                    "Tipo": mov.get("tipo_movimiento"),
                    "Tipo de egreso": mov.get("tipo_egreso") or "",
                    "Método de pago": mov.get("metodo_pago"),
                    "Monto": mov.get("monto"),
                    "Descripción": mov.get("descripcion") or "",
                    "Estado": mov.get("estado"),
                    "Referencia": mov.get("referencia") or "",
                    "Etiqueta": mov.get("etiqueta") or "",
                }
            )

        df_mov = pd.DataFrame(filas_mov)
        df_resumen = pd.DataFrame(
            [
                {"Concepto": "Total ingresos", "Monto": datos["total_ingresos"]},
                {"Concepto": "Total egresos", "Monto": datos["total_egresos"]},
                {"Concepto": "Saldo neto", "Monto": datos["total_neto"]},
            ]
        )

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df_mov.to_excel(writer, sheet_name="Movimientos", index=False)
            df_resumen.to_excel(writer, sheet_name="Resumen", index=False)

        output.seek(0)
        nombre_sucursal = (datos.get("sucursal_nombre") or "sucursal").replace(" ", "_")
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=caja_chica_{nombre_sucursal}_{fecha_desde}_{fecha_hasta}.xlsx"
                )
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"❌ Error al exportar Excel de caja chica: {exc}")
        raise HTTPException(status_code=500, detail="Error al exportar Excel de caja chica")


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
