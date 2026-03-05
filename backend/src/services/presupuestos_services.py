from pony.orm import db_session, select, flush, commit, Database, desc
from datetime import datetime, date
from fastapi import HTTPException
from src.models import Presupuesto, ItemPresupuesto, Producto, Cliente, db
from src.schemas import PresupuestoCreate, PresupuestoResponse, ItemPresupuestoResponse
from src.services.disponibilidad_services import verificar_disponibilidad

class PresupuestosServices:
    def __init__(self):
        pass

    def crear_presupuesto(self, data: PresupuestoCreate, current_user=None) -> dict:
        with db_session:
            try:
                
                # Verificar que el cliente existe
                cliente = Cliente.get(id=data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                

                # Verificar que todos los productos existen y están disponibles
                fecha_retiro = data.fecha_retiro or data.fecha_evento
                fecha_devolucion = data.fecha_devolucion or data.fecha_evento
                
                for i, item in enumerate(data.items):
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")
                    
                    # Verificar disponibilidad del producto
                    disponible = verificar_disponibilidad(
                        producto_id=item.producto_id,
                        fecha_retiro=fecha_retiro,
                        fecha_devolucion=fecha_devolucion
                    )
                    
                    if not disponible:
                        raise HTTPException(
                            status_code=400,
                            detail=f"El producto '{producto.descripcion}' no está disponible en las fechas seleccionadas (ya está reservado en otro presupuesto u orden de trabajo)"
                        )

                # Calcular total base sumando los subtotales de los items
                # NOTA: El frontend ya aplicó el descuento redistribuyendo los precios de los items,
                # por lo que total_base ya es el total FINAL con el descuento aplicado
                total_base = sum(item.subtotal for item in data.items)
                
                # Validar descuento extra si existe
                total = total_base
                descuento_maximo_estandar = 15.0  # 15% es el máximo estándar para empleados
                
                if data.extra_discount_percentage is not None and data.extra_discount_percentage > 0:
                    # Si el descuento es mayor al estándar, validar motivo
                    if data.extra_discount_percentage > descuento_maximo_estandar:
                        if not data.extra_discount_reason or not data.extra_discount_reason.strip():
                            raise HTTPException(
                                status_code=400,
                                detail=f"El motivo es obligatorio para descuentos mayores al {descuento_maximo_estandar}%"
                            )
                    
                    # El frontend ya aplicó el descuento redistribuyendo los precios de los items,
                    # por lo que total_base ya incluye el descuento aplicado.
                    # El frontend envía extra_discount_amount que es el monto descontado.
                    # NO aplicamos el descuento nuevamente, solo usamos el total_base que ya tiene el descuento
                    if data.extra_discount_amount is None:
                        # Si no viene el monto, lo calculamos a partir del total final y el porcentaje
                        # total_final = total_original * (1 - porcentaje/100)
                        # total_original = total_final / (1 - porcentaje/100)
                        if data.extra_discount_percentage < 100:
                            total_original_estimado = total_base / (1 - data.extra_discount_percentage / 100)
                            data.extra_discount_amount = total_original_estimado - total_base
                        else:
                            data.extra_discount_amount = total_base
                    
                    # El total ya está con el descuento aplicado (viene en los items)
                    total = total_base

                # Generar número
                cantidad_presupuestos = Presupuesto.select().count()
                numero = f"PRES-{cantidad_presupuestos + 1:03d}"

                # Obtener usuario si está disponible
                usuario_aplico_descuento = None
                if current_user:
                    from src.models import Usuario
                    usuario_aplico_descuento = Usuario.get(id=current_user.id)

                # Asegurar que fecha_evento sea un objeto date puro
                fecha_evento_presupuesto = data.fecha_evento
                if isinstance(fecha_evento_presupuesto, datetime):
                    fecha_evento_presupuesto = fecha_evento_presupuesto.date()
                
                # Debug: verificar la fecha recibida
                print(f"🔍 DEBUG Presupuesto - Fecha recibida: {data.fecha_evento} (tipo: {type(data.fecha_evento)})")
                print(f"🔍 DEBUG Presupuesto - Fecha a guardar: {fecha_evento_presupuesto} (tipo: {type(fecha_evento_presupuesto)})")
                
                # Crear presupuesto - construir argumentos condicionalmente
                presupuesto_args = {
                    "numero": numero,
                    "cliente": cliente,
                    "fecha_evento": fecha_evento_presupuesto,
                    "fecha_retiro": data.fecha_retiro,
                    "fecha_devolucion": data.fecha_devolucion,
                    "categoria_evento": data.categoria_evento,
                    "nombre_agasajado": data.nombre_agasajado,
                    "lugar_evento": data.lugar_evento,
                    "observaciones": data.observaciones,
                    "estado": "pendiente",
                    "total": total,
                    "fecha_creacion": datetime.now(),
                }
                
                # Solo agregar campos de descuento extra si tienen valores
                if data.extra_discount_percentage is not None:
                    presupuesto_args["extra_discount_percentage"] = data.extra_discount_percentage
                    presupuesto_args["extra_discount_amount"] = data.extra_discount_amount
                    if data.extra_discount_reason:
                        presupuesto_args["extra_discount_reason"] = data.extra_discount_reason
                    if usuario_aplico_descuento:
                        presupuesto_args["extra_discount_applied_by"] = usuario_aplico_descuento
                    presupuesto_args["extra_discount_created_at"] = datetime.now()
                
                presupuesto = Presupuesto(**presupuesto_args)
                
                # Debug: verificar la fecha guardada
                print(f"🔍 DEBUG Presupuesto - Fecha guardada: {presupuesto.fecha_evento} (tipo: {type(presupuesto.fecha_evento)})")
                

                # Crear items
                for i, item in enumerate(data.items):
                    producto = Producto.get(id=item.producto_id)
                    
                    ItemPresupuesto(
                        presupuesto=presupuesto,
                        producto=producto,
                        cantidad=item.cantidad,
                        precio_unitario=item.precio_unitario,
                        subtotal=item.subtotal,
                    )
                
                flush()
                commit()
                
                return {
                    "message": "Presupuesto creado exitosamente",
                    "success": True,
                    "data": {
                        "id": presupuesto.id,
                        "numero": presupuesto.numero,
                        "cliente_id": presupuesto.cliente.id,
                        "total": presupuesto.total,
                        "estado": presupuesto.estado
                    }
                }
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en crear_presupuesto: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

    def listar_presupuestos(self) -> list:
        with db_session:
            try:
                presupuestos = list(Presupuesto.select().order_by(desc(Presupuesto.fecha_creacion)))
                
                if not presupuestos:
                    return []
                
                return [
                    PresupuestoResponse(
                        id=p.id,
                        numero=p.numero,
                        cliente_id=p.cliente.id,
                        cliente_nombre=f"{p.cliente.nombre} {p.cliente.apellido}",
                        fecha_evento=str(p.fecha_evento),
                        fecha_retiro=str(p.fecha_retiro) if p.fecha_retiro else None,
                        fecha_devolucion=str(p.fecha_devolucion) if p.fecha_devolucion else None,
                        categoria_evento=p.categoria_evento,
                        nombre_agasajado=p.nombre_agasajado,
                        lugar_evento=p.lugar_evento,
                        observaciones=p.observaciones or "",
                        total=p.total,
                        estado=p.estado,
                        fecha_creacion=str(p.fecha_creacion) if p.fecha_creacion else None,
                        items=[
                            ItemPresupuestoResponse(
                                id=item.id,
                                producto_id=item.producto.id,
                                producto_descripcion=item.producto.descripcion,
                                cantidad=item.cantidad,
                                precio_unitario=item.precio_unitario,
                                subtotal=item.subtotal
                            )
                            for item in p.items
                        ],
                        seña_pagada=getattr(p.orden_trabajo, 'seña_pagada', None) if p.orden_trabajo else None,
                        metodo_pago=getattr(p.orden_trabajo, 'metodo_pago', None) if p.orden_trabajo else None,
                        # Campos de descuento extra
                        extra_discount_percentage=p.extra_discount_percentage,
                        extra_discount_amount=p.extra_discount_amount,
                        extra_discount_reason=p.extra_discount_reason,
                        extra_discount_applied_by_id=p.extra_discount_applied_by.id if p.extra_discount_applied_by else None,
                        extra_discount_applied_by_nombre=f"{p.extra_discount_applied_by.nombre} {p.extra_discount_applied_by.apellido}" if p.extra_discount_applied_by else None,
                        extra_discount_created_at=str(p.extra_discount_created_at) if p.extra_discount_created_at else None,
                    )
                    for p in presupuestos
                ]
            except Exception as e:
                print(f"❌ Error en listar_presupuestos: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al listar presupuestos: {str(e)}")

    def editar_presupuesto(self, presupuesto_id: int, data: PresupuestoCreate, current_user=None) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="No se puede editar: ya tiene orden de trabajo generada")

                # Verificar cliente
                cliente = Cliente.get(id=data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                # Verificar productos y disponibilidad
                fecha_retiro = data.fecha_retiro or data.fecha_evento
                fecha_devolucion = data.fecha_devolucion or data.fecha_evento
                
                for item in data.items:
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")
                    
                    # Verificar disponibilidad del producto (excluyendo este presupuesto)
                    disponible = verificar_disponibilidad(
                        producto_id=item.producto_id,
                        fecha_retiro=fecha_retiro,
                        fecha_devolucion=fecha_devolucion,
                        presupuesto_excluir_id=presupuesto_id
                    )
                    
                    if not disponible:
                        raise HTTPException(
                            status_code=400,
                            detail=f"El producto '{producto.descripcion}' no está disponible en las fechas seleccionadas (ya está reservado en otro presupuesto u orden de trabajo)"
                        )

                # Actualizar presupuesto
                presupuesto.cliente = cliente
                presupuesto.fecha_evento = data.fecha_evento
                presupuesto.fecha_retiro = data.fecha_retiro
                presupuesto.fecha_devolucion = data.fecha_devolucion
                presupuesto.categoria_evento = data.categoria_evento
                presupuesto.nombre_agasajado = data.nombre_agasajado
                presupuesto.lugar_evento = data.lugar_evento
                presupuesto.observaciones = data.observaciones

                # Eliminar items existentes
                for item in presupuesto.items:
                    item.delete()

                # Crear nuevos items
                total_base = 0
                for item_data in data.items:
                    producto = Producto.get(id=item_data.producto_id)
                    subtotal = item_data.cantidad * item_data.precio_unitario
                    total_base += subtotal
                    
                    ItemPresupuesto(
                        presupuesto=presupuesto,
                        producto=producto,
                        cantidad=item_data.cantidad,
                        precio_unitario=item_data.precio_unitario,
                        subtotal=subtotal,
                    )

                # Validar descuento extra si existe
                # NOTA: El frontend ya aplicó el descuento redistribuyendo los precios de los items,
                # por lo que total_base ya es el total FINAL con el descuento aplicado
                total = total_base
                descuento_maximo_estandar = 15.0  # 15% es el máximo estándar para empleados
                
                if data.extra_discount_percentage is not None and data.extra_discount_percentage > 0:
                    # Si el descuento es mayor al estándar, validar motivo
                    if data.extra_discount_percentage > descuento_maximo_estandar:
                        if not data.extra_discount_reason or not data.extra_discount_reason.strip():
                            raise HTTPException(
                                status_code=400,
                                detail=f"El motivo es obligatorio para descuentos mayores al {descuento_maximo_estandar}%"
                            )
                    
                    # El frontend ya aplicó el descuento redistribuyendo los precios de los items,
                    # por lo que total_base ya incluye el descuento aplicado.
                    # El frontend envía extra_discount_amount que es el monto descontado.
                    # NO aplicamos el descuento nuevamente, solo usamos el total_base que ya tiene el descuento
                    if data.extra_discount_amount is None:
                        # Si no viene el monto, lo calculamos a partir del total final y el porcentaje
                        if data.extra_discount_percentage < 100:
                            total_original_estimado = total_base / (1 - data.extra_discount_percentage / 100)
                            data.extra_discount_amount = total_original_estimado - total_base
                        else:
                            data.extra_discount_amount = total_base
                    
                    # El total ya está con el descuento aplicado (viene en los items)
                    total = total_base
                    
                    # Obtener usuario si está disponible
                    usuario_aplico_descuento = None
                    if current_user:
                        from src.models import Usuario
                        usuario_aplico_descuento = Usuario.get(id=current_user.id)
                    
                    presupuesto.extra_discount_percentage = data.extra_discount_percentage
                    presupuesto.extra_discount_amount = data.extra_discount_amount
                    presupuesto.extra_discount_reason = data.extra_discount_reason
                    presupuesto.extra_discount_applied_by = usuario_aplico_descuento
                    presupuesto.extra_discount_created_at = datetime.now()
                else:
                    # Si no hay descuento extra, limpiar campos
                    presupuesto.extra_discount_percentage = None
                    presupuesto.extra_discount_amount = None
                    presupuesto.extra_discount_reason = None
                    presupuesto.extra_discount_applied_by = None
                    presupuesto.extra_discount_created_at = None

                presupuesto.total = total
                flush()
                commit()

                return {
                    "message": "Presupuesto actualizado exitosamente",
                    "success": True,
                    "data": {
                        "id": presupuesto.id,
                        "numero": presupuesto.numero,
                        "total": presupuesto.total
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al editar presupuesto: {str(e)}")

    def eliminar_presupuesto(self, presupuesto_id: int) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="No se puede eliminar: ya tiene orden de trabajo generada")

                presupuesto.delete()
                return {
                    "message": "Presupuesto eliminado exitosamente",
                    "success": True
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar presupuesto: {str(e)}")

    def obtener_presupuesto_por_id(self, presupuesto_id: int) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                return PresupuestoResponse(
                    id=presupuesto.id,
                    numero=presupuesto.numero,
                    cliente_id=presupuesto.cliente.id,
                    cliente_nombre=f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}",
                    fecha_evento=str(presupuesto.fecha_evento),
                    fecha_retiro=str(presupuesto.fecha_retiro) if presupuesto.fecha_retiro else None,
                    fecha_devolucion=str(presupuesto.fecha_devolucion) if presupuesto.fecha_devolucion else None,
                    categoria_evento=presupuesto.categoria_evento,
                    nombre_agasajado=presupuesto.nombre_agasajado,
                    lugar_evento=presupuesto.lugar_evento,
                    observaciones=presupuesto.observaciones or "",
                    total=presupuesto.total,
                    estado=presupuesto.estado,
                    fecha_creacion=str(presupuesto.fecha_creacion) if presupuesto.fecha_creacion else None,
                    items=[
                        ItemPresupuestoResponse(
                            id=item.id,
                            producto_id=item.producto.id,
                            producto_descripcion=item.producto.descripcion,
                            cantidad=item.cantidad,
                            precio_unitario=item.precio_unitario,
                            subtotal=item.subtotal
                        )
                        for item in presupuesto.items
                    ],
                    seña_pagada=getattr(presupuesto.orden_trabajo, 'seña_pagada', None) if presupuesto.orden_trabajo else None,
                    metodo_pago=getattr(presupuesto.orden_trabajo, 'metodo_pago', None) if presupuesto.orden_trabajo else None,
                    # Campos de descuento extra
                    extra_discount_percentage=presupuesto.extra_discount_percentage,
                    extra_discount_amount=presupuesto.extra_discount_amount,
                    extra_discount_reason=presupuesto.extra_discount_reason,
                    extra_discount_applied_by_id=presupuesto.extra_discount_applied_by.id if presupuesto.extra_discount_applied_by else None,
                    extra_discount_applied_by_nombre=f"{presupuesto.extra_discount_applied_by.nombre} {presupuesto.extra_discount_applied_by.apellido}" if presupuesto.extra_discount_applied_by else None,
                    extra_discount_created_at=str(presupuesto.extra_discount_created_at) if presupuesto.extra_discount_created_at else None,
                )

            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en obtener_presupuesto_por_id: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al obtener presupuesto: {str(e)}")
