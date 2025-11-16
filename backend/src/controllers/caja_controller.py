from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from src.services.caja_services import CajaServices
from src.controllers.auth_controller import get_current_user
<<<<<<< HEAD
from src.schemas import CajaReporteRequest, CajaReporteResponse, TransferenciaCajaChicaRequest
=======
from src.schemas import CajaReporteRequest, CajaReporteResponse
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

router = APIRouter()
service = CajaServices()

class CajaDiariaResponse(BaseModel):
    movimientos: List[dict]
    totales: dict

@router.get("/diaria", response_model=CajaDiariaResponse)
def get_caja_diaria(
    fecha: date = Query(default_factory=date.today, description="Fecha para consultar caja diaria"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user)
):
    """Obtener caja diaria con movimientos y totales"""
    try:
        # Obtener movimientos del día
        movimientos = service.get_movimientos_diarios(fecha, sucursal_id, payment_method)
        
        # Obtener totales del día
        totales = service.get_totales_diarios(fecha, sucursal_id)
        
        return CajaDiariaResponse(
            movimientos=movimientos,
            totales=totales
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener caja diaria: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener caja diaria")

@router.post("/reporte-ingresos", response_model=CajaReporteResponse)
def get_reporte_ingresos(
    request: CajaReporteRequest,
    current_user=Depends(get_current_user)
):
    """Obtener reporte de ingresos por rango de fechas"""
    try:
        reporte = service.get_reporte_ingresos(
            fecha_desde=request.fecha_desde,
            fecha_hasta=request.fecha_hasta,
            payment_method=request.payment_method,
            sucursal_id=request.sucursal_id
        )
        
        return CajaReporteResponse(**reporte)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener reporte de ingresos: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener reporte de ingresos")

@router.post("/registrar-movimiento")
def registrar_movimiento(
    movimiento_data: dict,
    current_user=Depends(get_current_user)
):
    """Registrar un nuevo movimiento de caja"""
    try:
        # Validar datos requeridos
        required_fields = ["tipo", "monto", "origen", "sucursal_id", "payment_method", "categoria"]
        for field in required_fields:
            if field not in movimiento_data or not movimiento_data[field]:
                raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")
        
        # Validar que el monto sea positivo
        if movimiento_data["monto"] <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser positivo")
        
        # Validar que el tipo sea válido
        tipos_validos = ["INGRESO", "EGRESO", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]
        if movimiento_data["tipo"] not in tipos_validos:
            raise HTTPException(status_code=400, detail=f"Tipo de movimiento inválido. Debe ser uno de: {tipos_validos}")
<<<<<<< HEAD

        if movimiento_data["tipo"] in ("EGRESO", "AJUSTE_NEGATIVO"):
            raise HTTPException(
                status_code=400,
                detail="Los egresos solo pueden registrarse como transferencias a Caja Chica. Utilizá el endpoint dedicado."
            )

=======
        
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
        # Validar que el método de pago sea válido
        metodos_validos = ["EFECTIVO", "DEBITO", "CREDITO", "BILLETERA_VIRTUAL", "TRANSFERENCIA"]
        if movimiento_data["payment_method"] not in metodos_validos:
            raise HTTPException(status_code=400, detail=f"Método de pago inválido. Debe ser uno de: {metodos_validos}")
        
        # Crear el movimiento
        movimiento = service.create_movimiento(movimiento_data, current_user.id)
        
        return {
            "message": "Movimiento registrado exitosamente",
            "success": True,
            "data": {
                "id": movimiento.id,
                "fecha_hora": movimiento.fecha_hora,
                "tipo": movimiento.tipo,
                "monto": movimiento.monto,
                "origen": movimiento.origen,
                "payment_method": movimiento.payment_method,
                "categoria": movimiento.categoria,
                "sucursal_id": movimiento.sucursal.id,
                "usuario_id": movimiento.usuario.id
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al registrar movimiento: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al registrar movimiento")

<<<<<<< HEAD

@router.post("/diaria/transferir-caja-chica")
def transferir_a_caja_chica(
    payload: TransferenciaCajaChicaRequest,
    current_user=Depends(get_current_user)
):
    try:
        respuesta = service.transferir_a_caja_chica(payload.model_dump(), current_user.id)
        return respuesta
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al transferir efectivo a caja chica: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al transferir efectivo a Caja Chica")

@router.post("/diaria/enviar-caja-concentradora")
def transferir_a_caja_concentradora(
    payload: TransferenciaCajaChicaRequest,
    current_user=Depends(get_current_user)
):
    """Transferir efectivo desde Caja Diaria hacia Caja Concentradora."""
    try:
        respuesta = service.transferir_a_caja_concentradora(payload.model_dump(), current_user.id)
        return respuesta
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al transferir efectivo a caja concentradora: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al transferir efectivo a Caja Concentradora")

=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
@router.get("/exportar-csv")
def exportar_caja_csv(
    fecha_desde: date = Query(..., description="Fecha desde"),
    fecha_hasta: date = Query(..., description="Fecha hasta"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user)
):
    """Exportar movimientos de caja a CSV"""
    try:
        from fastapi.responses import StreamingResponse
        import csv
        import io
        
        # Obtener datos
        reporte = service.get_reporte_ingresos(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            payment_method=payment_method,
            sucursal_id=sucursal_id
        )
        
        # Crear CSV en memoria
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Encabezados
        writer.writerow([
            "Fecha", "Hora", "Origen", "Tipo", "Método de Pago", 
            "Monto", "Usuario", "Sucursal"
        ])
        
        # Datos
        for movimiento in reporte["movimientos"]:
            writer.writerow([
                movimiento["fecha_hora"].strftime("%Y-%m-%d"),
                movimiento["fecha_hora"].strftime("%H:%M"),
                movimiento["origen"],
                movimiento["tipo"],
                movimiento["payment_method"] or "N/A",
                f"${movimiento['monto']:,.2f}",
                movimiento["usuario_nombre"],
                movimiento["sucursal_nombre"]
            ])
        
        # Agregar totales
        writer.writerow([])
        writer.writerow(["RESUMEN POR MÉTODO DE PAGO"])
        for metodo, monto in reporte["resumen_por_metodo"].items():
            writer.writerow([metodo, "", "", "", "", f"${monto:,.2f}", "", ""])
        writer.writerow(["TOTAL GENERAL", "", "", "", "", f"${reporte['total_general']:,.2f}", "", ""])
        
        output.seek(0)
        
        # Retornar archivo CSV
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=caja_{fecha_desde}_{fecha_hasta}.csv"
            }
        )
        
    except Exception as e:
        print(f"❌ Error al exportar CSV: {e}")
        raise HTTPException(status_code=500, detail="Error al exportar CSV")

@router.get("/exportar-excel")
def exportar_caja_excel(
    fecha_desde: date = Query(..., description="Fecha desde"),
    fecha_hasta: date = Query(..., description="Fecha hasta"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user)
):
    """Exportar movimientos de caja a Excel"""
    try:
        from fastapi.responses import StreamingResponse
        import io
        import pandas as pd
        
        # Obtener datos
        reporte = service.get_reporte_ingresos(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            payment_method=payment_method,
            sucursal_id=sucursal_id
        )
        
        # Crear DataFrame con movimientos
        df_movimientos = pd.DataFrame(reporte["movimientos"])
        df_movimientos["fecha"] = df_movimientos["fecha_hora"].dt.date
        df_movimientos["hora"] = df_movimientos["fecha_hora"].dt.time
        
        # Crear DataFrame con resumen
        resumen_data = []
        for metodo, monto in reporte["resumen_por_metodo"].items():
            resumen_data.append({
                "Método de Pago": metodo,
                "Total": monto
            })
        resumen_data.append({
            "Método de Pago": "TOTAL GENERAL",
            "Total": reporte["total_general"]
        })
        df_resumen = pd.DataFrame(resumen_data)
        
        # Crear Excel en memoria
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_movimientos[["fecha", "hora", "origen", "tipo", "payment_method", "monto", "usuario_nombre", "sucursal_nombre"]].to_excel(
                writer, sheet_name="Movimientos", index=False
            )
            df_resumen.to_excel(writer, sheet_name="Resumen", index=False)
        
        output.seek(0)
        
        # Retornar archivo Excel
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=caja_{fecha_desde}_{fecha_hasta}.xlsx"
            }
        )
        
    except Exception as e:
        print(f"❌ Error al exportar Excel: {e}")
        raise HTTPException(status_code=500, detail="Error al exportar Excel")

