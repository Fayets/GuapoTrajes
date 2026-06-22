from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from src.services.caja_services import CajaServices
from src.controllers.auth_controller import get_current_user
from src.deps import require_role
from src.schemas import CajaReporteRequest, CajaReporteResponse, TransferenciaCajaChicaRequest

router = APIRouter()
service = CajaServices()

class CajaDiariaResponse(BaseModel):
    movimientos: List[dict]
    totales: dict
    saldo_efectivo: Optional[float] = None
    cierre_registrado: Optional[bool] = None

@router.get("/diaria", response_model=CajaDiariaResponse)
def get_caja_diaria(
    fecha: date = Query(default_factory=date.today, description="Fecha para consultar caja diaria"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    current_user=Depends(get_current_user)
):
    """Obtener caja diaria con movimientos y totales"""
    try:
        movimientos = service.get_movimientos_diarios(fecha, sucursal_id, payment_method, cuenta_destino_id)
        totales = service.get_totales_diarios(fecha, sucursal_id)
        saldo_efectivo = service.get_saldo_efectivo_dia(fecha, sucursal_id)
        cierre_registrado = service.existe_cierre(fecha, sucursal_id)
        return CajaDiariaResponse(
            movimientos=movimientos,
            totales=totales,
            saldo_efectivo=saldo_efectivo,
            cierre_registrado=cierre_registrado,
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

        if movimiento_data["tipo"] in ("EGRESO", "AJUSTE_NEGATIVO"):
            raise HTTPException(
                status_code=400,
                detail="Los egresos solo pueden registrarse como transferencias a Caja Chica. Utilizá el endpoint dedicado."
            )

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


class CierreCajaRequest(BaseModel):
    fecha: date
    sucursal_id: int


@router.post("/diaria/cierre")
def registrar_cierre_caja(
    payload: CierreCajaRequest,
    current_user=Depends(get_current_user)
):
    """Registrar cierre de caja (efectivo en cero) para la fecha y sucursal."""
    try:
        return service.registrar_cierre(payload.fecha, payload.sucursal_id, current_user.id)
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error al registrar cierre de caja: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado al registrar cierre de caja")


@router.get("/cierres-pendientes")
def get_cierres_pendientes(
    fecha: Optional[date] = Query(None, description="Fecha a consultar (por defecto ayer)"),
    current_user=Depends(require_role("ADMIN", "SUPER_ADMIN")),
):
    """Para administrador: sucursales sin cierre de caja para la fecha indicada."""
    try:
        return {"pendientes": service.get_cierres_pendientes(fecha)}
    except Exception as e:
        print(f"❌ Error al obtener cierres pendientes: {e}")
        raise HTTPException(status_code=500, detail="Error inesperado")


@router.get("/exportar-csv")
def exportar_caja_csv(
    fecha_desde: date = Query(..., description="Fecha desde"),
    fecha_hasta: date = Query(..., description="Fecha hasta"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    current_user=Depends(get_current_user),
):
    """Compatibilidad: la exportación CSV fue reemplazada por Excel."""
    return exportar_caja_excel(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        sucursal_id=sucursal_id,
        payment_method=payment_method,
        cuenta_destino_id=cuenta_destino_id,
        current_user=current_user,
    )


@router.get("/exportar-excel")
def exportar_caja_excel(
    fecha_desde: date = Query(..., description="Fecha desde"),
    fecha_hasta: date = Query(..., description="Fecha hasta"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    current_user=Depends(get_current_user)
):
    """Exportar detalle de movimientos de caja diaria a Excel."""
    try:
        from fastapi.responses import StreamingResponse
        import io
        import pandas as pd

        datos = service.get_movimientos_rango(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            payment_method=payment_method,
            sucursal_id=sucursal_id,
            cuenta_destino_id=cuenta_destino_id,
        )

        filas_mov = [
            {
                "Fecha": mov["fecha"],
                "Hora": mov["hora"],
                "Origen": mov["origen"],
                "Tipo": mov["tipo"],
                "Categoría": mov["categoria"] or "",
                "Método de pago": mov["payment_method"] or "N/A",
                "Monto": mov["monto"],
                "Importe neto": mov["importe_neto"],
                "Usuario": mov["usuario_nombre"],
                "Cuenta destino": mov["cuenta_destino_nombre"] or "",
                "Destino": mov["destino"] or "",
                "Sucursal": mov["sucursal_nombre"],
            }
            for mov in datos["movimientos"]
        ]

        df_movimientos = pd.DataFrame(
            filas_mov,
            columns=[
                "Fecha",
                "Hora",
                "Origen",
                "Tipo",
                "Categoría",
                "Método de pago",
                "Monto",
                "Importe neto",
                "Usuario",
                "Cuenta destino",
                "Destino",
                "Sucursal",
            ],
        )

        resumen_data = [
            {"Método de pago": metodo, "Total neto": monto}
            for metodo, monto in datos["resumen_por_metodo"].items()
        ]
        resumen_data.append(
            {"Método de pago": "TOTAL GENERAL", "Total neto": datos["total_general"]}
        )
        df_resumen = pd.DataFrame(resumen_data)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df_movimientos.to_excel(writer, sheet_name="Movimientos", index=False)
            df_resumen.to_excel(writer, sheet_name="Resumen", index=False)

        output.seek(0)
        nombre_sucursal = (datos.get("sucursal_nombre") or "sucursal").replace(" ", "_")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=caja_diaria_{nombre_sucursal}_{fecha_desde}_{fecha_hasta}.xlsx"
                )
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al exportar Excel: {e}")
        raise HTTPException(status_code=500, detail="Error al exportar Excel")


def _generar_pdf_caja_diaria(datos: dict, fecha_desde: date, fecha_hasta: date) -> bytes:
    import io

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    def _txt(val, max_len: int = 42) -> str:
        s = str(val or "").strip()
        return s if len(s) <= max_len else s[: max_len - 1] + "…"

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=28,
        rightMargin=28,
        topMargin=32,
        bottomMargin=32,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CajaTitle",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "CajaSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=10,
    )

    elements = []
    elements.append(
        Paragraph(f"Caja Diaria — {_txt(datos.get('sucursal_nombre'), 60)}", title_style)
    )
    if fecha_desde == fecha_hasta:
        periodo = f"Fecha: {fecha_desde.strftime('%d/%m/%Y')}"
    else:
        periodo = (
            f"Período: {fecha_desde.strftime('%d/%m/%Y')} "
            f"al {fecha_hasta.strftime('%d/%m/%Y')}"
        )
    elements.append(Paragraph(periodo, subtitle_style))

    headers = [
        "Fecha",
        "Hora",
        "Origen",
        "Tipo",
        "Categoría",
        "Método",
        "Monto",
        "Neto",
        "Usuario",
    ]
    table_data = [headers]
    for mov in datos.get("movimientos", []):
        table_data.append(
            [
                mov.get("fecha", ""),
                mov.get("hora", "")[:5],
                _txt(mov.get("origen"), 36),
                mov.get("tipo", ""),
                _txt(mov.get("categoria"), 18),
                _txt(mov.get("payment_method"), 22),
                f"${float(mov.get('monto', 0)):,.2f}",
                f"${float(mov.get('importe_neto', 0)):,.2f}",
                _txt(mov.get("usuario_nombre"), 24),
            ]
        )

    if len(table_data) == 1:
        table_data.append(["Sin movimientos en el período seleccionado.", "", "", "", "", "", "", "", ""])

    mov_table = Table(table_data, repeatRows=1)
    mov_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f3f5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#212529")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ALIGN", (6, 1), (7, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dee2e6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafbfc")]),
            ]
        )
    )
    elements.append(mov_table)
    elements.append(Spacer(1, 14))

    resumen_headers = ["Método de pago", "Total neto"]
    resumen_data = [resumen_headers]
    for metodo, monto in datos.get("resumen_por_metodo", {}).items():
        resumen_data.append([_txt(metodo, 50), f"${float(monto):,.2f}"])
    resumen_data.append(
        ["TOTAL GENERAL", f"${float(datos.get('total_general', 0)):,.2f}"]
    )
    resumen_table = Table(resumen_data, colWidths=[280, 120])
    resumen_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e7f1ff")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dee2e6")),
            ]
        )
    )
    elements.append(Paragraph("Resumen por método de pago", styles["Heading3"]))
    elements.append(Spacer(1, 6))
    elements.append(resumen_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/exportar-pdf")
def exportar_caja_pdf(
    fecha_desde: date = Query(..., description="Fecha desde"),
    fecha_hasta: date = Query(..., description="Fecha hasta"),
    sucursal_id: int = Query(..., description="ID de la sucursal"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    current_user=Depends(get_current_user),
):
    """Exportar detalle de movimientos de caja diaria a PDF."""
    try:
        from fastapi.responses import StreamingResponse

        datos = service.get_movimientos_rango(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            payment_method=payment_method,
            sucursal_id=sucursal_id,
            cuenta_destino_id=cuenta_destino_id,
        )
        pdf_bytes = _generar_pdf_caja_diaria(datos, fecha_desde, fecha_hasta)
        nombre_sucursal = (datos.get("sucursal_nombre") or "sucursal").replace(" ", "_")

        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=caja_diaria_{nombre_sucursal}_{fecha_desde}_{fecha_hasta}.pdf"
                )
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al exportar PDF: {e}")
        raise HTTPException(status_code=500, detail="Error al exportar PDF")


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
