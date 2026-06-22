from fastapi import HTTPException, APIRouter, Depends, Query, Response
from pony.orm import *
from src import schemas
from src.services.productos_services import ProductoServices
from src.deps import get_current_user, require_role
from pydantic import BaseModel
from typing import List, Optional, Dict
from src.schemas import ProductUpdateResponse
from datetime import date
from src.services.disponibilidad_services import verificar_disponibilidad


# Product controller

router = APIRouter()
service = ProductoServices()  

class RegisterMessage(BaseModel):
    message: str
    success: bool
    data: Optional[Dict] = None

@router.post("/register", response_model=RegisterMessage, status_code=201, dependencies=[Depends(require_role("ADMIN"))])
def register_product(product: schemas.ProductCreate, current_user=Depends(get_current_user)):
    try:
        product_created = service.create_producto(product)
        return {
            "data": product_created,
            "message": "Producto creado con éxito.",
            "success": True,
        }
    except HTTPException as e:
        return {
            "message": e.detail,
            "success": False,
        }
    except Exception as e:
        return {
            "message": "Error inesperado al crear el producto.",
            "success": False,
        }


class UpdateMessage(BaseModel):
    message: str
    success: bool


@router.put("/update/{id}", response_model=ProductUpdateResponse, dependencies=[Depends(require_role("ADMIN"))])
def update_product(id: int, product_update: schemas.ProductUpdate, current_user=Depends(get_current_user)):
    try:
        service = ProductoServices()  # asegurar instancia
        update_result = service.update_product(id, product_update)
        producto_actualizado = update_result.get("producto")
        if not producto_actualizado:
            producto_actualizado = service.get_product_by_id(id)
        return {"message": update_result["message"], "data": update_result["producto"], "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        print(f"❌ Error en update_product: {e}")
        return {"message": "Error inesperado al actualizar el producto.", "success": False}


@router.patch(
    "/precios/masivo",
    dependencies=[Depends(require_role("ADMIN"))],
)
def update_prices_bulk(
    payload: schemas.ProductBulkPriceUpdateRequest,
    current_user=Depends(get_current_user),
):
    try:
        result = service.update_prices_bulk(payload)
        return {
            "message": "Actualización masiva de precios completada",
            "success": True,
            "data": result,
        }
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {
            "message": "Error inesperado en actualización masiva de precios.",
            "success": False,
        }


@router.patch("/estado/{id}")
def actualizar_estado_producto(id: int, payload: Dict[str, str], current_user=Depends(get_current_user)):
    try:
        nuevo_estado = payload.get("estado")
        if not nuevo_estado:
            raise HTTPException(status_code=400, detail="El estado es requerido")

        resultado = service.update_estado_producto(id, nuevo_estado, current_user)
        return resultado
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        print(f"❌ Error en actualizar_estado_producto: {e}")
        return {"message": "Error inesperado al actualizar el estado.", "success": False}


@router.get("/get/{codigo}", response_model=schemas.ProductResponse)
def get_product(codigo: str, current_user=Depends(get_current_user)):
    try:
        product_data = service.get_product_by_code(codigo)
        return product_data
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener el producto."
        )


