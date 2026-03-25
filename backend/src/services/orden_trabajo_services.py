from pony.orm import db_session, select, flush, desc
from fastapi import HTTPException
from src.models import (
    OrdenTrabajo,
    ProductoReservado,
    Presupuesto,
    Producto,
    CuentaCorriente,
    CajaMovimiento,
    MetodoPago,
    ReciboOrden,
    EstadoProducto,
    ProductoLavanderia,
    ProductoModista,
    Lavanderia,
    Modista,
)
from datetime import datetime, timedelta, date
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class OrdenTrabajoServices:
    def __init__(self):
        pass

    def crear_orden_trabajo(self, presupuesto_id: int, seña_pagada: float, payment_method: str, usuario_id: int, cuenta_destino_id: int, metodo_pago_id: Optional[int] = None, submetodo_pago_id: Optional[int] = None) -> dict:
        with db_session:
            try:
                from src.models import Usuario, CuentaDestino
                
                # Obtener usuario y sucursal primero para validaciones
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                sucursal = usuario.sucursal
                
                # Validar y obtener método de pago (nuevo sistema o compatibilidad)
                metodo_pago_configurable = None
                submetodo_pago = None
                payment_method_str = payment_method or "EFECTIVO"  # Default
                payment_method_enum = None
                
                if metodo_pago_id:
                    # Usar nuevo sistema de métodos configurables
                    from src.services.metodos_pago_services import MetodosPagoServices
                    metodos_pago_service = MetodosPagoServices()
                    metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                        metodo_pago_id,
                        submetodo_pago_id,
                        sucursal.id
                    )
                    payment_method_str = metodo_pago_configurable.nombre
                    if submetodo_pago:
                        payment_method_str = f"{metodo_pago_configurable.nombre} - {submetodo_pago.nombre}"
                elif payment_method:
                    # Sistema antiguo - mantener compatibilidad
                    if payment_method not in [mp.value for mp in MetodoPago]:
                        metodos_validos = [mp.value for mp in MetodoPago]
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}"
                        )
                    payment_method_enum = MetodoPago(payment_method)
                    payment_method_str = payment_method
                
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="El presupuesto ya tiene una orden de trabajo")

                # Validar cuenta destino obligatoria
                cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                if not cuenta_destino:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Verificar que la cuenta destino pertenece a la sucursal
                if cuenta_destino.sucursal.id != sucursal.id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino debe pertenecer a la sucursal"
                    )
                
                # Verificar que la cuenta destino está activa
                if not cuenta_destino.activa:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino seleccionada está inactiva"
                    )

                total = presupuesto.total
                saldo_pendiente = total - seña_pagada
                
                # Asegurar que la fecha_evento se copie exactamente sin conversiones
                # La fecha_evento del presupuesto ya es un objeto date, copiarlo directamente
                fecha_evento_orden = presupuesto.fecha_evento
                
                # Debug: verificar la fecha antes de guardar
                print(f"🔍 DEBUG - Presupuesto fecha_evento: {presupuesto.fecha_evento} (tipo: {type(presupuesto.fecha_evento)})")
                print(f"🔍 DEBUG - Orden fecha_evento a guardar: {fecha_evento_orden} (tipo: {type(fecha_evento_orden)})")

                fecha_retiro_reserva = presupuesto.fecha_retiro or presupuesto.fecha_evento

                orden = OrdenTrabajo(
                    presupuesto=presupuesto,
                    fecha_evento=fecha_evento_orden,
                    seña_pagada=seña_pagada,
                    saldo_pendiente=saldo_pendiente,
                    metodo_pago=payment_method_str,  # Para compatibilidad
                    metodo_pago_configurable=metodo_pago_configurable,  # Nueva relación
                    submetodo_pago=submetodo_pago,  # Nueva relación
                    estado="En proceso",
                    # Copiar campos de descuento extra del presupuesto
                    extra_discount_percentage=presupuesto.extra_discount_percentage,
                    extra_discount_amount=presupuesto.extra_discount_amount,
                    extra_discount_reason=presupuesto.extra_discount_reason,
                    extra_discount_applied_by=presupuesto.extra_discount_applied_by,
                    extra_discount_created_at=presupuesto.extra_discount_created_at,
                )
                flush()

                # Crear movimiento en cuenta corriente solo si el presupuesto tiene cliente (no precliente)
                if presupuesto.cliente:
                    CuentaCorriente(
                        cliente=presupuesto.cliente,
                        concepto=f"Seña inicial para presupuesto {presupuesto.numero}",
                        tipo="credito",
                        monto=seña_pagada,
                        saldo_post=seña_pagada,  # o calcular con lógica de saldo acumulado
                        referencia_orden=orden.id
                    )

                # Crear movimiento en caja diaria para la seña pagada
                if seña_pagada > 0:
                    movimiento = CajaMovimiento(
                        fecha_hora=datetime.now(),
                        tipo="INGRESO",
                        monto=seña_pagada,
                        payment_method=payment_method_enum,  # Para compatibilidad (opcional)
                        metodo_pago_configurable=metodo_pago_configurable,  # Nueva relación
                        submetodo_pago=submetodo_pago,  # Nueva relación
                        origen=f"SEÑA_PRESUPUESTO:{presupuesto.numero}",
                        categoria="SEÑAS",
                        venta=None,  # No es una venta, es una seña
                        usuario=usuario,
                        sucursal=sucursal,
                        cuenta_destino=cuenta_destino
                    )
                    flush()

                # Reservar productos
                for item in presupuesto.items:
                    producto = item.producto
                    fecha_bloqueo = fecha_retiro_reserva - timedelta(days=5)

                    if producto.estado in ("lavanderia", "alquilado"):
                        estado = "no disponible"
                    else:
                        estado = "reservado"

                    ProductoReservado(
                        orden_trabajo=orden,
                        producto=producto,
                        estado=estado,
                        fecha_bloqueo=fecha_bloqueo,
                    )
                
                presupuesto.estado = "Aprobado"
                
                # Debug: verificar la fecha después de guardar
                print(f"🔍 DEBUG - Orden guardada fecha_evento: {orden.fecha_evento} (tipo: {type(orden.fecha_evento)})")
                print(f"🔍 DEBUG - Presupuesto fecha_evento después: {presupuesto.fecha_evento} (tipo: {type(presupuesto.fecha_evento)})")
                
                return {
                    "message": "Orden de trabajo creada exitosamente",
                    "success": True,
                    "data": {
                        "id": orden.id,
                        "presupuesto_id": orden.presupuesto.id,
                        "fecha_evento": orden.fecha_evento.isoformat(),
                        "seña_pagada": orden.seña_pagada,
                        "saldo_pendiente": orden.saldo_pendiente,
                        "estado": orden.estado,
                        "metodo_pago": (f"{orden.metodo_pago_configurable.nombre} - {orden.submetodo_pago.nombre}" 
                                       if orden.metodo_pago_configurable and orden.submetodo_pago 
                                       else (orden.metodo_pago_configurable.nombre if orden.metodo_pago_configurable else orden.metodo_pago))
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al crear orden de trabajo: {str(e)}")

    def listar_ordenes_trabajo(self) -> list:
        with db_session:
            try:
                ordenes = list(OrdenTrabajo.select().order_by(desc(OrdenTrabajo.id)))
                
                if not ordenes:
                    return []
                
                resultado = []
                for o in ordenes:
                    presupuesto = o.presupuesto
                    
                    # Si la orden no tiene descuento extra pero el presupuesto sí, usar el del presupuesto
                    descuento_percentage = o.extra_discount_percentage
                    descuento_amount = o.extra_discount_amount
                    descuento_reason = o.extra_discount_reason
                    descuento_applied_by = o.extra_discount_applied_by
                    descuento_created_at = o.extra_discount_created_at
                    
                    if not descuento_percentage and presupuesto.extra_discount_percentage:
                        # Si la orden no tiene descuento pero el presupuesto sí, usar el del presupuesto
                        descuento_percentage = presupuesto.extra_discount_percentage
                        descuento_amount = presupuesto.extra_discount_amount
                        descuento_reason = presupuesto.extra_discount_reason
                        descuento_applied_by = presupuesto.extra_discount_applied_by
                        descuento_created_at = presupuesto.extra_discount_created_at
                    
                    # Calcular total de la orden
                    total_orden = o.seña_pagada + o.saldo_pendiente
                    
                    resultado.append({
                        "id": o.id,
                        "presupuesto_id": o.presupuesto.id,
                        "presupuesto_numero": o.presupuesto.numero,
                        "cliente_nombre": (
                            f"{o.presupuesto.precliente.apellido} {o.presupuesto.precliente.nombre}".strip()
                            if o.presupuesto.precliente
                            else f"{o.presupuesto.cliente.apellido} {o.presupuesto.cliente.nombre}".strip()
                        ),
                        "es_precliente": o.presupuesto.precliente is not None,
                        "precliente_id": o.presupuesto.precliente.id if o.presupuesto.precliente else None,
                        "cliente_id": o.presupuesto.cliente.id if o.presupuesto.cliente else None,
                        "cliente_dni": o.presupuesto.cliente.dni if o.presupuesto.cliente else None,
                        "cliente_direccion": o.presupuesto.cliente.direccion if o.presupuesto.cliente else None,
                        "fecha_evento": o.fecha_evento.isoformat(),
                        "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else "",
                        "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else None,
                        "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else None,
                        "seña_pagada": o.seña_pagada,
                        "saldo_pendiente": o.saldo_pendiente,
                        "total": total_orden,  # Total de la orden (con descuento si aplica)
                        "total_presupuesto": o.presupuesto.total,  # Total del presupuesto (con descuento si aplica)
                        "estado": o.estado,
                        "metodo_pago": (f"{o.metodo_pago_configurable.nombre} - {o.submetodo_pago.nombre}" 
                                       if o.metodo_pago_configurable and o.submetodo_pago 
                                       else (o.metodo_pago_configurable.nombre if o.metodo_pago_configurable else o.metodo_pago)),
                        "productos_reservados": [
                            {
                                "producto_id": pr.producto.id,
                                "producto_descripcion": pr.producto.descripcion,
                                "estado": pr.estado,
                                "fecha_bloqueo": pr.fecha_bloqueo.isoformat(),
                                "observaciones": pr.observaciones,
                            }
                            for pr in o.productos_reservados
                        ],
                        # Campos de descuento extra (de la orden o del presupuesto)
                        "extra_discount_percentage": descuento_percentage,
                        "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                        "extra_discount_reason": descuento_reason,
                        "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                        "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                        "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
                        "contrato_generado_at": o.contrato_generado_at.isoformat() if o.contrato_generado_at else None,
                    })
                
                return resultado
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al listar órdenes de trabajo: {str(e)}")

    def obtener_orden_por_id(self, orden_id: int) -> dict:
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                presupuesto = orden.presupuesto
                
                # Si la orden no tiene descuento extra pero el presupuesto sí, usar el del presupuesto
                descuento_percentage = orden.extra_discount_percentage
                descuento_amount = orden.extra_discount_amount
                descuento_reason = orden.extra_discount_reason
                descuento_applied_by = orden.extra_discount_applied_by
                descuento_created_at = orden.extra_discount_created_at
                
                if not descuento_percentage and presupuesto.extra_discount_percentage:
                    # Si la orden no tiene descuento pero el presupuesto sí, usar el del presupuesto
                    descuento_percentage = presupuesto.extra_discount_percentage
                    descuento_amount = presupuesto.extra_discount_amount
                    descuento_reason = presupuesto.extra_discount_reason
                    descuento_applied_by = presupuesto.extra_discount_applied_by
                    descuento_created_at = presupuesto.extra_discount_created_at

                # Calcular total de la orden (seña + saldo pendiente)
                total_orden = orden.seña_pagada + orden.saldo_pendiente
                
                return {
                    "id": orden.id,
                    "presupuesto_id": orden.presupuesto.id,
                    "presupuesto_numero": orden.presupuesto.numero,
                    "cliente_nombre": (
                    f"{orden.presupuesto.precliente.apellido} {orden.presupuesto.precliente.nombre}".strip()
                    if orden.presupuesto.precliente
                    else f"{orden.presupuesto.cliente.apellido} {orden.presupuesto.cliente.nombre}".strip()
                ),
                    "es_precliente": orden.presupuesto.precliente is not None,
                    "precliente_id": orden.presupuesto.precliente.id if orden.presupuesto.precliente else None,
                    "cliente_id": orden.presupuesto.cliente.id if orden.presupuesto.cliente else None,
                    "cliente_dni": orden.presupuesto.cliente.dni if orden.presupuesto.cliente else None,
                    "cliente_direccion": orden.presupuesto.cliente.direccion if orden.presupuesto.cliente else None,
                    "cliente_celular": (
                    orden.presupuesto.precliente.celular if orden.presupuesto.precliente else orden.presupuesto.cliente.celular
                ),
                    "fecha_evento": orden.fecha_evento.isoformat(),
                    "fecha_creacion": orden.fecha_creacion.isoformat() if orden.fecha_creacion else "",
                    "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else None,
                    "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else None,
                    "seña_pagada": orden.seña_pagada,
                    "saldo_pendiente": orden.saldo_pendiente,
                    "total": total_orden,  # Total de la orden (con descuento si aplica)
                    "total_presupuesto": presupuesto.total,  # Total del presupuesto (con descuento si aplica)
                    "estado": orden.estado,
                    "metodo_pago": (f"{orden.metodo_pago_configurable.nombre} - {orden.submetodo_pago.nombre}" 
                                   if orden.metodo_pago_configurable and orden.submetodo_pago 
                                   else (orden.metodo_pago_configurable.nombre if orden.metodo_pago_configurable else orden.metodo_pago)),
                    "productos_reservados": [
                        {
                            "producto_id": pr.producto.id,
                            "producto_descripcion": pr.producto.descripcion,
                            "estado": pr.estado,
                            "fecha_bloqueo": pr.fecha_bloqueo.isoformat(),
                            "observaciones": pr.observaciones,
                        }
                        for pr in orden.productos_reservados
                    ],
                    # Campos de descuento extra (de la orden o del presupuesto)
                    "extra_discount_percentage": descuento_percentage,
                    "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                    "extra_discount_reason": descuento_reason,
                    "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                    "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                    "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
                    "contrato_generado_at": orden.contrato_generado_at.isoformat() if orden.contrato_generado_at else None,
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener orden de trabajo: {str(e)}")

    def obtener_ordenes_para_semana(self, fecha_base: datetime) -> list:
        with db_session:
            try:
                lunes = fecha_base - timedelta(days=fecha_base.weekday())
                domingo = lunes + timedelta(days=6)

                ordenes = list(OrdenTrabajo.select(lambda o: lunes <= o.fecha_evento <= domingo))

                if not ordenes:
                    return []

                return [
                    {
                        "id": o.id,
                        "presupuesto_id": o.presupuesto.id,
                        "presupuesto_numero": o.presupuesto.numero,
                        "cliente_nombre": (
                            f"{o.presupuesto.precliente.apellido} {o.presupuesto.precliente.nombre}".strip()
                            if o.presupuesto.precliente
                            else f"{o.presupuesto.cliente.apellido} {o.presupuesto.cliente.nombre}".strip()
                        ),
                        "fecha_evento": o.fecha_evento.isoformat(),
                        "estado": o.estado,
                        "seña_pagada": o.seña_pagada,
                        "saldo_pendiente": o.saldo_pendiente
                    }
                    for o in ordenes
                ]
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener órdenes para la semana: {str(e)}")

    def actualizar_estado_orden(self, orden_id: int, nuevo_estado: str) -> dict:
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                estados_validos = ["En proceso", "Completada", "Cancelada", "Entregada"]
                if nuevo_estado not in estados_validos:
                    raise HTTPException(status_code=400, detail=f"Estado no válido. Estados permitidos: {estados_validos}")

                # Si se marca como "Completada", incrementar el contador de veces alquilado para cada producto
                if nuevo_estado == "Completada" and orden.estado != "Completada":
                    presupuesto = orden.presupuesto
                    if presupuesto:
                        # Incrementar contador para cada producto en el presupuesto
                        for item in presupuesto.items:
                            producto = item.producto
                            if producto:
                                producto.veces_alquilado += item.cantidad

                orden.estado = nuevo_estado
                flush()

                return {
                    "message": f"Estado de orden actualizado a {nuevo_estado}",
                    "success": True,
                    "data": {
                        "id": orden.id,
                        "estado": orden.estado
                    }
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail="Error al actualizar estado de orden: {str(e)}")

    def registrar_pago_saldo(self, orden_id: int, monto_pagado: float, payment_method: str, usuario_id: int, cuenta_destino_id: int, metodo_pago_id: Optional[int] = None, submetodo_pago_id: Optional[int] = None, motivo_recibo: Optional[str] = None) -> dict:
        """Registrar un pago adicional del saldo pendiente de una orden de trabajo"""
        with db_session:
            try:
                from src.models import Usuario, CuentaDestino
                
                # Obtener usuario y sucursal primero para validaciones
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                sucursal = usuario.sucursal
                
                # Validar y obtener método de pago (nuevo sistema o compatibilidad)
                metodo_pago_configurable = None
                submetodo_pago = None
                payment_method_str = payment_method or "EFECTIVO"
                payment_method_enum = None
                
                if metodo_pago_id:
                    # Usar nuevo sistema de métodos configurables
                    from src.services.metodos_pago_services import MetodosPagoServices
                    metodos_pago_service = MetodosPagoServices()
                    metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                        metodo_pago_id,
                        submetodo_pago_id,
                        sucursal.id
                    )
                    payment_method_str = metodo_pago_configurable.nombre
                    if submetodo_pago:
                        payment_method_str = f"{metodo_pago_configurable.nombre} - {submetodo_pago.nombre}"
                elif payment_method:
                    # Sistema antiguo - mantener compatibilidad
                    if payment_method not in [mp.value for mp in MetodoPago]:
                        metodos_validos = [mp.value for mp in MetodoPago]
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}"
                        )
                    payment_method_enum = MetodoPago(payment_method)
                    payment_method_str = payment_method
                
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                if orden.saldo_pendiente <= 0:
                    raise HTTPException(status_code=400, detail="La orden no tiene saldo pendiente")

                if monto_pagado > orden.saldo_pendiente:
                    raise HTTPException(status_code=400, detail="El monto pagado excede el saldo pendiente")

                # Validar cuenta destino obligatoria
                cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                if not cuenta_destino:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Verificar que la cuenta destino pertenece a la sucursal
                if cuenta_destino.sucursal.id != sucursal.id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino debe pertenecer a la sucursal"
                    )
                
                # Verificar que la cuenta destino está activa
                if not cuenta_destino.activa:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino seleccionada está inactiva"
                    )

                # Actualizar saldo pendiente
                nuevo_saldo_pendiente = orden.saldo_pendiente - monto_pagado
                orden.saldo_pendiente = nuevo_saldo_pendiente

                # Crear movimiento en cuenta corriente solo si el presupuesto tiene cliente (no precliente)
                if orden.presupuesto.cliente:
                    movimiento_cc = CuentaCorriente(
                        cliente=orden.presupuesto.cliente,
                        concepto=f"Pago adicional para orden {orden.presupuesto.numero}",
                        tipo="credito",
                        monto=monto_pagado,
                        saldo_post=monto_pagado,  # Aquí deberías calcular el saldo acumulado real
                        referencia_orden=orden.id,
                        metodo_pago_configurable=metodo_pago_configurable,
                        submetodo_pago=submetodo_pago
                    )
                    flush()

                # Crear movimiento en caja diaria
                movimiento_caja = CajaMovimiento(
                    fecha_hora=datetime.now(),
                    tipo="INGRESO",
                    monto=monto_pagado,
                    payment_method=payment_method_enum,  # Para compatibilidad (opcional)
                    metodo_pago_configurable=metodo_pago_configurable,  # Nueva relación
                    submetodo_pago=submetodo_pago,  # Nueva relación
                    origen=f"PAGO_ADICIONAL_ORDEN:{orden.presupuesto.numero}",
                    categoria="PAGOS_ADICIONALES",
                    venta=None,
                    usuario=usuario,
                    sucursal=sucursal,
                    cuenta_destino=cuenta_destino
                )
                flush()

                cliente_nombre_recibo = (
                    f"{orden.presupuesto.precliente.apellido} {orden.presupuesto.precliente.nombre}".strip()
                    if orden.presupuesto.precliente
                    else f"{orden.presupuesto.cliente.apellido} {orden.presupuesto.cliente.nombre}".strip()
                )
                motivo = (motivo_recibo or "Pago").strip() or "Pago"
                recibo = ReciboOrden(
                    orden_trabajo=orden,
                    fecha_hora=datetime.now(),
                    monto=monto_pagado,
                    motivo=motivo,
                    cliente_nombre=cliente_nombre_recibo,
                    presupuesto_numero=orden.presupuesto.numero,
                    movimiento_caja_id=movimiento_caja.id
                )
                flush()

                # Si el saldo pendiente es 0, marcar como pagada
                if nuevo_saldo_pendiente == 0:
                    orden.estado = "Pagada"

                return {
                    "message": "Pago registrado exitosamente",
                    "success": True,
                    "data": {
                        "id": orden.id,
                        "presupuesto_numero": orden.presupuesto.numero,
                        "monto_pagado": monto_pagado,
                        "saldo_pendiente_anterior": orden.saldo_pendiente + monto_pagado,
                        "saldo_pendiente_actual": orden.saldo_pendiente,
                        "estado": orden.estado,
                        "recibo": {
                            "id": recibo.id,
                            "orden_id": orden.id,
                            "fecha_hora": recibo.fecha_hora.isoformat(),
                            "monto": recibo.monto,
                            "motivo": recibo.motivo,
                            "cliente_nombre": recibo.cliente_nombre,
                            "presupuesto_numero": recibo.presupuesto_numero,
                        }
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail="Error al registrar pago: {str(e)}")

    def obtener_historial_pagos(self, orden_id: int) -> dict:
        """Obtener el historial de pagos de una orden de trabajo"""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                # Obtener movimientos de caja relacionados con esta orden
                from src.models import CajaMovimiento
                presupuesto_numero = orden.presupuesto.numero
                
                # Obtener todos los movimientos y filtrar en Python
                # Buscar cualquier movimiento que contenga el número de presupuesto en el origen
                todos_movimientos = list(CajaMovimiento.select().order_by(CajaMovimiento.fecha_hora))
                
                # Filtrar movimientos relacionados con esta orden
                # Buscar por número de presupuesto en el origen (sin importar el formato)
                movimientos_caja = []
                for cm in todos_movimientos:
                    try:
                        if not cm.origen:
                            continue
                        origen_str = str(cm.origen)
                        # Buscar movimientos que contengan el número de presupuesto
                        # o que sean específicamente de esta orden
                        if (presupuesto_numero in origen_str or
                            f"SEÑA_PRESUPUESTO:{presupuesto_numero}" in origen_str or
                            f"PAGO_ADICIONAL_ORDEN:{presupuesto_numero}" in origen_str):
                            movimientos_caja.append(cm)
                    except Exception as e:
                        print(f"⚠️ Error al filtrar movimiento {cm.id}: {e}")
                        continue
                
                # Debug: imprimir información para diagnosticar
                print(f"🔍 Buscando movimientos para presupuesto: {presupuesto_numero}")
                print(f"📊 Total movimientos de caja encontrados: {len(movimientos_caja)}")
                for mov in movimientos_caja:
                    print(f"  - Movimiento {mov.id}: origen={mov.origen}, monto={mov.monto}, fecha={mov.fecha_hora}")

                # Obtener movimientos de cuenta corriente
                movimientos_cuenta = list(CuentaCorriente.select(
                    lambda cc: cc.referencia_orden == orden.id
                ).order_by(CuentaCorriente.fecha))

                cliente_nombre_hist = (
                    f"{orden.presupuesto.precliente.apellido} {orden.presupuesto.precliente.nombre}".strip()
                    if orden.presupuesto.precliente
                    else f"{orden.presupuesto.cliente.nombre} {orden.presupuesto.cliente.apellido}"
                )
                historial = {
                    "orden_id": orden.id,
                    "presupuesto_numero": orden.presupuesto.numero,
                    "cliente": cliente_nombre_hist,
                    "total_presupuesto": orden.presupuesto.total,
                    "seña_inicial": orden.seña_pagada,
                    "saldo_pendiente_actual": orden.saldo_pendiente,
                    "estado": orden.estado,
                    "pagos": []
                }

                # Agregar seña inicial
                if orden.seña_pagada > 0:
                    # Buscar el movimiento de caja de la seña inicial
                    seña_inicial_mov = None
                    presupuesto_numero = orden.presupuesto.numero
                    for mov in movimientos_caja:
                        if f"SEÑA_PRESUPUESTO:{presupuesto_numero}" in mov.origen:
                            seña_inicial_mov = mov
                            break
                    
                    usuario_nombre = "N/A"
                    sucursal_nombre = "N/A"
                    cuenta_destino_nombre = "N/A"
                    movimiento_id = None
                    
                    if seña_inicial_mov:
                        try:
                            if seña_inicial_mov.usuario:
                                usuario_nombre = f"{seña_inicial_mov.usuario.nombre} {seña_inicial_mov.usuario.apellido}"
                            if seña_inicial_mov.sucursal:
                                sucursal_nombre = seña_inicial_mov.sucursal.nombre
                            if seña_inicial_mov.cuenta_destino:
                                cuenta_destino_nombre = seña_inicial_mov.cuenta_destino.nombre_titular
                            movimiento_id = seña_inicial_mov.id
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos de seña inicial: {e}")
                    
                    # Determinar método de pago a mostrar
                    metodo_pago_display = orden.metodo_pago  # Compatibilidad
                    if orden.metodo_pago_configurable:
                        metodo_pago_display = orden.metodo_pago_configurable.nombre
                        if orden.submetodo_pago:
                            metodo_pago_display = f"{orden.metodo_pago_configurable.nombre} - {orden.submetodo_pago.nombre}"
                    
                    historial["pagos"].append({
                        "tipo": "Seña inicial",
                        "fecha": orden.fecha_creacion.isoformat(),
                        "fecha_hora": orden.fecha_creacion.isoformat(),
                        "monto": orden.seña_pagada,
                        "metodo_pago": metodo_pago_display,
                        "origen": "Creación de orden",
                        "usuario_nombre": usuario_nombre,
                        "sucursal_nombre": sucursal_nombre,
                        "cuenta_destino_nombre": cuenta_destino_nombre,
                        "movimiento_id": movimiento_id
                    })

                # Crear un set para rastrear montos ya agregados y evitar duplicados
                # Usaremos (monto, fecha) como clave única
                pagos_agregados = set()
                
                # Agregar pagos adicionales desde movimientos de caja
                # Excluir la seña inicial que ya se agregó
                presupuesto_numero = orden.presupuesto.numero
                for movimiento in movimientos_caja:
                    try:
                        # Validar que el movimiento tenga origen
                        if not movimiento.origen:
                            continue
                        
                        origen_str = str(movimiento.origen)
                        # Solo agregar si es un pago adicional (no la seña inicial)
                        if (f"PAGO_ADICIONAL_ORDEN:{presupuesto_numero}" in origen_str or
                            ("PAGO_ADICIONAL" in origen_str.upper() and 
                             f"SEÑA_PRESUPUESTO:{presupuesto_numero}" not in origen_str)):
                            
                            # Crear clave única para evitar duplicados
                            fecha_mov = movimiento.fecha_hora.isoformat() if movimiento.fecha_hora else ""
                            clave_pago = (float(movimiento.monto), fecha_mov)
                            
                            if clave_pago in pagos_agregados:
                                print(f"⚠️ Pago duplicado detectado: monto={movimiento.monto}, fecha={fecha_mov}")
                                continue
                            
                            pagos_agregados.add(clave_pago)
                            
                            # Obtener método de pago de forma segura (nuevo sistema o compatibilidad)
                            metodo_pago = "N/A"
                            if movimiento.metodo_pago_configurable:
                                # Nuevo sistema
                                metodo_pago = movimiento.metodo_pago_configurable.nombre
                                if movimiento.submetodo_pago:
                                    metodo_pago = f"{movimiento.metodo_pago_configurable.nombre} - {movimiento.submetodo_pago.nombre}"
                            elif movimiento.payment_method:
                                # Sistema antiguo - compatibilidad
                                if hasattr(movimiento.payment_method, 'value'):
                                    metodo_pago = movimiento.payment_method.value
                                else:
                                    metodo_pago = str(movimiento.payment_method)
                            
                            # Obtener usuario de forma segura
                            usuario_nombre = "N/A"
                            if movimiento.usuario:
                                usuario_nombre = f"{movimiento.usuario.nombre} {movimiento.usuario.apellido}"
                            
                            # Obtener sucursal de forma segura
                            sucursal_nombre = "N/A"
                            if movimiento.sucursal:
                                sucursal_nombre = movimiento.sucursal.nombre
                            
                            # Obtener cuenta destino de forma segura
                            cuenta_destino_nombre = "N/A"
                            if movimiento.cuenta_destino:
                                cuenta_destino_nombre = movimiento.cuenta_destino.nombre_titular
                            
                            historial["pagos"].append({
                                "tipo": "Pago adicional",
                                "fecha": movimiento.fecha_hora.isoformat() if movimiento.fecha_hora else None,
                                "fecha_hora": movimiento.fecha_hora.isoformat() if movimiento.fecha_hora else None,
                                "monto": movimiento.monto,
                                "metodo_pago": metodo_pago,
                                "origen": origen_str,
                                "usuario_nombre": usuario_nombre,
                                "sucursal_nombre": sucursal_nombre,
                                "cuenta_destino_nombre": cuenta_destino_nombre,
                                "movimiento_id": movimiento.id
                            })
                    except Exception as e:
                        print(f"⚠️ Error al procesar movimiento {movimiento.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
                
                # Agregar pagos desde cuenta corriente que no tengan movimiento de caja correspondiente
                print(f"📊 Total movimientos de cuenta corriente encontrados: {len(movimientos_cuenta)}")
                for movimiento_cc in movimientos_cuenta:
                    try:
                        if movimiento_cc.tipo == "credito" and movimiento_cc.monto > 0:
                            # Crear clave única para evitar duplicados
                            fecha_cc = movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else ""
                            clave_pago = (float(movimiento_cc.monto), fecha_cc)
                            
                            # Solo agregar si no fue agregado desde movimientos de caja
                            if clave_pago not in pagos_agregados:
                                pagos_agregados.add(clave_pago)
                                print(f"📝 Agregando pago desde cuenta corriente: monto={movimiento_cc.monto}, fecha={fecha_cc}")
                                historial["pagos"].append({
                                    "tipo": "Pago adicional",
                                    "fecha": movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else None,
                                    "fecha_hora": movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else None,
                                    "monto": movimiento_cc.monto,
                                    "metodo_pago": (f"{movimiento_cc.metodo_pago_configurable.nombre} - {movimiento_cc.submetodo_pago.nombre}" 
                                                   if movimiento_cc.metodo_pago_configurable and movimiento_cc.submetodo_pago 
                                                   else (movimiento_cc.metodo_pago_configurable.nombre 
                                                         if movimiento_cc.metodo_pago_configurable 
                                                         else "N/A")),
                                    "origen": movimiento_cc.concepto,
                                    "usuario_nombre": "N/A",
                                    "sucursal_nombre": "N/A",
                                    "movimiento_id": movimiento_cc.id
                                })
                            else:
                                print(f"⚠️ Pago de cuenta corriente ya agregado desde caja: monto={movimiento_cc.monto}, fecha={fecha_cc}")
                    except Exception as e:
                        print(f"⚠️ Error al procesar movimiento de cuenta corriente {movimiento_cc.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # Ordenar pagos por fecha
                historial["pagos"].sort(key=lambda x: x["fecha"])

                return {
                    "message": "Historial de pagos obtenido exitosamente",
                    "success": True,
                    "data": historial
                }

            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error al obtener historial de pagos: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al obtener historial de pagos: {str(e)}")

    def listar_recibos_orden(self, orden_id: int) -> dict:
        """Listar historial de recibos de una orden (seña inicial + recibos de pagos adicionales)."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
                cliente_nombre = (
                    f"{orden.presupuesto.precliente.apellido} {orden.presupuesto.precliente.nombre}".strip()
                    if orden.presupuesto.precliente
                    else f"{orden.presupuesto.cliente.apellido} {orden.presupuesto.cliente.nombre}".strip()
                )
                recibos = []
                if orden.seña_pagada > 0:
                    recibos.append({
                        "id": None,
                        "orden_id": orden.id,
                        "tipo": "Seña inicial",
                        "fecha_hora": orden.fecha_creacion.isoformat() if orden.fecha_creacion else None,
                        "monto": orden.seña_pagada,
                        "motivo": "Seña",
                        "cliente_nombre": cliente_nombre,
                        "presupuesto_numero": orden.presupuesto.numero,
                    })
                for r in sorted(orden.recibos, key=lambda r: r.fecha_hora):
                    recibos.append({
                        "id": r.id,
                        "orden_id": orden.id,
                        "tipo": "Pago adicional",
                        "fecha_hora": r.fecha_hora.isoformat() if r.fecha_hora else None,
                        "monto": r.monto,
                        "motivo": r.motivo,
                        "cliente_nombre": r.cliente_nombre,
                        "presupuesto_numero": r.presupuesto_numero,
                    })
                recibos.sort(key=lambda x: x["fecha_hora"] or "")
                return {
                    "message": "Recibos obtenidos exitosamente",
                    "success": True,
                    "data": {"recibos": recibos}
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al listar recibos: {str(e)}")

    def registrar_contrato_generado(self, orden_id: int) -> dict:
        """Registrar que se generó el contrato para esta orden (solo si es cliente y saldo 0)."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
                if orden.presupuesto.precliente is not None:
                    raise HTTPException(status_code=400, detail="Solo se puede generar contrato para órdenes de cliente (no precliente).")
                if orden.saldo_pendiente != 0:
                    raise HTTPException(status_code=400, detail="El saldo pendiente debe ser cero para generar el contrato.")
                if not orden.presupuesto.cliente.dni or not orden.presupuesto.cliente.direccion:
                    raise HTTPException(status_code=400, detail="El cliente debe tener DNI y Dirección para generar el contrato.")
                orden.contrato_generado_at = datetime.now()
                for pr in list(orden.productos_reservados):
                    prod = getattr(pr, "producto", None)
                    if prod:
                        prod.estado = EstadoProducto.CLIENTE
                flush()
                return {
                    "message": "Contrato registrado correctamente",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "contrato_generado_at": orden.contrato_generado_at.isoformat(),
                    },
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al registrar contrato: {str(e)}")

    def listar_contratos(self) -> list:
        """Listar órdenes que tienen contrato generado (para la vista Contratos)."""
        with db_session:
            try:
                todas = list(OrdenTrabajo.select().order_by(desc(OrdenTrabajo.id)))
                ordenes = [o for o in todas if getattr(o, "contrato_generado_at", None) is not None]
                resultado = []
                for o in ordenes:
                    try:
                        presupuesto = o.presupuesto
                        if not presupuesto:
                            continue
                        if presupuesto.precliente:
                            cliente_nombre = f"{presupuesto.precliente.apellido} {presupuesto.precliente.nombre}".strip()
                        elif presupuesto.cliente:
                            cliente_nombre = f"{presupuesto.cliente.apellido} {presupuesto.cliente.nombre}".strip()
                        else:
                            cliente_nombre = "—"
                        cliente = getattr(presupuesto, "cliente", None)
                        cliente_dni = getattr(cliente, "dni", None) if cliente else None
                        cliente_direccion = getattr(cliente, "direccion", None) if cliente else None
                        productos_reservados = []
                        for pr in o.productos_reservados:
                            prod = getattr(pr, "producto", None)
                            if prod:
                                productos_reservados.append({
                                    "producto_id": getattr(prod, "id", None),
                                    "producto_descripcion": getattr(prod, "descripcion", "") or "",
                                })
                        resultado.append({
                            "orden_id": o.id,
                            "presupuesto_numero": getattr(presupuesto, "numero", "") or "",
                            "cliente_nombre": cliente_nombre,
                            "cliente_dni": cliente_dni,
                            "cliente_direccion": cliente_direccion,
                            "fecha_evento": o.fecha_evento.isoformat() if o.fecha_evento else None,
                            "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else None,
                            "contrato_generado_at": o.contrato_generado_at.isoformat() if o.contrato_generado_at else None,
                            "total": float(o.seña_pagada or 0) + float(o.saldo_pendiente or 0),
                            "productos_reservados": productos_reservados,
                        })
                    except Exception as item_e:
                        logger.warning("listar_contratos: omitiendo orden %s: %s", o.id, item_e)
                        continue
                return resultado
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al listar contratos: {str(e)}")

    def eliminar_orden_trabajo(self, orden_id: int) -> dict:
        """Eliminar una orden de trabajo y liberar los productos reservados"""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                # Obtener el presupuesto asociado antes de eliminar la orden
                presupuesto = orden.presupuesto
                
                # Eliminar todos los productos reservados asociados a esta orden
                # Esto libera automáticamente los productos para que estén disponibles
                productos_reservados = list(orden.productos_reservados)
                for producto_reservado in productos_reservados:
                    producto_reservado.delete()
                
                # Asegurar que las eliminaciones se apliquen antes de eliminar la orden
                flush()

                # Eliminar la orden
                orden_id_eliminada = orden.id
                orden.delete()
                
                # Cambiar el estado del presupuesto a "cancelada" ya que la orden fue eliminada
                if presupuesto:
                    presupuesto.estado = "cancelada"
                    flush()  # Asegurar que el cambio de estado del presupuesto se guarde

                return {
                    "message": "Orden de trabajo eliminada exitosamente. El presupuesto ha sido cancelado y los productos han sido liberados.",
                    "success": True,
                    "data": {
                        "id": orden_id_eliminada
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al eliminar orden de trabajo: {str(e)}")

    def _obtener_cliente_orden(self, orden: "OrdenTrabajo") -> tuple:
        """Obtiene nombre y celular del cliente/precliente de la orden."""
        presupuesto = getattr(orden, "presupuesto", None)
        if not presupuesto:
            return None, None
        if presupuesto.cliente:
            return f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}".strip(), presupuesto.cliente.celular or None
        if presupuesto.precliente:
            return f"{presupuesto.precliente.nombre} {presupuesto.precliente.apellido}".strip(), presupuesto.precliente.celular or None
        return None, None

    def _aplicar_destino_productos(
        self,
        productos: list,
        destino: str,
        lavanderia_id: Optional[int],
        modista_id: Optional[int],
        descripcion: Optional[str] = None,
        cliente_nombre: Optional[str] = None,
        cliente_celular: Optional[str] = None,
    ) -> None:
        """Asigna cada producto al estado destino (SALON, LAVANDERIA o MODISTA). Opcionalmente guarda descripcion y datos de cliente."""
        if destino == "LAVANDERIA" and not lavanderia_id:
            raise HTTPException(status_code=400, detail="Debe indicar lavanderia_id cuando destino es LAVANDERIA")
        if destino == "MODISTA" and not modista_id:
            raise HTTPException(status_code=400, detail="Debe indicar modista_id cuando destino es MODISTA")

        lavanderia = None
        modista = None
        if destino == "LAVANDERIA":
            lavanderia = Lavanderia.get(id=lavanderia_id)
            if not lavanderia:
                raise HTTPException(status_code=404, detail="Lavandería no encontrada")
        if destino == "MODISTA":
            modista = Modista.get(id=modista_id)
            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")

        estado_enum = getattr(EstadoProducto, destino, None) or EstadoProducto.SALON
        hoy = date.today()
        notas = (descripcion or "").strip() or None
        cli_nombre = (cliente_nombre or "").strip() or None
        cli_celular = (cliente_celular or "").strip() or None

        for pr in productos:
            prod = getattr(pr, "producto", None)
            if not prod:
                continue
            prod.estado = estado_enum
            prod.inmovilizado = False
            if destino == "LAVANDERIA" and lavanderia:
                ProductoLavanderia(producto=prod, lavanderia=lavanderia, fecha_ingreso=hoy, notas=notas, cliente_nombre=cli_nombre, cliente_celular=cli_celular)
            elif destino == "MODISTA" and modista:
                ProductoModista(producto=prod, modista=modista, fecha_ingreso=hoy, notas=notas, cliente_nombre=cli_nombre, cliente_celular=cli_celular)

    def completar_devolucion(
        self,
        orden_id: int,
        usuario_id: int,
        destino: str,
        lavanderia_id: Optional[int] = None,
        modista_id: Optional[int] = None,
    ) -> dict:
        """Completar la devolución. Los productos pasan al estado indicado (SALON, LAVANDERIA o MODISTA) y se liberan de la orden."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                if orden.estado and orden.estado.lower() in ["completada", "cancelada"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"La orden ya está en estado '{orden.estado}' y no puede ser completada"
                    )

                productos_reservados = list(orden.productos_reservados)
                cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
                self._aplicar_destino_productos(
                    productos_reservados,
                    destino,
                    lavanderia_id,
                    modista_id,
                    cliente_nombre=cliente_nombre,
                    cliente_celular=cliente_celular,
                )
                for producto_reservado in productos_reservados:
                    producto_reservado.delete()

                orden.estado = "Completada"
                flush()

                return {
                    "message": f"Devolución completada. Productos enviados a {destino}.",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "estado": orden.estado,
                        "productos_liberados": len(productos_reservados),
                        "destino": destino,
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al completar devolución: {str(e)}")

    def registrar_devolucion_parcial(
        self,
        orden_id: int,
        productos_ids: list,
        descripcion: str,
        usuario_id: int,
        destino: str,
        lavanderia_id: Optional[int] = None,
        modista_id: Optional[int] = None,
    ) -> dict:
        """Registrar devolución parcial. Los productos seleccionados pasan al estado indicado (SALON, LAVANDERIA o MODISTA) y se liberan de la orden."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                if not productos_ids:
                    raise HTTPException(
                        status_code=400,
                        detail="Debe seleccionar al menos un producto para la devolución parcial"
                    )

                productos_en_orden = {pr.producto.id: pr for pr in orden.productos_reservados}
                productos_invalidos = [pid for pid in productos_ids if pid not in productos_en_orden]
                if productos_invalidos:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Los siguientes productos no pertenecen a esta orden: {productos_invalidos}"
                    )

                # Productos reservados a devolver (pasar a destino y eliminar de la orden)
                a_devolver = [productos_en_orden[pid] for pid in productos_ids]
                cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
                self._aplicar_destino_productos(a_devolver, destino, lavanderia_id, modista_id, descripcion=descripcion, cliente_nombre=cliente_nombre, cliente_celular=cliente_celular)

                # Agregar observaciones en cada ProductoReservado antes de borrar (opcional, para historial)
                for pr in a_devolver:
                    observaciones_previas = pr.observaciones or ""
                    nueva_observacion = f"[Devolución parcial - {datetime.now().strftime('%d/%m/%Y %H:%M')}] {descripcion}"
                    pr.observaciones = f"{observaciones_previas}\n{nueva_observacion}".strip() if observaciones_previas else nueva_observacion
                    pr.delete()

                if orden.estado and orden.estado.lower() not in ["completada", "cancelada"]:
                    if orden.estado.lower() not in ["en proceso", "entregada"]:
                        orden.estado = "En proceso"

                flush()

                return {
                    "message": f"Devolución parcial registrada. Productos enviados a {destino}.",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "productos_devueltos": productos_ids,
                        "descripcion": descripcion,
                        "destino": destino,
                        "productos_devueltos_count": len(productos_ids),
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al registrar devolución parcial: {str(e)}")


