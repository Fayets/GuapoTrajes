from pony.orm import db_session, select, sum, flush, commit
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError, ConstraintError
from src import models, schemas
from src.models import Producto, EstadoProducto, Sucursal
from datetime import datetime
import traceback

class ProductoServices:
    def __init__(self):
        pass

    # Crear producto
    def create_producto(self, producto_data: schemas.ProductCreate) -> dict:
        codigo_barra = producto_data.codigo_barra.upper()
        with db_session:
            try:
                if models.Producto.get(codigo_barra=codigo_barra):
                    raise HTTPException(
                        status_code=400,
                        detail=f"El código de barras {codigo_barra} ya está en uso."
                    )

                sucursal_obj = models.Sucursal.get(id=producto_data.sucursal_id)
                if not sucursal_obj:
                    raise HTTPException(status_code=400, detail="Sucursal no encontrada.")

                # Convertir fecha y estado sin modificar producto_data directamente
                fecha_alta = producto_data.fecha_alta
                if isinstance(fecha_alta, str):
                    try:
                        fecha_alta = datetime.strptime(fecha_alta, "%Y-%m-%d").date()
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Formato de fecha incorrecto.")

                try:
                    estado = EstadoProducto(producto_data.estado)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Estado inválido.")

                producto = models.Producto(
                    codigo_barra=codigo_barra,
                    linea=producto_data.linea,
                    talle=producto_data.talle,
                    tela=producto_data.tela,
                    color=producto_data.color,
                    descripcion=producto_data.descripcion,
                    costo=producto_data.costo,
                    precio_alquiler_lista=producto_data.precio_alquiler_lista,
                    precio_alquiler_efectivo=producto_data.precio_alquiler_efectivo,
                    precio_venta_nuevo_lista=producto_data.precio_venta_nuevo_lista,
                    precio_venta_nuevo_efectivo=producto_data.precio_venta_nuevo_efectivo,
                    precio_de_venta_medio_uso=producto_data.precio_de_venta_medio_uso,
                    precio_venta=producto_data.precio_venta,
                    precio_liquidacion=producto_data.precio_liquidacion,
                    stock=producto_data.stock,
                    stock_minimo=producto_data.stock_minimo,
                    fecha_alta=fecha_alta,
                    estado=estado,
                    sucursal=sucursal_obj,
                    inmovilizado=producto_data.inmovilizado
                )

                return producto.to_dict()

            except ConstraintError as ce:
                traceback.print_exc()
                raise HTTPException(
                    status_code=400,
                    detail=f"Error de restricción en la base de datos: {str(ce)}"
                )

            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error general al crear el producto: {str(e)}"
                )


    # Obtener producto por código de barras
    def get_product_by_code(self, codigo_barra: str):
        with db_session:
            try:
                producto = models.Producto.get(codigo_barra=codigo_barra)
                if not producto:
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                return {
                    "id": producto.id,
                    "codigo_barra": producto.codigo_barra,
                    "linea": producto.linea,
                    "talle": producto.talle,
                    "tela": producto.tela,
                    "color": producto.color,
                    "descripcion": producto.descripcion,
                    "costo": producto.costo,
                    "precio_alquiler_lista": producto.precio_alquiler_lista,
                    "precio_alquiler_efectivo": producto.precio_alquiler_efectivo,
                    "precio_venta_nuevo_lista": producto.precio_venta_nuevo_lista,
                    "precio_venta_nuevo_efectivo": producto.precio_venta_nuevo_efectivo,
                    "precio_de_venta_medio_uso": producto.precio_de_venta_medio_uso,
                    "precio_venta": producto.precio_venta,
                    "precio_liquidacion": producto.precio_liquidacion,
                    "stock": producto.stock,
                    "stock_minimo": producto.stock_minimo,
                    "fecha_alta": producto.fecha_alta,
                    "estado": producto.estado,
                    "sucursal_id": producto.sucursal.id, 
                    "inmovilizado": producto.inmovilizado,
                }

            except Exception as e:
               
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al crear el producto: {str(e)}")

    # Obtener todos los productos
    def get_all_products(self):
        with db_session:
            try:
                productos = list(models.Producto.select())
                if not productos:
                    raise HTTPException(status_code=404, detail="No hay productos disponibles")

                return [
                    {
                        **producto.to_dict(),
                        "sucursal_id": producto.sucursal.id  # Agrega el ID de la sucursal correctamente
                    }
                    for producto in productos
                ]

            except Exception as e:
                print(f"Error al obtener los productos: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener los productos.")


    # Actualizar producto por código de barras
    def update_product(self, id: int, producto_update: schemas.ProductUpdate) -> dict:
        with db_session:
            try:
                producto = models.Producto.get(id=id)
                if not producto:
                    print("❗ Producto no encontrado con ID:", id)
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                update_data = producto_update.model_dump(exclude_unset=True)
                print("🧪 update_data recibido:", update_data)

                # Validación de sucursal
                if "sucursal_id" in update_data:
                    sucursal_obj = models.Sucursal.get(id=update_data["sucursal_id"])
                    if not sucursal_obj:
                        print("⚠️ Sucursal no encontrada")
                        raise HTTPException(status_code=400, detail="Sucursal no encontrada.")
                    update_data["sucursal"] = sucursal_obj
                    del update_data["sucursal_id"]

                # Validación de estado (Enum)
                if "estado" in update_data:
                    try:
                        update_data["estado"] = EstadoProducto(update_data["estado"])
                    except ValueError:
                        print("⚠️ Estado inválido")
                        raise HTTPException(status_code=400, detail="Estado inválido.")

                # Validación de fecha
                if "fecha_alta" in update_data and isinstance(update_data["fecha_alta"], str):
                    try:
                        update_data["fecha_alta"] = datetime.strptime(update_data["fecha_alta"], "%Y-%m-%d").date()
                    except ValueError:
                        print("⚠️ Fecha con formato incorrecto")
                        raise HTTPException(status_code=400, detail="Formato de fecha incorrecto (debe ser yyyy-mm-dd).")

                print("✅ Aplicando set con:", update_data)
                producto.set(**update_data)
                flush()
                commit()
                print("📦 Producto guardado:", producto.to_dict())

                producto_dict = producto.to_dict()
                producto_dict["sucursal_id"] = (
                    producto.sucursal.id if hasattr(producto, "sucursal") and producto.sucursal else None
                )

                producto_schema = schemas.ProductResponse.model_validate(producto_dict)

                return {
                    "message": "Producto actualizado correctamente",
                    "producto": producto_schema
                }


            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error al actualizar el producto: {e}")
                traceback.print_exc()
                raise HTTPException(status_code=500, detail="Error al actualizar el producto.")

            
    # Eliminar producto For código de barras
    def delete_product(self, codigo_barra: str) -> dict:
        with db_session:
            try:
                producto = models.Producto.get(codigo_barra=codigo_barra)
                if not producto:
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                producto.delete()
                return {"message": "Producto eliminado correctamente"}

            except Exception as e:
                print(f"Error al eliminar el producto: {e}")
                raise HTTPException(status_code=500, detail="Error al eliminar el producto.")

    # Obtener productos con stock bajo
    def get_low_stock_products(self):
        with db_session:
            try:
                productos_bajo_stock = list(models.Producto.select(lambda p: p.stock < p.stock_minimo))
                if not productos_bajo_stock:
                    raise HTTPException(status_code=404, detail="No hay productos con stock bajo.")

                return [
                    {
                        **producto.to_dict(),
                        "sucursal_id": producto.sucursal.id  # Ajusta según la relación
                    }
                    for producto in productos_bajo_stock
                ]

            except Exception as e:
                print(f"Error al obtener productos con stock bajo: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener productos con stock bajo.")

    # Obtener el total de productos
    def get_total_products(self):
        with db_session:
            try:
                total_productos = models.Producto.select().count()
                return {"total_products": total_productos}

            except Exception as e:
                print(f"Error al obtener la cantidad de productos: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la cantidad de productos.")

    # Obtener el valor total del inventario
    def get_inventory_value(self):
        with db_session:
            try:
                total_valor = sum(p.stock * p.precio_venta for p in models.Producto.select())
                return {"inventory_value": total_valor}

            except Exception as e:
                print(f"Error al obtener el valor del inventario: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener el valor del inventario.")

    # Obtener la cantidad de productos con stock bajo
    def get_low_stock_count(self):
        with db_session:
            try:
                count_low_stock = models.Producto.select(lambda p: p.stock < p.stock_minimo).count()
                return {"low_stock_count": count_low_stock}

            except Exception as e:
                print(f"Error al obtener la cantidad de productos con stock bajo: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la cantidad de productos con stock bajo.")