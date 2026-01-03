from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date
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
            sucursal_id=sucursal_id
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
                "cantidad_total": resultado["cantidad_total"]
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener ingresos por tipo: {str(e)}")

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