@router.get("/presupuestos")
def get_movimientos_presupuestos(
    fecha: date = Query(default_factory=date.today, description="Fecha para consultar movimientos de presupuestos"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user)
):
    """Obtener movimientos de caja relacionados con presupuestos y órdenes de trabajo"""
    try:
        movimientos = service.get_movimientos_presupuestos(fecha, sucursal_id, payment_method)
        return {
            "message": "Movimientos de presupuestos obtenidos exitosamente",
            "success": True,
            "data": {
                "fecha": fecha,
                "sucursal_id": sucursal_id,
                "payment_method": payment_method,
                "movimientos": movimientos,
                "total_ingresos": sum(m["monto"] for m in movimientos if m["tipo"] == "INGRESO")
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener movimientos de presupuestos: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener movimientos de presupuestos")

@router.get("/buscar")
def buscar_movimientos_por_texto(
    texto: str = Query(..., description="Texto a buscar en concepto o referencia"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    fecha_desde: Optional[date] = Query(None, description="Fecha desde para filtrar"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha hasta para filtrar"),
    current_user=Depends(get_current_user)
):
    """Buscar movimientos por texto en concepto o referencia"""
    try:
        movimientos = service.buscar_movimientos_por_texto(
            texto, sucursal_id, fecha_desde, fecha_hasta
        )
        return {
            "message": "Búsqueda realizada exitosamente",
            "success": True,
            "data": {
                "texto_busqueda": texto,
                "sucursal_id": sucursal_id,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "total_resultados": len(movimientos),
                "movimientos": movimientos
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al buscar movimientos: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al buscar movimientos")

@router.post("/reporte-egresos", response_model=CajaReporteResponse)
def get_reporte_egresos(
    request: CajaReporteRequest,
    current_user=Depends(get_current_user)
):
    """Obtener reporte de egresos por rango de fechas"""
    try:
        reporte = service.get_reporte_egresos(
            fecha_desde=request.fecha_desde,
            fecha_hasta=request.fecha_hasta,
            sucursal_id=request.sucursal_id
        )
        
        return CajaReporteResponse(**reporte)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener reporte de egresos: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener reporte de egresos")

@router.post("/balance-financiero")
def get_balance_financiero(
    request: CajaReporteRequest,
    current_user=Depends(get_current_user)
):
    """Obtener balance financiero (ingresos - egresos) entre fechas"""
    try:
        balance = service.get_balance_financiero(
            fecha_desde=request.fecha_desde,
            fecha_hasta=request.fecha_hasta,
            sucursal_id=request.sucursal_id
        )
        
        return {
            "message": "Balance financiero obtenido exitosamente",
            "success": True,
            "data": balance
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener balance financiero: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener balance financiero")

@router.post("/saldos-pendientes")
def get_saldos_pendientes_clientes(
    request: CajaReporteRequest,
    current_user=Depends(get_current_user)
):
    """Obtener saldos pendientes de clientes entre fechas"""
    try:
        saldos = service.get_saldos_pendientes_clientes(
            fecha_desde=request.fecha_desde,
            fecha_hasta=request.fecha_hasta,
            sucursal_id=request.sucursal_id
        )
        
        return {
            "message": "Saldos pendientes obtenidos exitosamente",
            "success": True,
            "data": {
                "fecha_desde": request.fecha_desde,
                "fecha_hasta": request.fecha_hasta,
                "sucursal_id": request.sucursal_id,
                "total_clientes": len(saldos),
                "total_saldo_pendiente": sum(s["saldo_pendiente"] for s in saldos),
                "saldos": saldos
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al obtener saldos pendientes: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al obtener saldos pendientes")
