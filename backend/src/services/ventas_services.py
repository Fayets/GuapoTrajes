from pony.orm import db_session
from fastapi import HTTPException
from src import models, schemas
from src.descripcion_producto import format_descripcion_producto
from src.models import EstadoProducto, CuentaDestino
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

                # Validar cuenta destino obligatoria
                cuenta_destino_id = venta_data.cuenta_destino_id
                if not cuenta_destino_id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino es obligatoria para las ventas"
                    )
                
                cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                if not cuenta_destino:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Verificar que la cuenta destino pertenece a la sucursal
                if cuenta_destino.sucursal.id != sucursal.id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino debe pertenecer a la sucursal de la venta"
                    )
                
                # Verificar que la cuenta destino está activa
                if not cuenta_destino.activa:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino seleccionada está inactiva"
                    )

                # Validar y obtener método de pago (nuevo sistema o compatibilidad)
                metodo_pago_configurable = None
                submetodo_pago = None
                payment_method_str = venta_data.payment_method or "EFECTIVO"  # Default para compatibilidad
                
                if venta_data.metodo_pago_id:
                    # Usar nuevo sistema de métodos configurables
                    from src.services.metodos_pago_services import MetodosPagoServices
                    metodos_pago_service = MetodosPagoServices()
                    metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                        venta_data.metodo_pago_id,
                        venta_data.submetodo_pago_id,
                        sucursal.id
                    )
                    payment_method_str = metodo_pago_configurable.nombre
                    if submetodo_pago:
                        payment_method_str = f"{metodo_pago_configurable.nombre} - {submetodo_pago.nombre}"
                elif venta_data.payment_method:
                    # Sistema antiguo - mantener compatibilidad
                    payment_method_str = venta_data.payment_method

                # 2) Crear cabecera de la venta
                venta = models.Venta(
                    cliente=cliente,
                    sucursal=sucursal,
                    fecha_hora=datetime.now(),
                    total=0.0,
                    tipo_precio=venta_data.tipo_precio,
                    payment_method=payment_method_str,  # Para compatibilidad
                    metodo_pago_configurable=metodo_pago_configurable,  # Nueva relación
                    submetodo_pago=submetodo_pago,  # Nueva relación
                    usuario=usuario,
                    cuenta_destino=cuenta_destino
                )

                total_venta = 0.0
                detalles_creados = []

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
                            detail=f"El producto '{format_descripcion_producto(producto.descripcion, producto.descripcion_extra)}' no se puede vender porque está en estado '{producto.estado}'."
                        )

                    if producto.stock < item.cantidad:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stock insuficiente para '{format_descripcion_producto(producto.descripcion, producto.descripcion_extra)}'"
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
                    detalle = models.DetalleVenta(
                        venta=venta,
                        producto=producto,
                        cantidad=item.cantidad,
                        precio_unitario=precio_unitario,
                        subtotal=subtotal
                    )
                    detalles_creados.append(detalle)

                    # 6) Actualizar producto (stock y estado)
                    producto.stock -= item.cantidad
                    if producto.stock <= 0:
                        producto.stock = 0
                        producto.estado = EstadoProducto.VENDIDO

                    total_venta += subtotal

                # 7) Totalizar venta (con descuento opcional)
                descuento_pct = venta_data.descuento_porcentaje
                if descuento_pct is not None and descuento_pct > 0:
                    descuento_maximo_estandar = (
                        50.0 if usuario.rol == models.Roles.ADMIN else 15.0
                    )
                    if descuento_pct > descuento_maximo_estandar:
                        motivo = (venta_data.extra_discount_reason or "").strip()
                        if not motivo:
                            raise HTTPException(
                                status_code=400,
                                detail=(
                                    f"El motivo es obligatorio para descuentos mayores al "
                                    f"{int(descuento_maximo_estandar)}%"
                                ),
                            )
                        venta.extra_discount_percentage = descuento_pct
                        venta.extra_discount_amount = round(
                            total_venta * (descuento_pct / 100), 2
                        )
                        venta.extra_discount_reason = motivo
                        venta.extra_discount_applied_by = usuario
                        venta.extra_discount_created_at = datetime.now()

                    total_final = round(
                        total_venta * (1 - descuento_pct / 100), 2
                    )
                    if total_venta > 0 and detalles_creados:
                        acumulado = 0.0
                        for idx, det in enumerate(detalles_creados):
                            if idx == len(detalles_creados) - 1:
                                nuevo_subtotal = round(total_final - acumulado, 2)
                            else:
                                nuevo_subtotal = round(
                                    det.subtotal * (total_final / total_venta), 2
                                )
                                acumulado += nuevo_subtotal
                            det.subtotal = nuevo_subtotal
                            det.precio_unitario = nuevo_subtotal / det.cantidad
                    venta.total = total_final
                    total_venta = total_final
                else:
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
                    "payment_method": payment_method_str,  # Compatibilidad
                    "metodo_pago_id": venta_data.metodo_pago_id,  # Nuevo sistema
                    "submetodo_pago_id": venta_data.submetodo_pago_id,  # Nuevo sistema
                    "origen": f"VENTA:{venta_id}",
                    "venta_id": venta_id,
                    "sucursal_id": sucursal.id,
                    "cuenta_destino_id": cuenta_destino_id
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
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al crear la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al crear la venta.")


    def get_venta_by_id(self, venta_id: int):
        with db_session:
            try:
                venta = models.Venta.get(id=venta_id)
                if not venta:
                    raise HTTPException(status_code=404, detail="Venta no encontrada")

                # Determinar método de pago a mostrar
                metodo_pago_display = venta.payment_method  # Compatibilidad
                if venta.metodo_pago_configurable:
                    metodo_pago_display = venta.metodo_pago_configurable.nombre
                    if venta.submetodo_pago:
                        metodo_pago_display = f"{venta.metodo_pago_configurable.nombre} - {venta.submetodo_pago.nombre}"
                
                venta_dict = {
                    "id": venta.id,
                    "fecha_hora": venta.fecha_hora.strftime("%Y-%m-%d %H:%M"),
                    "total": venta.total,
                    "tipo_precio": venta.tipo_precio,
                    "payment_method": metodo_pago_display,  # Método a mostrar
                    "metodo_pago_id": venta.metodo_pago_configurable.id if venta.metodo_pago_configurable else None,
                    "submetodo_pago_id": venta.submetodo_pago.id if venta.submetodo_pago else None,
                    "cliente_id": venta.cliente.id,
                    "cliente_nombre": f"{venta.cliente.nombre} {venta.cliente.apellido}",
                    "sucursal_id": venta.sucursal.id,
                    "sucursal_nombre": venta.sucursal.nombre,
                    "usuario_id": venta.usuario.id,
                    "usuario_nombre": f"{venta.usuario.nombre} {venta.usuario.apellido}",
                    "cuenta_destino_id": venta.cuenta_destino.id if venta.cuenta_destino else None,
                    "cuenta_destino_nombre": venta.cuenta_destino.nombre_titular if venta.cuenta_destino else None,
                    "productos": []
                }

                for det in venta.detalles:
                    producto = det.producto
                    producto_dict = {
                        "producto_id": producto.id,
                        "codigo": producto.codigo_barra,
                        "descripcion": format_descripcion_producto(
                            producto.descripcion, producto.descripcion_extra
                        ),
                        "cantidad": det.cantidad,
                        "precio_unitario": det.precio_unitario,
                        "subtotal": det.subtotal
                    }
                    venta_dict["productos"].append(producto_dict)

                return venta_dict

            except Exception as e:
                print(f"Error al obtener la venta: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la venta.")



    def get_all_ventas(self, current_user=None):
        with db_session:
            try:
                # Pony ORM falla en Python 3.14 con order_by(desc(...)); ordenar en memoria.
                todas_las_ventas = list(models.Venta.select())
                todas_las_ventas.sort(
                    key=lambda v: v.fecha_hora or datetime.min,
                    reverse=True,
                )
                
                # Filtrar por sucursal según el rol del usuario
                ventas = todas_las_ventas
                if current_user:
                    usuario = models.Usuario.get(id=current_user.id)
                    if usuario and usuario.sucursal:
                        sucursal_id = usuario.sucursal.id
                        # Si es empleado, solo ver ventas de su sucursal
                        if usuario.rol == models.Roles.EMPLEADO:
                            ventas = [v for v in todas_las_ventas if v.sucursal and v.sucursal.id == sucursal_id]
                        # Si es admin, ver todas las ventas de su sucursal
                        elif usuario.rol == models.Roles.ADMIN:
                            ventas = [v for v in todas_las_ventas if v.sucursal and v.sucursal.id == sucursal_id]
                    else:
                        # Si el usuario no tiene sucursal, retornar lista vacía
                        return []
                
                if not ventas:
                    return []
                
                print(f"📦 [Ventas] Procesando {len(ventas)} ventas")
                result = []
                for venta in ventas:
                    print(f"🔍 [Ventas] Procesando venta ID {venta.id}, cuenta_destino: {venta.cuenta_destino}")
                    try:
                        # Obtener cuenta destino de forma segura
                        cuenta_destino_id = None
                        cuenta_destino_nombre = None
                        if venta.cuenta_destino:
                            try:
                                cuenta_destino_id = venta.cuenta_destino.id
                                cuenta_destino_nombre = venta.cuenta_destino.nombre_titular
                                print(f"✅ [Ventas] Venta {venta.id} tiene cuenta destino: {cuenta_destino_nombre} (ID: {cuenta_destino_id})")
                            except Exception as e:
                                print(f"⚠️ Error al obtener cuenta destino de venta {venta.id}: {e}")
                                import traceback
                                traceback.print_exc()
                        else:
                            print(f"⚠️ [Ventas] Venta {venta.id} NO tiene cuenta destino asignada (venta antigua)")
                        
                        # Determinar método de pago a mostrar
                        metodo_pago_display = venta.payment_method or ""
                        if venta.metodo_pago_configurable:
                            metodo_pago_display = venta.metodo_pago_configurable.nombre
                            if venta.submetodo_pago:
                                metodo_pago_display = (
                                    f"{venta.metodo_pago_configurable.nombre} - "
                                    f"{venta.submetodo_pago.nombre}"
                                )

                        extra_applied_by = venta.extra_discount_applied_by
                        venta_dict = {
                            "id": venta.id,
                            "fecha_hora": venta.fecha_hora.strftime("%Y-%m-%d %H:%M")
                            if venta.fecha_hora
                            else "",
                            "total": float(venta.total or 0),
                            "tipo_precio": venta.tipo_precio or "",
                            "payment_method": metodo_pago_display,
                            "metodo_pago_id": (
                                venta.metodo_pago_configurable.id
                                if venta.metodo_pago_configurable
                                else None
                            ),
                            "submetodo_pago_id": (
                                venta.submetodo_pago.id if venta.submetodo_pago else None
                            ),
                            "cliente_id": venta.cliente.id if venta.cliente else 0,
                            "cliente_nombre": (
                                f"{venta.cliente.nombre} {venta.cliente.apellido}".strip()
                                if venta.cliente
                                else "Cliente no encontrado"
                            ),
                            "sucursal_id": venta.sucursal.id if venta.sucursal else 0,
                            "sucursal_nombre": (
                                venta.sucursal.nombre if venta.sucursal else "Sin sucursal"
                            ),
                            "usuario_id": venta.usuario.id if venta.usuario else 0,
                            "usuario_nombre": (
                                f"{venta.usuario.nombre} {venta.usuario.apellido}".strip()
                                if venta.usuario
                                else "Usuario no encontrado"
                            ),
                            "cuenta_destino_id": cuenta_destino_id,
                            "cuenta_destino_nombre": cuenta_destino_nombre,
                            "extra_discount_percentage": venta.extra_discount_percentage,
                            "extra_discount_amount": venta.extra_discount_amount,
                            "extra_discount_reason": venta.extra_discount_reason or None,
                            "extra_discount_applied_by_id": (
                                extra_applied_by.id if extra_applied_by else None
                            ),
                            "extra_discount_applied_by_nombre": (
                                f"{extra_applied_by.nombre} {extra_applied_by.apellido}".strip()
                                if extra_applied_by
                                else None
                            ),
                            "extra_discount_created_at": (
                                venta.extra_discount_created_at.strftime(
                                    "%Y-%m-%d %H:%M"
                                )
                                if venta.extra_discount_created_at
                                else None
                            ),
                            "productos": [],
                        }
                        
                        print(f"📤 [Ventas] Venta {venta.id} - cuenta_destino_id: {cuenta_destino_id}, cuenta_destino_nombre: {cuenta_destino_nombre}")

                        for det in venta.detalles:
                            producto = det.producto
                            if not producto:
                                continue
                            producto_dict = {
                                "producto_id": producto.id,
                                "codigo": producto.codigo_barra or "",
                                "descripcion": format_descripcion_producto(
                                    producto.descripcion, producto.descripcion_extra
                                ),
                                "cantidad": det.cantidad,
                                "precio_unitario": float(det.precio_unitario or 0),
                                "subtotal": float(det.subtotal or 0),
                            }
                            venta_dict["productos"].append(producto_dict)

                        result.append(venta_dict)
                    except Exception as e:
                        print(f"❌ Error al procesar venta {venta.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

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

