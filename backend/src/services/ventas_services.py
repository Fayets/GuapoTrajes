from pony.orm import db_session, select, sum, desc
from fastapi import HTTPException
from src import models, schemas
from datetime import datetime

class VentasServices:
    def __init__(self):
        pass

    def create_venta(self, venta_data: schemas.VentaCreate) -> dict:
        with db_session:
            try:
                cliente = models.Cliente.get(id=venta_data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                sucursal = models.Sucursal.get(id=venta_data.sucursal_id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                

                venta = models.Venta(
                    cliente=cliente,
                    sucursal=sucursal,
                    fecha=datetime.now(),
                    total=0,
                    tipo_precio=venta_data.tipo_precio
                )

                total_venta = 0

                for item in venta_data.productos:
                    producto = models.Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto con ID {item.producto_id} no encontrado")

                    if producto.estado != "SALON":
                        raise HTTPException(
                            status_code=400,
                            detail=f"El producto con ID {item.producto_id} ('{producto.descripcion}') no se puede vender porque está en estado '{producto.estado}'."
                        )
                    if producto.stock < item.cantidad:
                        raise HTTPException(status_code=400, detail=f"Stock insuficiente para el producto {producto.descripcion}")

                    # Obtener precio según tipo_precio
                    if venta.tipo_precio == "Lista":
                        precio_unitario = producto.precio_venta_nuevo_lista
                    elif venta.tipo_precio == "Efectivo":
                        precio_unitario = producto.precio_venta_nuevo_efectivo
                    elif venta.tipo_precio == "Medio Uso":
                        precio_unitario = producto.precio_de_venta_medio_uso
                    elif venta.tipo_precio == "Liquidacion":
                        precio_unitario = producto.precio_liquidacion
                    else:
                        raise HTTPException(status_code=400, detail=f"Tipo de precio inválido: {venta.tipo_precio}")

                    subtotal = precio_unitario * item.cantidad

                    models.DetalleVenta(
                        venta=venta,
                        producto=producto,
                        cantidad=item.cantidad,
                        precio_unitario=precio_unitario,
                        subtotal=subtotal
                    )

                    producto.stock -= item.cantidad
                    total_venta += subtotal

                venta.total = total_venta

                venta_id = venta.id if isinstance(venta.id, int) else int(str(venta.id))
                venta_dict = self.get_venta_by_id(venta_id)
                return {
                    "message": "Venta registrada correctamente",
                    "success": True,
                    "data": venta_dict
                }

            except HTTPException as e:
                raise e
            except Exception as e:
                print(f"Error al registrar la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al registrar la venta.")


    def get_venta_by_id(self, venta_id: int):
        with db_session:
            try:
                venta = models.Venta.get(id=venta_id)
                if not venta:
                    raise HTTPException(status_code=404, detail="Venta no encontrada")

                venta_dict = {
                    "id": venta.id,
                    "fecha": venta.fecha.strftime("%Y-%m-%d"),
                    "total": venta.total,
                    "tipo_precio": venta.tipo_precio,
                    "cliente_id": venta.cliente.id,
                    "cliente_nombre": venta.cliente.nombre,
                    "sucursal_id": venta.sucursal.id,
                    "sucursal_nombre": venta.sucursal.nombre,
                    "productos": []
                }

                for det in venta.detalles:
                    producto = det.producto
                    producto_dict = {
                        "producto_id": producto.id,
                        "codigo": producto.codigo_barra,
                        "descripcion": producto.descripcion,
                        "cantidad": det.cantidad,
                        "precio_unitario": det.precio_unitario,
                        "subtotal": det.subtotal
                    }
                    venta_dict["productos"].append(producto_dict)

                return venta_dict

            except Exception as e:
                print(f"Error al obtener la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la venta.")



    def get_all_ventas(self):
        with db_session:
            try:
                ventas = models.Venta.select().order_by(desc(models.Venta.fecha))[:]
                if not ventas:
                    return []
                result = []
                for venta in ventas:
                    venta_dict = {
                        "id": venta.id,
                        "fecha": venta.fecha.strftime("%Y-%m-%d"),
                        "total": venta.total,
                        "tipo_precio": venta.tipo_precio,
                        "cliente_id": venta.cliente.id,
                        "cliente_nombre": venta.cliente.nombre,
                        "sucursal_id": venta.sucursal.id,
                        "sucursal_nombre": venta.sucursal.nombre,
                        "productos": []
                    }

                    for det in venta.detalles:
                        producto = det.producto
                        producto_dict = {
                            "producto_id": producto.id,
                            "codigo": producto.codigo_barra,
                            "descripcion": producto.descripcion,
                            "cantidad": det.cantidad,
                            "precio_unitario": det.precio_unitario,
                            "subtotal": det.subtotal  # O det.cantidad * det.precio_unitario
                        }
                        venta_dict["productos"].append(producto_dict)

                    result.append(venta_dict)

                return result

            except Exception as e:
                print(f"Error al obtener las ventas: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener las ventas.")


    def delete_venta(self, venta_id: int):
        with db_session:
            try:
                venta = models.Venta.get(id=venta_id)
                if not venta:
                    raise HTTPException(status_code=404, detail="Venta no encontrada")
                
                for det in venta.detalles:
                    producto = det.producto
                    producto.stock += det.cantidad
                
                venta.delete()
                
                return {"message": f"Venta #{venta_id} eliminada correctamente"}
            except Exception as e:
                print(f"Error al eliminar la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al eliminar la venta.")

