from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date
from typing import Optional
from src.services.reportes_services import ReportesServices
from src.controllers.auth_controller import get_current_user

router = APIRouter(prefix="/reportes")
servicio = ReportesServices()

@router.get("/alquileres-por-prenda")
def obtener_alquileres_por_prenda(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de alquileres por prenda en un rango de fechas.
    Muestra la cantidad de veces que cada prenda fue alquilada.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_alquileres_por_prenda(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de alquileres por prenda obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "total_alquileres": sum(item["cantidad_total_alquilada"] for item in resultado),
                "alquileres": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener reporte: {str(e)}")

@router.get("/ranking-alquileres")
def obtener_ranking_alquileres(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    ordenar_por: str = Query("veces_alquilada", description="Criterio de ordenamiento: 'veces_alquilada' o 'cantidad_total'"),
    current_user=Depends(get_current_user)
):
    """
    Obtener ranking de prendas ordenadas por cantidad de alquileres.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        # Validar criterio de ordenamiento
        if ordenar_por not in ["veces_alquilada", "cantidad_total"]:
            ordenar_por = "veces_alquilada"
        
        resultado = servicio.obtener_ranking_alquileres(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id,
            ordenar_por=ordenar_por
        )
        
        return {
            "message": "Ranking de alquileres obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "ordenar_por": ordenar_por,
                "total_productos": len(resultado),
                "ranking": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener ranking: {str(e)}")

@router.get("/contratos-por-fecha")
def obtener_contratos_por_fecha(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    filtro_fecha: str = Query("fecha_creacion", description="Campo de fecha a usar: 'fecha_creacion' o 'fecha_evento'"),
    tipo: str = Query("todos", description="Tipo de contrato: 'todos', 'presupuestos', 'ordenes_trabajo'"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de contratos (presupuestos y órdenes de trabajo) por rango de fechas.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        # Validar filtro de fecha
        if filtro_fecha not in ["fecha_creacion", "fecha_evento"]:
            filtro_fecha = "fecha_creacion"
        
        # Validar tipo
        if tipo not in ["todos", "presupuestos", "ordenes_trabajo"]:
            tipo = "todos"
        
        resultado = servicio.obtener_contratos_por_fecha(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id,
            filtro_fecha=filtro_fecha,
            tipo=tipo
        )
        
        return {
            "message": "Reporte de contratos por fecha obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "filtro_fecha": filtro_fecha,
                "tipo": tipo,
                "total_contratos": len(resultado),
                "total_monto": sum(item["total"] for item in resultado),
                "contratos": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener contratos: {str(e)}")

@router.get("/recibos-por-fecha")
def obtener_recibos_por_fecha(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de recibos (comprobantes) de señas y pagos adicionales por rango de fechas.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_recibos_por_fecha(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de recibos por fecha obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "total_recibos": len(resultado),
                "total_monto": sum(item["monto"] for item in resultado),
                "recibos": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener recibos: {str(e)}")

@router.get("/ingresos-por-tipo")
def obtener_ingresos_por_tipo(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de ingresos agrupados por método de pago en un rango de fechas.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_ingresos_por_tipo(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id,
            cuenta_destino_id=cuenta_destino_id,
            categoria=categoria,
            payment_method=payment_method
        )
        
        return {
            "message": "Reporte de ingresos por tipo obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "ingresos_por_tipo": resultado["ingresos_por_tipo"],
                "total_general": resultado["total_general"],
                "cantidad_total": resultado["cantidad_total"],
                "detalles": resultado.get("detalles", [])
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener ingresos por tipo: {str(e)}")


def _generar_pdf_ingresos_por_tipo(resultado: dict, fecha_desde: date, fecha_hasta: date) -> bytes:
    import io

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    def _txt(val, max_len: int = 40) -> str:
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
        "IngresosTitle",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "IngresosSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=10,
    )

    elements = []
    elements.append(Paragraph("Ingresos por tipo — Detalle de movimientos", title_style))
    if fecha_desde == fecha_hasta:
        periodo = f"Fecha: {fecha_desde.strftime('%d/%m/%Y')}"
    else:
        periodo = (
            f"Período: {fecha_desde.strftime('%d/%m/%Y')} "
            f"al {fecha_hasta.strftime('%d/%m/%Y')}"
        )
    elements.append(Paragraph(periodo, subtitle_style))

    detalle_headers = [
        "Fecha",
        "Hora",
        "Origen",
        "Categoría",
        "Método",
        "Monto",
        "Cuenta destino",
        "Usuario",
    ]
    table_data = [detalle_headers]
    detalles = resultado.get("detalles") or []
    for det in detalles:
        fecha_hora = det.get("fecha_hora") or ""
        fecha_str = ""
        hora_str = ""
        if fecha_hora:
            try:
                from datetime import datetime

                dt = datetime.fromisoformat(str(fecha_hora).replace("Z", "+00:00"))
                fecha_str = dt.strftime("%d/%m/%Y")
                hora_str = dt.strftime("%H:%M")
            except Exception:
                fecha_str = str(fecha_hora)[:10]
                hora_str = str(fecha_hora)[11:16]
        table_data.append(
            [
                fecha_str,
                hora_str,
                _txt(det.get("origen"), 34),
                _txt(det.get("categoria"), 16),
                _txt(det.get("metodo_pago"), 20),
                f"${float(det.get('monto', 0)):,.2f}",
                _txt(det.get("cuenta_destino_nombre"), 22),
                _txt(det.get("usuario_nombre"), 22),
            ]
        )

    if len(table_data) == 1:
        table_data.append(["Sin movimientos en el período seleccionado.", "", "", "", "", "", "", ""])

    mov_table = Table(table_data, repeatRows=1)
    mov_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f3f5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ALIGN", (5, 1), (5, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dee2e6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafbfc")]),
            ]
        )
    )
    elements.append(mov_table)
    elements.append(Spacer(1, 14))

    resumen_headers = ["Método de pago", "Cantidad", "Total"]
    resumen_data = [resumen_headers]
    for item in resultado.get("ingresos_por_tipo") or []:
        resumen_data.append(
            [
                _txt(item.get("metodo"), 50),
                str(item.get("cantidad", 0)),
                f"${float(item.get('total', 0)):,.2f}",
            ]
        )
    resumen_data.append(
        [
            "TOTAL GENERAL",
            str(resultado.get("cantidad_total", 0)),
            f"${float(resultado.get('total_general', 0)):,.2f}",
        ]
    )
    resumen_table = Table(resumen_data, colWidths=[280, 80, 120])
    resumen_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e7f1ff")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
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


@router.get("/ingresos-por-tipo/exportar-pdf")
def exportar_ingresos_por_tipo_pdf(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    cuenta_destino_id: Optional[int] = Query(None, description="Filtrar por cuenta destino"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    payment_method: Optional[str] = Query(None, description="Filtrar por método de pago"),
    current_user=Depends(get_current_user),
):
    """Exportar detalle de ingresos por tipo a PDF."""
    try:
        from fastapi.responses import StreamingResponse

        sucursal_id = current_user.sucursal.id
        resultado = servicio.obtener_ingresos_por_tipo(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id,
            cuenta_destino_id=cuenta_destino_id,
            categoria=categoria,
            payment_method=payment_method,
        )
        pdf_bytes = _generar_pdf_ingresos_por_tipo(resultado, fecha_desde, fecha_hasta)

        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=ingresos_por_tipo_{fecha_desde}_{fecha_hasta}.pdf"
                )
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error inesperado al exportar ingresos por tipo: {str(e)}"
        )


@router.get("/stock-por-estado")
def obtener_stock_por_estado(
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de stock agrupado por estado de producto.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_stock_por_estado(
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de stock por estado obtenido exitosamente",
            "success": True,
            "data": {
                "sucursal_id": sucursal_id,
                "stock_por_estado": resultado["stock_por_estado"],
                "total_productos": resultado["total_productos"]
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener stock por estado: {str(e)}")

@router.get("/stock-por-linea")
def obtener_stock_por_linea(
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de stock agrupado por línea de producto, valorizado a costo y precio de venta.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_stock_por_linea(
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de stock por línea obtenido exitosamente",
            "success": True,
            "data": {
                "sucursal_id": sucursal_id,
                "stock_por_linea": resultado["stock_por_linea"],
                "total_productos": resultado["total_productos"],
                "total_valor_costo": resultado["total_valor_costo"],
                "total_valor_venta": resultado["total_valor_venta"]
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener stock por línea: {str(e)}")

@router.get("/saldos-a-cobrar")
def obtener_saldos_a_cobrar(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de saldos pendientes a cobrar de clientes en un rango de fechas.
    Muestra las órdenes de trabajo con saldo_pendiente > 0, filtradas por fecha del evento.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_saldos_a_cobrar(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        total_saldo = sum(item["total_saldo_pendiente"] for item in resultado)
        
        return {
            "message": "Reporte de saldos a cobrar obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "total_clientes": len(resultado),
                "total_saldo_pendiente": total_saldo,
                "saldos": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener saldos a cobrar: {str(e)}")

@router.get("/prendas-a-armar")
def obtener_prendas_a_armar(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de prendas a armar (órdenes de trabajo a entregar).
    Muestra las órdenes de trabajo con fecha_evento entre las fechas seleccionadas,
    incluyendo los productos/conjuntos que hay que separar para cada cliente.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_prendas_a_armar(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de prendas a armar obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "total_ordenes": len(resultado),
                "ordenes": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener prendas a armar: {str(e)}")

@router.get("/no-devolvieron")
def obtener_no_devolvieron(
    fecha_hasta: Optional[date] = Query(None, description="Fecha de referencia para comparar (default: fecha actual)"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de órdenes de trabajo que no han devuelto los productos.
    Muestra las órdenes donde la fecha_devolucion ya pasó y los productos no fueron devueltos.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_no_devolvieron(
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de no devolvieron obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
                "sucursal_id": sucursal_id,
                "total_ordenes": len(resultado),
                "ordenes": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener no devolvieron: {str(e)}")

@router.get("/productos-criticos")
def obtener_productos_criticos(
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de productos críticos (alquilados más de 10 veces).
    Estos productos están para cambio o venta por desgaste.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_productos_criticos(
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de productos críticos obtenido exitosamente",
            "success": True,
            "data": {
                "sucursal_id": sucursal_id,
                "total_productos": len(resultado),
                "productos": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener productos críticos: {str(e)}")

@router.get("/productos-criticos-armado")
def obtener_productos_criticos_armado(
    fecha_desde: date = Query(..., description="Fecha desde para el reporte"),
    fecha_hasta: date = Query(..., description="Fecha hasta para el reporte"),
    current_user=Depends(get_current_user)
):
    """
    Obtener reporte de productos críticos para el armado semanal.
    Lista productos que no están disponibles (en lavandería, modista, cliente)
    y que se necesitan para órdenes de trabajo en el rango de fechas seleccionado.
    Filtra automáticamente por la sucursal del usuario logueado.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_productos_criticos_armado(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id
        )
        
        return {
            "message": "Reporte de productos críticos para armado obtenido exitosamente",
            "success": True,
            "data": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "sucursal_id": sucursal_id,
                "total_productos": len(resultado),
                "productos": resultado
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener productos críticos para armado: {str(e)}")

@router.get("/historico-producto")
def obtener_historico_producto(
    codigo_barra: str = Query(..., description="Código de barras del producto"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha hasta la cual se busca el histórico (default: fecha actual)"),
    page: int = Query(1, ge=1, description="Número de página (1-based)"),
    page_size: int = Query(
        10,
        ge=1,
        le=10,
        description="Eventos por página (máximo 10)",
    ),
    current_user=Depends(get_current_user)
):
    """
    Obtener histórico completo (trazabilidad) de un producto desde su ingreso al stock hasta una fecha determinada.
    Incluye: ingreso, alquileres, lavandería, modista, ventas.
    Filtra automáticamente por la sucursal del usuario logueado.
    Los eventos van del más reciente al más antiguo; la respuesta está paginada.
    """
    try:
        # Obtener la sucursal del usuario actual (es obligatoria según el modelo)
        sucursal_id = current_user.sucursal.id
        
        resultado = servicio.obtener_historico_producto(
            codigo_barra=codigo_barra,
            fecha_hasta=fecha_hasta,
            sucursal_id=sucursal_id,
            page=page,
            page_size=page_size,
        )
        
        return {
            "message": "Histórico de producto obtenido exitosamente",
            "success": True,
            "data": resultado
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener histórico de producto: {str(e)}")