@router.get("/all", response_model=List[schemas.ProductResponse])
def get_all_products(
    response: Response,
    current_user=Depends(get_current_user),
    estado: Optional[str] = Query(None, description="Filtrar por estado del producto"),
    linea_id: Optional[int] = Query(None, description="Filtrar por línea"),
    talle_id: Optional[int] = Query(None, description="Filtrar por talle"),
    tela_id: Optional[int] = Query(None, description="Filtrar por tela"),
    color_id: Optional[int] = Query(None, description="Filtrar por color"),
    page: int = Query(1, ge=1, description="Número de página (1-based)"),
    size: int = Query(20, ge=1, le=500, description="Tamaño de página"),
    fecha_retiro: Optional[date] = Query(
        None, description="Con fecha_devolucion: marca disponible_en_fechas por reservas"
    ),
    fecha_devolucion: Optional[date] = Query(
        None, description="Con fecha_retiro: marca disponible_en_fechas por reservas"
    ),
    presupuesto_excluir_id: Optional[int] = Query(
        None, description="Excluir este presupuesto al calcular disponible_en_fechas (edición)"
    ),
    orden_excluir_id: Optional[int] = Query(
        None, description="Excluir reservas de esta orden al calcular disponible_en_fechas (edición)"
    ),
    incluir_ventana_reserva: bool = Query(
        False,
        description="Si true, agrega en_ventana_reserva_hoy (regla [R-5,R] y órden con reserva)",
    ),
    ventana_reserva: Optional[str] = Query(
        None,
        description='Filtrar por ventana de reserva hoy: "si" = solo reservados, "no" = excluir reservados',
    ),
    q: Optional[str] = Query(
        None,
        description="Buscar por código, descripción, línea, talle, tela o color (en todo el inventario)",
    ),
    etiqueta_impresa: Optional[str] = Query(
        None,
        description='Filtrar por etiqueta de inventario impresa: "si" = impresas, "no" = pendientes',
    ),
):
    try:
        if (fecha_retiro is None) ^ (fecha_devolucion is None):
            raise HTTPException(
                status_code=400,
                detail="Enviá ambas query params fecha_retiro y fecha_devolucion, o ninguna.",
            )
        vf = (ventana_reserva or "").strip().lower()
        if vf and vf not in ("si", "no"):
            raise HTTPException(
                status_code=400,
                detail='ventana_reserva debe ser "si", "no" o omitirse.',
            )
        ei = (etiqueta_impresa or "").strip().lower()
        if ei and ei not in ("si", "no"):
            raise HTTPException(
                status_code=400,
                detail='etiqueta_impresa debe ser "si", "no" o omitirse.',
            )
        items, total = service.get_all_products(
            estado=estado,
            linea_id=linea_id,
            talle_id=talle_id,
            tela_id=tela_id,
            color_id=color_id,
            page=page,
            size=size,
            user_id=current_user.id,
            fecha_retiro=fecha_retiro,
            fecha_devolucion=fecha_devolucion,
            presupuesto_excluir_id=presupuesto_excluir_id,
            orden_excluir_id=orden_excluir_id,
            incluir_ventana_reserva=incluir_ventana_reserva,
            ventana_reserva_filtro=vf or None,
            q=q,
            etiqueta_impresa_filtro=ei or None,
        )
        # Headers de paginación
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Size"] = str(size)
        return items
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener los productos."
        )


@router.delete("/{codigo}", status_code=200, dependencies=[Depends(require_role("ADMIN"))])
def delete_product(codigo: str, current_user=Depends(get_current_user)):
    try:
        result = service.delete_product(codigo)
        return {"message": result["message"], "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception as e:
        return {
            "message": "Error inesperado al eliminar el producto.",
            "success": False,
        }


class StockAdjustMessage(BaseModel):
    message: str
    stock_actual: int


@router.get("/low_stock", response_model=List[schemas.ProductResponse])
def get_low_stock_products(current_user=Depends(get_current_user)):
    try:
        return service.get_low_stock_products()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener productos con stock bajo."
        )


# ===== Reportes existentes =====
@router.get("/total_products")
def total_products(current_user=Depends(get_current_user)):
    """Devuelve el total de productos en el inventario."""
    try:
        return service.get_total_products()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener el total de productos."
        )


@router.get("/inventory_value")
def inventory_value(current_user=Depends(get_current_user)):
    """Devuelve el valor total del inventario."""
    try:
        return service.get_inventory_value()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener el valor del inventario."
        )


@router.get("/low_stock_count")
def low_stock_count(current_user=Depends(get_current_user)):
    """Devuelve la cantidad de productos con stock bajo."""
    try:
        return service.get_low_stock_count()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error inesperado al obtener la cantidad de productos con stock bajo."
        )

