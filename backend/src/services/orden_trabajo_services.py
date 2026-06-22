from pony.orm import db_session, select, flush
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
from typing import List, Optional, Any
import logging

from src.descripcion_producto import format_descripcion_producto
from src.services.disponibilidad_services import reconstruir_productos_reservados_para_orden

logger = logging.getLogger(__name__)


def _origen_caja_liga_presupuesto_o_orden(origen: Optional[str], presupuesto_numero: str, orden_id: int) -> bool:
    """Solo movimientos creados explícitamente para esta orden/presupuesto (evita falsos positivos por substring)."""
    if not origen:
        return False
    s = str(origen).strip()
    return (
        s.startswith(f"SEÑA_PRESUPUESTO:{presupuesto_numero}")
        or s.startswith(f"PAGO_ADICIONAL_ORDEN:{presupuesto_numero}")
        or s.startswith(f"PAGO_ADICIONAL:{orden_id}")
    )


def _producto_reservado_a_dict(pr: ProductoReservado, incluir_detalle: bool = True) -> dict:
    base = {
        "producto_reservado_id": pr.id,
        "producto_id": pr.producto.id,
        "producto_descripcion": format_descripcion_producto(
            pr.producto.descripcion, pr.producto.descripcion_extra
        ),
        "codigo_barra": pr.producto.codigo_barra or "",
        "estado": pr.estado,
        "fecha_bloqueo": pr.fecha_bloqueo.isoformat(),
        "observaciones": pr.observaciones,
        "requiere_modista": bool(getattr(pr, "requiere_modista", False)),
        "notas_modista": pr.notas_modista or "",
    }
    if incluir_detalle:
        p = pr.producto
        base.update(
            {
                "linea": p.linea.nombre if p.linea else "",
                "talle": p.talle.nombre if p.talle else "",
                "tela": p.tela.nombre if p.tela else "",
                "color": p.color.nombre if p.color else "",
                "descripcion_extra": p.descripcion_extra or "",
            }
        )
    return base


def _estado_historico_producto_orden(orden: OrdenTrabajo) -> str:
    est = (orden.estado or "").strip().lower()
    if est == "completada":
        return "devuelto"
    if est == "cancelada":
        return "cancelada"
    return "devuelto"


def _item_presupuesto_a_producto_orden_dict(
    item,
    orden: OrdenTrabajo,
    incluir_detalle: bool = True,
) -> dict:
    """Reconstruye la prenda de la orden desde el ítem del presupuesto (histórico)."""
    producto = item.producto
    presupuesto = orden.presupuesto
    fecha_retiro = (
        presupuesto.fecha_retiro
        or presupuesto.fecha_evento
        or orden.fecha_evento
    )
    fecha_bloqueo = (
        fecha_retiro - timedelta(days=5) if fecha_retiro else orden.fecha_evento
    )
    base = {
        "producto_reservado_id": None,
        "producto_id": producto.id,
        "producto_descripcion": format_descripcion_producto(
            producto.descripcion, producto.descripcion_extra
        ),
        "codigo_barra": producto.codigo_barra or "",
        "estado": _estado_historico_producto_orden(orden),
        "fecha_bloqueo": fecha_bloqueo.isoformat(),
        "observaciones": None,
        "requiere_modista": False,
        "notas_modista": "",
        "es_historico": True,
    }
    if incluir_detalle:
        base.update(
            {
                "linea": producto.linea.nombre if producto.linea else "",
                "talle": producto.talle.nombre if producto.talle else "",
                "tela": producto.tela.nombre if producto.tela else "",
                "color": producto.color.nombre if producto.color else "",
                "descripcion_extra": producto.descripcion_extra or "",
            }
        )
    return base


def _productos_de_orden_para_api(
    orden: OrdenTrabajo, incluir_detalle: bool = True
) -> list:
    """Productos activos reservados o, si ya se devolvieron, ítems del presupuesto."""
    reservados = list(orden.productos_reservados)
    if reservados:
        return [
            _producto_reservado_a_dict(pr, incluir_detalle=incluir_detalle)
            for pr in reservados
        ]
    presupuesto = orden.presupuesto
    if not presupuesto:
        return []
    return [
        _item_presupuesto_a_producto_orden_dict(
            item, orden, incluir_detalle=incluir_detalle
        )
        for item in presupuesto.items
    ]


