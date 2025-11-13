from pony.orm import db_session, select, sum, desc
from fastapi import HTTPException
from src import models, schemas
from src.models import EstadoProducto
from datetime import datetime, date
from pony.orm import flush

class VentasServices:
    def __init__(self):
        pass

    def create_venta(self, venta_data: schemas.VentaCreate, current_user) -> dict:
        with db_session:
            try:
                usuario = models.Usuario.get(id=current_user.id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                # 1) Validaciones base
                cliente = models.Cliente.get(id=venta_data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                sucursal = models.Sucursal.get(id=venta_data.sucursal_id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")

                if usuario.rol == models.Roles.EMPLEADO and usuario.sucursal.id != sucursal.id:
                    raise HTTPException(status_code=403, detail="No puedes registrar ventas en otra sucursal")

                # 2) Crear cabecera de la venta
                venta = models.Venta(
                    cliente=cliente,
                    sucursal=sucursal,
                    fecha_hora=datetime.now(),
                    total=0.0,
                    tipo_precio=venta_data.tipo_precio,
                    payment_method=venta_data.payment_method,
                    usuario=usuario
                )

                total_venta = 0.0

                # 3) Recorrer items
                for item in venta_data.productos:
                    producto = models.Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(
                            status_code=404,
                            detail=f"Producto con ID {item.producto_id} no encontrado"
                        )

                    # Comparar contra el Enum
                    if producto.estado != EstadoProducto.SALON:
                        raise HTTPException(
                            status_code=400,
                            detail=f"El producto '{producto.descripcion}' no se puede vender porque está en estado '{producto.estado}'."
                        )

                    if producto.stock < item.cantidad:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stock insuficiente para '{producto.descripcion}'"
                        )

                    # 4) Precio según tipo de precio
                    tp = venta.tipo_precio
                    if tp == "Lista":
                        precio_unitario = producto.precio_venta_nuevo_lista
                    elif tp == "Efectivo":
                        precio_unitario = producto.precio_venta_nuevo_efectivo
                    elif tp == "Medio Uso":
                        precio_unitario = producto.precio_de_venta_medio_uso
                    elif tp == "Liquidacion":
                        precio_unitario = producto.precio_liquidacion
                    else:
                        raise HTTPException(status_code=400, detail=f"Tipo de precio inválido: {tp}")

                    subtotal = precio_unitario * item.cantidad

                    # 5) Crear detalle
                    models.DetalleVenta(
                        venta=venta,
                        producto=producto,
                        cantidad=item.cantidad,
                        precio_unitario=precio_unitario,
                        subtotal=subtotal
                    )

                    # 6) Actualizar producto (stock y estado)
                    producto.stock -= item.cantidad
                    if producto.stock <= 0:
                        producto.stock = 0
                        producto.estado = EstadoProducto.VENDIDO

                    total_venta += subtotal

                # 7) Totalizar venta
                venta.total = total_venta

                # 8) Asegurar ID y commit antes de salir
                flush()   # garantiza que venta.id esté asignado
                venta_id = int(venta.id)

                # 9) Crear movimiento de caja
                from src.services.caja_services import CajaServices
                caja_service = CajaServices()
                
                movimiento_data = {
                    "tipo": "INGRESO",
                    "monto": total_venta,
                    "payment_method": venta_data.payment_method,
                    "origen": f"VENTA:{venta_id}",
                    "venta_id": venta_id,
                    "sucursal_id": sucursal.id
                }
                
                caja_service.create_movimiento(movimiento_data, usuario.id)
                
                return {
                    "id": venta_id,
                    "fecha_hora": str(venta.fecha_hora),
                    "cliente_id": cliente.id,
                    "sucursal_id": sucursal.id,
                    "tipo_precio": venta.tipo_precio,
                    "total": venta.total
                }
            except Exception as e:
                print(f"Error al crear la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al crear la venta.")


    def get_venta_by_id(self, venta_id: int):
        with db_session:
            try:
                venta = models.Venta.get(id=venta_id)
                if not venta:
                    raise HTTPException(status_code=404, detail="Venta no encontrada")

                venta_dict = {
                    "id": venta.id,
                    "fecha_hora": venta.fecha_hora.strftime("%Y-%m-%d %H:%M"),
                    "total": venta.total,
                    "tipo_precio": venta.tipo_precio,
                    "payment_method": venta.payment_method,  # Ya es string
                    "cliente_id": venta.cliente.id,
                    "cliente_nombre": venta.cliente.nombre,
                    "sucursal_id": venta.sucursal.id,
                    "sucursal_nombre": venta.sucursal.nombre,
                    "usuario_id": venta.usuario.id,
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
                ventas = list(models.Venta.select().order_by(desc(models.Venta.fecha_hora)))
                if not ventas:
                    return []
                result = []
                for venta in ventas:
                    venta_dict = {
                        "id": venta.id,
                        "fecha_hora": venta.fecha_hora.strftime("%Y-%m-%d %H:%M"),
                        "total": venta.total,
                        "tipo_precio": venta.tipo_precio,
                        "payment_method": venta.payment_method,  # Ya es string
                        "cliente_id": venta.cliente.id,
                        "cliente_nombre": venta.cliente.nombre,
                        "sucursal_id": venta.sucursal.id,
                        "sucursal_nombre": venta.sucursal.nombre,
                        "usuario_id": venta.usuario.id,
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