# ===== NUEVO: stats por estado =====
@router.get("/stats/estado")
def stats_por_estado(current_user=Depends(get_current_user)):
    """
    Devuelve conteos por estado:
    { "SALON": 10, "CLIENTE": 2, "LAVANDERIA": 4, "MODISTA": 1, "VENDIDO": 5 }
    """
    try:
        return service.get_status_stats(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas por estado.")


@router.get(
    "/stats/etiquetas-inventario",
    response_model=schemas.EtiquetasInventarioStatsResponse,
)
def stats_etiquetas_inventario(
    current_user=Depends(get_current_user),
    linea_id: Optional[int] = Query(None),
    talle_id: Optional[int] = Query(None),
    tela_id: Optional[int] = Query(None),
    color_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
):
    try:
        return service.get_etiquetas_inventario_stats(
            user_id=current_user.id,
            linea_id=linea_id,
            talle_id=talle_id,
            tela_id=tela_id,
            color_id=color_id,
            q=q,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error al obtener estadísticas de etiquetas de inventario.",
        )


@router.post("/etiquetas-inventario/registrar", response_model=RegisterMessage)
def registrar_etiquetas_inventario(
    payload: schemas.EtiquetasInventarioRegistrarRequest,
    current_user=Depends(get_current_user),
):
    try:
        return service.registrar_etiquetas_inventario_impresas(
            producto_ids=payload.producto_ids,
            user_id=current_user.id,
        )
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {
            "message": "Error inesperado al registrar etiquetas impresas.",
            "success": False,
        }


@router.post(
    "/etiquetas-inventario/reset",
    response_model=RegisterMessage,
    dependencies=[Depends(require_role("ADMIN", "SUPER_ADMIN"))],
)
def reset_etiquetas_inventario(
    payload: schemas.EtiquetasInventarioResetRequest,
    current_user=Depends(get_current_user),
):
    try:
        if not payload.todos and not payload.producto_ids and not any(
            [payload.linea_id, payload.talle_id, payload.tela_id, payload.color_id]
        ):
            raise HTTPException(
                status_code=400,
                detail="Indicá producto_ids, todos=true o al menos un filtro de atributo.",
            )
        if payload.todos:
            user_role = (
                current_user.rol.value
                if hasattr(current_user.rol, "value")
                else str(current_user.rol)
            )
            if user_role != "SUPER_ADMIN":
                raise HTTPException(
                    status_code=403,
                    detail="Solo SUPER_ADMIN puede resetear todo el inventario.",
                )
            if payload.confirmacion_global != "RESETEAR_TODO_INVENTARIO":
                raise HTTPException(
                    status_code=400,
                    detail="Confirmación global requerida: RESETEAR_TODO_INVENTARIO",
                )
        return service.reset_etiquetas_inventario(
            user_id=current_user.id,
            producto_ids=payload.producto_ids,
            todos=payload.todos,
            linea_id=payload.linea_id,
            talle_id=payload.talle_id,
            tela_id=payload.tela_id,
            color_id=payload.color_id,
            confirmacion_global=payload.confirmacion_global,
        )
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {
            "message": "Error inesperado al resetear etiquetas de inventario.",
            "success": False,
        }


# Disponibilidad existente
@router.get("/{producto_id}/disponibilidad")
def disponibilidad(
    producto_id: int,
    fecha_retiro: date = Query(..., description="Fecha de retiro"),
    fecha_devolucion: date = Query(..., description="Fecha de devolución"),
    presupuesto_excluir_id: Optional[int] = Query(
        None, description="Excluir este presupuesto al verificar (edición)"
    ),
    orden_excluir_id: Optional[int] = Query(
        None, description="Excluir reservas de esta orden al verificar (edición)"
    ),
    current_user=Depends(get_current_user),
):
    try:
        disponible = verificar_disponibilidad(
            producto_id,
            fecha_retiro,
            fecha_devolucion,
            presupuesto_excluir_id,
            orden_excluir_id,
        )
        return {
            "producto_id": producto_id,
            "fecha_retiro": fecha_retiro,
            "fecha_devolucion": fecha_devolucion,
            "disponible": disponible
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