def _nombre_cliente_para_recibo(orden: OrdenTrabajo) -> str:
    p = orden.presupuesto
    if getattr(p, "precliente", None):
        pc = p.precliente
        return f"{pc.apellido} {pc.nombre}".strip()
    c = getattr(p, "cliente", None)
    if c:
        return f"{c.apellido} {c.nombre}".strip()
    return "Cliente"


class OrdenTrabajoServices:
    def __init__(self):
        pass

    def crear_orden_trabajo(
        self,
        presupuesto_id: int,
        seña_pagada: float,
        payment_method: str,
        usuario_id: int,
        cuenta_destino_id: Optional[int] = None,
        metodo_pago_id: Optional[int] = None,
        submetodo_pago_id: Optional[int] = None,
        credito_aplicado: float = 0,
        conjunto_separado: bool = False,
    ) -> dict:
        with db_session:
            try:
                from src.models import Usuario, CuentaDestino
                from src.services.pagos_services import PagosServices

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                sucursal = usuario.sucursal

                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="El presupuesto ya tiene una orden de trabajo")

                credito_aplicado = float(credito_aplicado or 0)
                seña_total = float(seña_pagada)
                monto_efectivo = seña_total - credito_aplicado

                if credito_aplicado > seña_total + 1e-9:
                    raise HTTPException(
                        status_code=400,
                        detail="El crédito aplicado no puede superar el monto de la seña",
                    )

                if credito_aplicado > 1e-9 and not presupuesto.cliente:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede aplicar saldo a favor en presupuestos de precliente",
                    )

                metodo_pago_configurable = None
                submetodo_pago = None
                payment_method_str = payment_method or "EFECTIVO"
                payment_method_enum = None

                if monto_efectivo > 1e-9:
                    if not cuenta_destino_id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino es obligatoria cuando hay importe en caja",
                        )
                    cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                    if not cuenta_destino:
                        raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                    if cuenta_destino.sucursal.id != sucursal.id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino debe pertenecer a la sucursal",
                        )
                    if not cuenta_destino.activa:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino seleccionada está inactiva",
                        )
                else:
                    cuenta_destino = None

                if monto_efectivo > 1e-9:
                    if metodo_pago_id:
                        from src.services.metodos_pago_services import MetodosPagoServices

                        metodos_pago_service = MetodosPagoServices()
                        metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                            metodo_pago_id,
                            submetodo_pago_id,
                            sucursal.id,
                        )
                        payment_method_str = metodo_pago_configurable.nombre
                        if submetodo_pago:
                            payment_method_str = f"{metodo_pago_configurable.nombre} - {submetodo_pago.nombre}"
                    elif payment_method:
                        if payment_method not in [mp.value for mp in MetodoPago]:
                            metodos_validos = [mp.value for mp in MetodoPago]
                            raise HTTPException(
                                status_code=400,
                                detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}",
                            )
                        payment_method_enum = MetodoPago(payment_method)
                        payment_method_str = payment_method
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Debe indicar método de pago cuando hay importe en caja",
                        )
                elif credito_aplicado > 1e-9:
                    payment_method_str = "Saldo a favor (cuenta corriente)"

                total = presupuesto.total
                saldo_pendiente = max(0.0, float(total) - seña_total)
                estado_inicial = (
                    "Pagada" if saldo_pendiente <= 0 else "En proceso"
                )

                # Asegurar que la fecha_evento se copie exactamente sin conversiones
                # La fecha_evento del presupuesto ya es un objeto date, copiarlo directamente
                fecha_evento_orden = presupuesto.fecha_evento
                
                # Debug: verificar la fecha antes de guardar
                print(f"🔍 DEBUG - Presupuesto fecha_evento: {presupuesto.fecha_evento} (tipo: {type(presupuesto.fecha_evento)})")
                print(f"🔍 DEBUG - Orden fecha_evento a guardar: {fecha_evento_orden} (tipo: {type(fecha_evento_orden)})")

                orden = OrdenTrabajo(
                    presupuesto=presupuesto,
                    fecha_evento=fecha_evento_orden,
                    seña_pagada=seña_total,
                    saldo_pendiente=saldo_pendiente,
                    metodo_pago=payment_method_str,  # Para compatibilidad
                    metodo_pago_configurable=metodo_pago_configurable,  # Nueva relación
                    submetodo_pago=submetodo_pago,  # Nueva relación
                    estado=estado_inicial,
                    # Copiar campos de descuento extra del presupuesto
                    extra_discount_percentage=presupuesto.extra_discount_percentage,
                    extra_discount_amount=presupuesto.extra_discount_amount,
                    extra_discount_reason=presupuesto.extra_discount_reason,
                    extra_discount_applied_by=presupuesto.extra_discount_applied_by,
                    extra_discount_created_at=presupuesto.extra_discount_created_at,
                    conjunto_separado=bool(conjunto_separado),
                )
                flush()

                pagos = PagosServices()
                cliente = presupuesto.cliente
                # Solo movimientos CC al usar saldo a favor (débito). La seña en caja no suma crédito.
                if cliente and credito_aplicado > 1e-9:
                    pagos.append_movimiento_cuenta_corriente(
                        cliente,
                        "debito",
                        credito_aplicado,
                        f"Uso saldo a favor — Seña presupuesto {presupuesto.numero}",
                        orden.id,
                        None,
                        None,
                    )

                if monto_efectivo > 1e-9 and cuenta_destino is not None:
                    movimiento = CajaMovimiento(
                        fecha_hora=datetime.now(),
                        tipo="INGRESO",
                        monto=monto_efectivo,
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

                reconstruir_productos_reservados_para_orden(orden, presupuesto)
                
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
                # Evitar bug de Pony ORM en Python 3.14 con order_by(desc(...)).
                ordenes = list(OrdenTrabajo.select())
                ordenes.sort(key=lambda o: o.id, reverse=True)
                
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
                        "cliente_celular": (
                            o.presupuesto.precliente.celular
                            if o.presupuesto.precliente
                            else (o.presupuesto.cliente.celular if o.presupuesto.cliente else None)
                        ),
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
                        "productos_reservados": _productos_de_orden_para_api(o),
                        # Campos de descuento extra (de la orden o del presupuesto)
                        "extra_discount_percentage": descuento_percentage,
                        "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                        "extra_discount_reason": descuento_reason,
                        "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                        "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                        "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
                        "contrato_generado_at": o.contrato_generado_at.isoformat() if o.contrato_generado_at else None,
                        "etiquetas_armado_impresas_at": (
                            o.etiquetas_armado_impresas_at.isoformat()
                            if getattr(o, "etiquetas_armado_impresas_at", None)
                            else None
                        ),
                        "conjunto_separado": bool(
                            getattr(o, "conjunto_separado", False)
                        ),
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
                    "productos_reservados": _productos_de_orden_para_api(
                        orden, incluir_detalle=False
                    ),
                    # Campos de descuento extra (de la orden o del presupuesto)
                    "extra_discount_percentage": descuento_percentage,
                    "extra_discount_amount": float(descuento_amount) if descuento_amount else None,
                    "extra_discount_reason": descuento_reason,
                    "extra_discount_applied_by_id": descuento_applied_by.id if descuento_applied_by else None,
                    "extra_discount_applied_by_nombre": f"{descuento_applied_by.nombre} {descuento_applied_by.apellido}" if descuento_applied_by else None,
                    "extra_discount_created_at": descuento_created_at.isoformat() if descuento_created_at else None,
                    "contrato_generado_at": orden.contrato_generado_at.isoformat() if orden.contrato_generado_at else None,
                    "etiquetas_armado_impresas_at": (
                        orden.etiquetas_armado_impresas_at.isoformat()
                        if getattr(orden, "etiquetas_armado_impresas_at", None)
                        else None
                    ),
                    "conjunto_separado": bool(
                        getattr(orden, "conjunto_separado", False)
                    ),
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

    def registrar_pago_saldo(
        self,
        orden_id: int,
        monto_pagado: float,
        payment_method: str,
        usuario_id: int,
        cuenta_destino_id: Optional[int] = None,
        metodo_pago_id: Optional[int] = None,
        submetodo_pago_id: Optional[int] = None,
        motivo_recibo: Optional[str] = None,
        credito_aplicado: float = 0,
    ) -> dict:
        """Registrar un pago del saldo pendiente; opcionalmente aplica saldo a favor (cuenta corriente)."""
        with db_session:
            try:
                from src.models import Usuario, CuentaDestino
                from src.services.pagos_services import PagosServices

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                sucursal = usuario.sucursal

                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                if orden.saldo_pendiente <= 0:
                    raise HTTPException(status_code=400, detail="La orden no tiene saldo pendiente")

                monto_total = float(monto_pagado)
                credito_aplicado = float(credito_aplicado or 0)
                monto_efectivo = monto_total - credito_aplicado

                if monto_total > orden.saldo_pendiente + 1e-9:
                    raise HTTPException(status_code=400, detail="El monto pagado excede el saldo pendiente")

                if credito_aplicado > monto_total + 1e-9:
                    raise HTTPException(
                        status_code=400,
                        detail="El crédito aplicado no puede superar el monto total del pago",
                    )

                if credito_aplicado > 1e-9 and not orden.presupuesto.cliente:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede aplicar saldo a favor en órdenes de precliente",
                    )

                metodo_pago_configurable = None
                submetodo_pago = None
                payment_method_str = payment_method or "EFECTIVO"
                payment_method_enum = None

                if monto_efectivo > 1e-9:
                    if metodo_pago_id:
                        from src.services.metodos_pago_services import MetodosPagoServices

                        metodos_pago_service = MetodosPagoServices()
                        metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                            metodo_pago_id,
                            submetodo_pago_id,
                            sucursal.id,
                        )
                        payment_method_str = metodo_pago_configurable.nombre
                        if submetodo_pago:
                            payment_method_str = f"{metodo_pago_configurable.nombre} - {submetodo_pago.nombre}"
                    elif payment_method:
                        if payment_method not in [mp.value for mp in MetodoPago]:
                            metodos_validos = [mp.value for mp in MetodoPago]
                            raise HTTPException(
                                status_code=400,
                                detail=f"Método de pago inválido. Métodos válidos: {', '.join(metodos_validos)}",
                            )
                        payment_method_enum = MetodoPago(payment_method)
                        payment_method_str = payment_method
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Debe indicar método de pago cuando hay importe en caja",
                        )

                    if not cuenta_destino_id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino es obligatoria cuando hay importe en caja",
                        )
                    cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                    if not cuenta_destino:
                        raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                    if cuenta_destino.sucursal.id != sucursal.id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino debe pertenecer a la sucursal",
                        )
                    if not cuenta_destino.activa:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino seleccionada está inactiva",
                        )
                else:
                    cuenta_destino = None

                pagos = PagosServices()
                cliente = orden.presupuesto.cliente
                # Solo débito en CC si se usa saldo a favor; el efectivo va solo a caja.
                if cliente and credito_aplicado > 1e-9:
                    pagos.append_movimiento_cuenta_corriente(
                        cliente,
                        "debito",
                        credito_aplicado,
                        f"Uso saldo a favor — Pago orden {orden.presupuesto.numero}",
                        orden.id,
                        None,
                        None,
                    )

                saldo_pendiente_anterior = orden.saldo_pendiente
                nuevo_saldo_pendiente = orden.saldo_pendiente - monto_total
                orden.saldo_pendiente = nuevo_saldo_pendiente

                movimiento_caja = None
                if monto_efectivo > 1e-9 and cuenta_destino is not None:
                    movimiento_caja = CajaMovimiento(
                        fecha_hora=datetime.now(),
                        tipo="INGRESO",
                        monto=monto_efectivo,
                        payment_method=payment_method_enum,
                        metodo_pago_configurable=metodo_pago_configurable,
                        submetodo_pago=submetodo_pago,
                        origen=f"PAGO_ADICIONAL_ORDEN:{orden.presupuesto.numero}",
                        categoria="PAGOS_ADICIONALES",
                        venta=None,
                        usuario=usuario,
                        sucursal=sucursal,
                        cuenta_destino=cuenta_destino,
                    )
                    flush()

                cliente_nombre_recibo = (
                    f"{orden.presupuesto.precliente.apellido} {orden.presupuesto.precliente.nombre}".strip()
                    if orden.presupuesto.precliente
                    else f"{orden.presupuesto.cliente.apellido} {orden.presupuesto.cliente.nombre}".strip()
                )
                motivo = (motivo_recibo or "Pago").strip() or "Pago"
                if credito_aplicado > 1e-9:
                    cc_txt = f"${int(round(credito_aplicado)):,}".replace(",", ".")
                    motivo = f"{motivo} — {cc_txt} con cuenta corriente"
                recibo = ReciboOrden(
                    orden_trabajo=orden,
                    fecha_hora=datetime.now(),
                    monto=monto_total,
                    motivo=motivo,
                    cliente_nombre=cliente_nombre_recibo,
                    presupuesto_numero=orden.presupuesto.numero,
                    movimiento_caja_id=movimiento_caja.id if movimiento_caja else None,
                )
                flush()

                if nuevo_saldo_pendiente == 0:
                    orden.estado = "Pagada"

                return {
                    "message": "Pago registrado exitosamente",
                    "success": True,
                    "data": {
                        "id": orden.id,
                        "presupuesto_numero": orden.presupuesto.numero,
                        "monto_pagado": monto_total,
                        "credito_aplicado": credito_aplicado,
                        "monto_caja": max(monto_efectivo, 0),
                        "saldo_pendiente_anterior": saldo_pendiente_anterior,
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
                        },
                    },
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al registrar pago: {str(e)}")

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
                        if _origen_caja_liga_presupuesto_o_orden(
                            getattr(cm, "origen", None), presupuesto_numero, orden.id
                        ):
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

                cliente_nombre_hist = _nombre_cliente_para_recibo(orden)
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
                        o = str(mov.origen or "")
                        if o.startswith(f"SEÑA_PRESUPUESTO:{presupuesto_numero}"):
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

                    # Seña pagada en parte con saldo: el débito en CC no aparece en caja
                    cc_debit_sena = sum(
                        float(m.monto)
                        for m in movimientos_cuenta
                        if getattr(m, "tipo", "") == "debito"
                        and float(m.monto) > 0
                        and "seña presupuesto" in (m.concepto or "").lower()
                    )
                    if cc_debit_sena > 1e-6:
                        base = (metodo_pago_display or "").lower()
                        if "saldo a favor" not in base and "cuenta corriente" not in base:
                            monto_cc_txt = f"${int(round(cc_debit_sena)):,}".replace(",", ".")
                            metodo_pago_display = (
                                f"{metodo_pago_display} — {monto_cc_txt} con cuenta corriente"
                            )

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
                        # Solo pagos adicionales explícitos (no seña ni otros textos que mencionen el presupuesto)
                        if (
                            origen_str.startswith(f"PAGO_ADICIONAL_ORDEN:{presupuesto_numero}")
                            or origen_str.startswith(f"PAGO_ADICIONAL:{orden.id}")
                        ):
                            
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
                
                # Débitos CC = uso de saldo a favor para pagar la orden (no pasan por caja)
                print(f"📊 Total movimientos de cuenta corriente encontrados: {len(movimientos_cuenta)}")
                for movimiento_cc in movimientos_cuenta:
                    try:
                        if movimiento_cc.tipo == "debito" and float(movimiento_cc.monto) > 0:
                            concepto_low = (movimiento_cc.concepto or "").lower()
                            if "seña presupuesto" in concepto_low:
                                continue
                            fecha_cc = movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else ""
                            clave_debito = ("debito_cc", float(movimiento_cc.monto), fecha_cc, movimiento_cc.id)
                            if clave_debito in pagos_agregados:
                                continue
                            pagos_agregados.add(clave_debito)
                            monto_cc = float(movimiento_cc.monto)
                            monto_txt = f"${int(round(monto_cc)):,}".replace(",", ".")
                            historial["pagos"].append({
                                "tipo": "Pago adicional",
                                "fecha": movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else None,
                                "fecha_hora": movimiento_cc.fecha.isoformat() if movimiento_cc.fecha else None,
                                "monto": monto_cc,
                                "metodo_pago": f"{monto_txt} con cuenta corriente",
                                "origen": movimiento_cc.concepto or "Uso saldo a favor",
                                "usuario_nombre": "N/A",
                                "sucursal_nombre": "N/A",
                                "cuenta_destino_nombre": "—",
                                "movimiento_id": movimiento_cc.id,
                            })
                            continue
                    except Exception as e:
                        print(f"⚠️ Error al procesar débito CC {getattr(movimiento_cc, 'id', '?')}: {e}")
                        import traceback

                        traceback.print_exc()
                        continue

                # No listar créditos CC con referencia_orden: duplican el ingreso en caja (espejo contable del efectivo).

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
                cliente_nombre = _nombre_cliente_para_recibo(orden)
                recibos = []
                if orden.seña_pagada > 0:
                    motivo_sena = "Seña"
                    # Un solo predicado en el lambda (Pony + Py3.13: `and` en select → DecompileError TO_BOOL).
                    cc_movs_orden = list(
                        CuentaCorriente.select(lambda cc: cc.referencia_orden == orden.id)
                    )
                    cc_debit_sena_rec = sum(
                        float(m.monto)
                        for m in cc_movs_orden
                        if m.tipo == "debito" and "seña presupuesto" in (m.concepto or "").lower()
                    )
                    if cc_debit_sena_rec > 1e-6:
                        cc_txt = f"${int(round(cc_debit_sena_rec)):,}".replace(",", ".")
                        motivo_sena = f"Seña — {cc_txt} con cuenta corriente"
                    recibos.append({
                        "id": None,
                        "orden_id": orden.id,
                        "tipo": "Seña inicial",
                        "fecha_hora": orden.fecha_creacion.isoformat() if orden.fecha_creacion else None,
                        "monto": orden.seña_pagada,
                        "motivo": motivo_sena,
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

    def registrar_etiquetas_armado_impresas(self, orden_id: int) -> dict:
        """Marca que las etiquetas 100x50 de armado ya se imprimieron al crear la orden."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(
                        status_code=404, detail="Orden de trabajo no encontrada"
                    )
                if orden.estado and orden.estado.lower() == "cancelada":
                    raise HTTPException(
                        status_code=400,
                        detail="No se pueden registrar etiquetas en una orden cancelada",
                    )
                orden.etiquetas_armado_impresas_at = datetime.now()
                flush()
                return {
                    "message": "Etiquetas de armado registradas correctamente",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "etiquetas_armado_impresas_at": orden.etiquetas_armado_impresas_at.isoformat(),
                    },
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al registrar etiquetas de armado: {str(e)}",
                )

    def actualizar_modista_producto_reservado(
        self,
        orden_id: int,
        producto_id: int,
        requiere_modista: bool,
        notas_modista: Optional[str] = None,
    ) -> dict:
        """Marca o desmarca una prenda de la orden como pendiente de modista y guarda el detalle."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(
                        status_code=404, detail="Orden de trabajo no encontrada"
                    )
                if orden.estado and orden.estado.lower() == "cancelada":
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede editar una orden cancelada",
                    )

                pr = ProductoReservado.get(
                    lambda p: p.orden_trabajo.id == orden_id
                    and p.producto.id == producto_id
                )
                if not pr:
                    raise HTTPException(
                        status_code=404,
                        detail="Producto no encontrado en esta orden",
                    )

                pr.requiere_modista = bool(requiere_modista)
                if pr.requiere_modista:
                    notas = (notas_modista or "").strip()
                    if not notas:
                        raise HTTPException(
                            status_code=400,
                            detail="Indicá qué debe hacerse en modista",
                        )
                    pr.notas_modista = notas
                else:
                    pr.notas_modista = None

                flush()
                return {
                    "message": "Indicación de modista actualizada",
                    "success": True,
                    "data": _producto_reservado_a_dict(pr, incluir_detalle=False),
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al actualizar modista del producto: {str(e)}",
                )

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
                # Evitar bug de Pony ORM en Python 3.14 con order_by(desc(...)).
                todas = list(OrdenTrabajo.select())
                todas.sort(key=lambda o: o.id, reverse=True)
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
                        productos_reservados = [
                            {
                                "producto_id": p["producto_id"],
                                "producto_descripcion": p["producto_descripcion"],
                            }
                            for p in _productos_de_orden_para_api(
                                o, incluir_detalle=False
                            )
                        ]
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
        destino: Optional[str] = None,
        lavanderia_id: Optional[int] = None,
        modista_id: Optional[int] = None,
        envios: Optional[List[Any]] = None,
    ) -> dict:
        """Completar la devolución. Modo legacy: un destino para todos los productos.
        Modo envíos: varios lotes (remitos) con destino/lavandería/modista por lote;
        los productos no listados en ningún envío permanecen en la orden."""
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

                productos_en_orden = {pr.producto.id: pr for pr in orden.productos_reservados}
                if not productos_en_orden:
                    raise HTTPException(
                        status_code=400,
                        detail="La orden no tiene productos reservados para devolver",
                    )

                cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
                remitos_out: List[dict] = []
                stamp = datetime.now().strftime("%Y%m%d%H%M%S")

                batches: List[tuple] = []
                if envios:
                    for e in envios:
                        if hasattr(e, "model_dump"):
                            raw = e.model_dump()
                        elif isinstance(e, dict):
                            raw = e
                        else:
                            raw = {
                                "destino": getattr(e, "destino", None),
                                "lavanderia_id": getattr(e, "lavanderia_id", None),
                                "modista_id": getattr(e, "modista_id", None),
                                "productos_ids": getattr(e, "productos_ids", None),
                            }
                        d = raw.get("destino")
                        lav = raw.get("lavanderia_id")
                        mod = raw.get("modista_id")
                        pids = raw.get("productos_ids")
                        if not pids:
                            raise HTTPException(
                                status_code=400,
                                detail="Cada envío debe incluir productos_ids",
                            )
                        batches.append((list(pids), str(d), lav, mod))
                else:
                    if not destino:
                        raise HTTPException(
                            status_code=400, detail="Debe indicar destino o envíos"
                        )
                    batches.append(
                        (
                            list(productos_en_orden.keys()),
                            destino,
                            lavanderia_id,
                            modista_id,
                        )
                    )

                asignados: set = set()
                for batch_idx, (pids, d_dest, d_lav, d_mod) in enumerate(batches):
                    if len(pids) != len(set(pids)):
                        raise HTTPException(
                            status_code=400,
                            detail="Hay productos duplicados dentro del mismo envío",
                        )
                    dup = asignados.intersection(pids)
                    if dup:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Producto(s) repetidos en más de un envío: {sorted(dup)}",
                        )
                    invalid = [pid for pid in pids if pid not in productos_en_orden]
                    if invalid:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Productos que no pertenecen a la orden: {invalid}",
                        )
                    asignados.update(pids)

                    a_procesar = [productos_en_orden[pid] for pid in pids]
                    num_remito = f"REM-{orden.id}-{stamp}-{batch_idx + 1}"
                    desc = f"Devolución orden #{orden.id} — remito {num_remito}"
                    self._aplicar_destino_productos(
                        a_procesar,
                        d_dest,
                        d_lav,
                        d_mod,
                        descripcion=desc,
                        cliente_nombre=cliente_nombre,
                        cliente_celular=cliente_celular,
                    )
                    lav_nombre = None
                    mod_nombre = None
                    if d_dest == "LAVANDERIA" and d_lav:
                        lav = Lavanderia.get(id=d_lav)
                        lav_nombre = lav.nombre if lav else None
                    if d_dest == "MODISTA" and d_mod:
                        mod = Modista.get(id=d_mod)
                        mod_nombre = mod.nombre if mod else None

                    lineas_prod = []
                    for pr in a_procesar:
                        prod = pr.producto
                        lineas_prod.append(
                            {
                                "producto_id": prod.id,
                                "descripcion": prod.descripcion or "",
                                "codigo_barra": prod.codigo_barra or "",
                            }
                        )

                    remitos_out.append(
                        {
                            "numero": num_remito,
                            "destino": d_dest,
                            "lavanderia_id": d_lav,
                            "lavanderia_nombre": lav_nombre,
                            "modista_id": d_mod,
                            "modista_nombre": mod_nombre,
                            "productos": lineas_prod,
                            "cantidad": len(lineas_prod),
                        }
                    )

                    for pr in a_procesar:
                        observaciones_previas = pr.observaciones or ""
                        nueva_obs = f"[Devolución {num_remito} - {datetime.now().strftime('%d/%m/%Y %H:%M')}]"
                        pr.observaciones = (
                            f"{observaciones_previas}\n{nueva_obs}".strip()
                            if observaciones_previas
                            else nueva_obs
                        )
                        pid_del = pr.producto.id
                        pr.delete()
                        productos_en_orden.pop(pid_del, None)

                restantes = len(productos_en_orden)
                if restantes == 0:
                    orden.estado = "Completada"
                flush()

                msg_base = (
                    f"Devolución registrada: {len(remitos_out)} remito(s)."
                    if remitos_out
                    else "Devolución registrada."
                )
                if restantes > 0:
                    msg_base += f" Quedan {restantes} prenda(s) en la orden (no incluidas en envíos)."

                return {
                    "message": msg_base,
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "estado": orden.estado,
                        "productos_procesados": len(asignados),
                        "productos_restantes_orden": restantes,
                        "remitos": remitos_out,
                        "orden_completada": restantes == 0,
                    },
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


