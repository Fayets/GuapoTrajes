from pony.orm import db_session, select, flush
from fastapi import HTTPException
from src.models import OrdenTrabajo, ProductoReservado, Presupuesto, Producto, CuentaCorriente, CajaMovimiento, MetodoPago
from datetime import datetime, timedelta

class OrdenTrabajoServices:
    def __init__(self):
        pass

    def crear_orden_trabajo(self, presupuesto_id: int, seña_pagada: float, payment_method: str, usuario_id: int) -> dict:
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
                
                # Asegurar que la fecha_evento se copie exactamente sin conversiones
                # La fecha_evento del presupuesto ya es un objeto date, copiarlo directamente
                fecha_evento_orden = presupuesto.fecha_evento
                
                # Debug: verificar la fecha antes de guardar
                print(f"🔍 DEBUG - Presupuesto fecha_evento: {presupuesto.fecha_evento} (tipo: {type(presupuesto.fecha_evento)})")
                print(f"🔍 DEBUG - Orden fecha_evento a guardar: {fecha_evento_orden} (tipo: {type(fecha_evento_orden)})")
                
                fecha_bloqueo = fecha_evento_orden - timedelta(days=5)

                orden = OrdenTrabajo(
                    presupuesto=presupuesto,
                    fecha_evento=fecha_evento_orden,
                    seña_pagada=seña_pagada,
                    saldo_pendiente=saldo_pendiente,
                    metodo_pago=payment_method,  # Guardar como string
                    estado="En proceso",
                    # Copiar campos de descuento extra del presupuesto
                    extra_discount_percentage=presupuesto.extra_discount_percentage,
                    extra_discount_amount=presupuesto.extra_discount_amount,
                    extra_discount_reason=presupuesto.extra_discount_reason,
                    extra_discount_applied_by=presupuesto.extra_discount_applied_by,
                    extra_discount_created_at=presupuesto.extra_discount_created_at,
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
                        "cliente_nombre": f"{o.presupuesto.cliente.nombre} {o.presupuesto.cliente.apellido}",
                        "fecha_evento": o.fecha_evento.isoformat(),
                        "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else "",
                        "seña_pagada": o.seña_pagada,
                        "saldo_pendiente": o.saldo_pendiente,
                        "total": total_orden,  # Total de la orden (con descuento si aplica)
                        "total_presupuesto": o.presupuesto.total,  # Total del presupuesto (con descuento si aplica)
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
                        # Campos de descuento extra (de la orden o del presupuesto)
                        "extra_discount_percentage": descuento_percentage,
                        "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                        "extra_discount_reason": descuento_reason,
                        "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                        "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                        "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
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
                    "cliente_nombre": f"{orden.presupuesto.cliente.nombre} {orden.presupuesto.cliente.apellido}",
                    "cliente_dni": orden.presupuesto.cliente.dni,
                    "cliente_direccion": orden.presupuesto.cliente.direccion,
                    "cliente_celular": orden.presupuesto.cliente.celular,
                    "fecha_evento": orden.fecha_evento.isoformat(),
                    "fecha_creacion": orden.fecha_creacion.isoformat() if orden.fecha_creacion else "",
                    "seña_pagada": orden.seña_pagada,
                    "saldo_pendiente": orden.saldo_pendiente,
                    "total": total_orden,  # Total de la orden (con descuento si aplica)
                    "total_presupuesto": presupuesto.total,  # Total del presupuesto (con descuento si aplica)
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
                    # Campos de descuento extra (de la orden o del presupuesto)
                    "extra_discount_percentage": descuento_percentage,
                    "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                    "extra_discount_reason": descuento_reason,
                    "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                    "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                    "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
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
                    # Buscar el movimiento de caja de la seña inicial
                    seña_inicial_mov = None
                    presupuesto_numero = orden.presupuesto.numero
                    for mov in movimientos_caja:
                        if f"SEÑA_PRESUPUESTO:{presupuesto_numero}" in mov.origen:
                            seña_inicial_mov = mov
                            break
                    
                    usuario_nombre = "N/A"
                    sucursal_nombre = "N/A"
                    movimiento_id = None
                    
                    if seña_inicial_mov:
                        try:
                            if seña_inicial_mov.usuario:
                                usuario_nombre = f"{seña_inicial_mov.usuario.nombre} {seña_inicial_mov.usuario.apellido}"
                            if seña_inicial_mov.sucursal:
                                sucursal_nombre = seña_inicial_mov.sucursal.nombre
                            movimiento_id = seña_inicial_mov.id
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos de seña inicial: {e}")
                    
                    historial["pagos"].append({
                        "tipo": "Seña inicial",
                        "fecha": orden.fecha_creacion.isoformat(),
                        "fecha_hora": orden.fecha_creacion.isoformat(),
                        "monto": orden.seña_pagada,
                        "metodo_pago": orden.metodo_pago,
                        "origen": "Creación de orden",
                        "usuario_nombre": usuario_nombre,
                        "sucursal_nombre": sucursal_nombre,
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
                            
                            # Obtener método de pago de forma segura
                            metodo_pago = "N/A"
                            if movimiento.payment_method:
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
                            
                            historial["pagos"].append({
                                "tipo": "Pago adicional",
                                "fecha": movimiento.fecha_hora.isoformat() if movimiento.fecha_hora else None,
                                "fecha_hora": movimiento.fecha_hora.isoformat() if movimiento.fecha_hora else None,
                                "monto": movimiento.monto,
                                "metodo_pago": metodo_pago,
                                "origen": origen_str,
                                "usuario_nombre": usuario_nombre,
                                "sucursal_nombre": sucursal_nombre,
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
                                    "metodo_pago": "N/A",
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


