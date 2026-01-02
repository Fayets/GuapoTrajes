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
    page: int = Query(1, ge=1, description="Número de página (1-based)"),
    size: int = Query(20, ge=1, le=200, description="Tamaño de página"),
):
    try:
        items, total = service.get_all_products(estado=estado, page=page, size=size, user_id=current_user.id)
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


# Disponibilidad existente
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
