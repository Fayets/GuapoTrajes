from pony.orm import db_session, select
from fastapi import HTTPException
from src.models import OrdenTrabajo, ProductoReservado, Presupuesto, Producto, CuentaCorriente, CajaMovimiento, MetodoPago
from datetime import datetime, timedelta

class OrdenTrabajoServices:
    def __init__(self):
        pass

    def crear_orden_trabajo(self, presupuesto_id: int, seña_pagada: float, payment_method: str, usuario_id: int) -> dict:
        with db_session:
            try:
                print(f"🔍 DEBUG: Recibiendo método de pago: '{payment_method}' (tipo: {type(payment_method)})")
                print(f"🔍 DEBUG: Métodos válidos: {[mp.value for mp in MetodoPago]}")
                
                # Validar método de pago
                if payment_method not in [mp.value for mp in MetodoPago]:
                    metodos_validos = [mp.value for mp in MetodoPago]
                    print(f"❌ ERROR: Método de pago '{payment_method}' no es válido")
                    print(f"❌ ERROR: Métodos válidos: {metodos_validos}")
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}"
                    )
                
                print(f"✅ Método de pago válido: {payment_method}")
                
                # Convertir a enum para uso interno
                payment_method_enum = MetodoPago(payment_method)
                
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="El presupuesto ya tiene una orden de trabajo")

                # Obtener usuario y sucursal
                from src.models import Usuario
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                sucursal = usuario.sucursal

                total = presupuesto.total
                saldo_pendiente = total - seña_pagada
                fecha_bloqueo = presupuesto.fecha_evento - timedelta(days=5)

                orden = OrdenTrabajo(
                    presupuesto=presupuesto,
                    fecha_evento=presupuesto.fecha_evento,
                    seña_pagada=seña_pagada,
                    saldo_pendiente=saldo_pendiente,
                    metodo_pago=payment_method,  # Guardar como string
                    estado="En proceso"
                )

                # Crear movimiento en cuenta corriente
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
                    CajaMovimiento(
                        fecha_hora=datetime.now(),
                        tipo="INGRESO",
                        monto=seña_pagada,
                        payment_method=payment_method_enum,  # Usar el enum para el movimiento de caja
                        origen=f"SEÑA_PRESUPUESTO:{presupuesto.numero}",
                        venta=None,  # No es una venta, es una seña
                        usuario=usuario,
                        sucursal=sucursal
                    )

                # Reservar productos
                for item in presupuesto.items:
                    producto = item.producto
                    fecha_bloqueo = presupuesto.fecha_evento - timedelta(days=5)

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
                        "metodo_pago": orden.metodo_pago
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al crear orden de trabajo: {str(e)}")

    def listar_ordenes_trabajo(self) -> list:
        with db_session:
            try:
                ordenes = list(OrdenTrabajo.select())
                
                if not ordenes:
                    return []
                
                return [
                    {
                        "id": o.id,
                        "presupuesto_id": o.presupuesto.id,
                        "presupuesto_numero": o.presupuesto.numero,
                        "cliente_nombre": f"{o.presupuesto.cliente.nombre} {o.presupuesto.cliente.apellido}",
                        "fecha_evento": o.fecha_evento.isoformat(),
                        "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else "",
                        "seña_pagada": o.seña_pagada,
                        "saldo_pendiente": o.saldo_pendiente,
                        "estado": o.estado,
                        "metodo_pago": o.metodo_pago,
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
                    }
                    for o in ordenes
                ]
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al listar órdenes de trabajo: {str(e)}")

    def obtener_orden_por_id(self, orden_id: int) -> dict:
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                return {
                    "id": orden.id,
                    "presupuesto_id": orden.presupuesto.id,
                    "presupuesto_numero": orden.presupuesto.numero,
                    "cliente_nombre": f"{orden.presupuesto.cliente.nombre} {orden.presupuesto.cliente.apellido}",
                    "fecha_evento": orden.fecha_evento.isoformat(),
                    "fecha_creacion": orden.fecha_creacion.isoformat() if orden.fecha_creacion else "",
                    "seña_pagada": orden.seña_pagada,
                    "saldo_pendiente": orden.saldo_pendiente,
                    "estado": orden.estado,
                    "metodo_pago": orden.metodo_pago,
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
                        "cliente_nombre": f"{o.presupuesto.cliente.nombre} {o.presupuesto.cliente.apellido}",
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

                orden.estado = nuevo_estado

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

    def registrar_pago_saldo(self, orden_id: int, monto_pagado: float, payment_method: str, usuario_id: int) -> dict:
        """Registrar un pago adicional del saldo pendiente de una orden de trabajo"""
        with db_session:
            try:
                # Validar método de pago
                if payment_method not in [mp.value for mp in MetodoPago]:
                    metodos_validos = [mp.value for mp in MetodoPago]
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}"
                    )
                
                # Convertir a enum para uso interno
                payment_method_enum = MetodoPago(payment_method)
                
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                if orden.saldo_pendiente <= 0:
                    raise HTTPException(status_code=400, detail="La orden no tiene saldo pendiente")

                if monto_pagado > orden.saldo_pendiente:
                    raise HTTPException(status_code=400, detail="El monto pagado excede el saldo pendiente")

                # Obtener usuario y sucursal
                from src.models import Usuario
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                sucursal = usuario.sucursal

                # Actualizar saldo pendiente
                nuevo_saldo_pendiente = orden.saldo_pendiente - monto_pagado
                orden.saldo_pendiente = nuevo_saldo_pendiente

                # Crear movimiento en cuenta corriente
                CuentaCorriente(
                    cliente=orden.presupuesto.cliente,
                    concepto=f"Pago adicional para orden {orden.presupuesto.numero}",
                    tipo="credito",
                    monto=monto_pagado,
                    saldo_post=monto_pagado,  # Aquí deberías calcular el saldo acumulado real
                    referencia_orden=orden.id
                )

                # Crear movimiento en caja diaria
                CajaMovimiento(
                    fecha_hora=datetime.now(),
                    tipo="INGRESO",
                    monto=monto_pagado,
                    payment_method=payment_method_enum,  # Usar el enum para el movimiento de caja
                    origen=f"PAGO_ADICIONAL_ORDEN:{orden.presupuesto.numero}",
                    venta=None,
                    usuario=usuario,
                    sucursal=sucursal
                )

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
                        "estado": orden.estado
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
                movimientos_caja = list(CajaMovimiento.select(
                    lambda cm: cm.origen.startswith(f"SEÑA_PRESUPUESTO:{orden.presupuesto.numero}") or 
                              cm.origen.startswith(f"PAGO_ADICIONAL_ORDEN:{orden.presupuesto.numero}")
                ).order_by(CajaMovimiento.fecha_hora))

                # Obtener movimientos de cuenta corriente
                movimientos_cuenta = list(CuentaCorriente.select(
                    lambda cc: cc.referencia_orden == orden.id
                ).order_by(CuentaCorriente.fecha))

                historial = {
                    "orden_id": orden.id,
                    "presupuesto_numero": orden.presupuesto.numero,
                    "cliente": f"{orden.presupuesto.cliente.nombre} {orden.presupuesto.cliente.apellido}",
                    "total_presupuesto": orden.presupuesto.total,
                    "seña_inicial": orden.seña_pagada,
                    "saldo_pendiente_actual": orden.saldo_pendiente,
                    "estado": orden.estado,
                    "pagos": []
                }

                # Agregar seña inicial
                if orden.seña_pagada > 0:
                    historial["pagos"].append({
                        "tipo": "Seña inicial",
                        "fecha": orden.fecha_creacion.isoformat(),
                        "monto": orden.seña_pagada,
                        "metodo_pago": orden.metodo_pago,
                        "origen": "Creación de orden"
                    })

                # Agregar pagos adicionales desde movimientos de caja
                for movimiento in movimientos_caja:
                    if movimiento.origen.startswith("PAGO_ADICIONAL_ORDEN"):
                        historial["pagos"].append({
                            "tipo": "Pago adicional",
                            "fecha": movimiento.fecha_hora.isoformat(),
                            "monto": movimiento.monto,
                            "metodo_pago": movimiento.payment_method,
                            "origen": "Pago registrado en caja"
                        })

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
                raise HTTPException(status_code=500, detail="Error al obtener historial de pagos: {str(e)}")


