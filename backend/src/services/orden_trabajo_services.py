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
    Roles,
    TipoMovimiento,
    Usuario,
    AccionAuditoria,
    RevisionDevolucion,
    EstadoRevisionDevolucion,
)
from datetime import datetime, timedelta
from src.fechas_ar import ahora_ar, hoy_ar, isoformat_ar
from src.money import round_pesos
from typing import List, Optional, Any
import logging

from src.descripcion_producto import format_descripcion_producto
from src.presupuesto_titular import titular_presupuesto
from src.services.disponibilidad_services import reconstruir_productos_reservados_para_orden
from src.services.auditoria_services import nombre_usuario, registrar_auditoria

logger = logging.getLogger(__name__)

# Prefijo en notas de taller para prendas con revisión pendiente (devolución parcial).
from src.revision_devolucion import PREFIJO_REVISION_NOTA


def _revisiones_abiertas_orden(orden) -> list:
    return [
        r
        for r in list(getattr(orden, "revisiones_devolucion", []) or [])
        if (r.estado or "") == EstadoRevisionDevolucion.ABIERTA.value
    ]


def _revisiones_abiertas_para_api(orden) -> list:
    out = []
    for r in _revisiones_abiertas_orden(orden):
        prod = r.producto
        out.append(
            {
                "id": r.id,
                "producto_id": prod.id if prod else None,
                "producto_descripcion": (
                    format_descripcion_producto(prod.descripcion, prod.descripcion_extra)
                    if prod
                    else ""
                ),
                "motivo": r.motivo or "",
                "destino": r.destino or "",
                "creada_at": isoformat_ar(r.creada_at),
            }
        )
    return out


def _campos_trazabilidad_orden(o) -> dict:
    revisiones = _revisiones_abiertas_para_api(o)
    return {
        "creado_por_id": o.creado_por.id if getattr(o, "creado_por", None) else None,
        "creado_por_nombre": nombre_usuario(getattr(o, "creado_por", None)),
        "contrato_generado_por_id": o.contrato_generado_por.id if getattr(o, "contrato_generado_por", None) else None,
        "contrato_generado_por_nombre": nombre_usuario(getattr(o, "contrato_generado_por", None)),
        "devolucion_recibida_por_id": o.devolucion_recibida_por.id if getattr(o, "devolucion_recibida_por", None) else None,
        "devolucion_recibida_por_nombre": nombre_usuario(getattr(o, "devolucion_recibida_por", None)),
        "devolucion_recibida_at": isoformat_ar(getattr(o, "devolucion_recibida_at", None)),
        "revisiones_abiertas": revisiones,
        "tiene_revisiones_abiertas": len(revisiones) > 0,
    }


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
    tit = titular_presupuesto(orden.presupuesto)
    nombre = (tit.get("cliente_nombre") or "").strip()
    return nombre if nombre and nombre != "Sin titular asignado" else "Cliente"


def _campos_titular_presupuesto(presupuesto) -> dict:
    tit = titular_presupuesto(presupuesto)
    return {
        "cliente_nombre": tit["cliente_nombre"],
        "es_precliente": tit["es_precliente"],
        "precliente_id": tit["precliente_id"],
        "cliente_id": tit["cliente_id"],
        "cliente_dni": tit["cliente_dni"],
        "cliente_direccion": tit["cliente_direccion"],
        "cliente_celular": tit["cliente_celular"],
        "titular_huerfano": tit["titular_huerfano"],
    }


def _campos_firmante_orden(orden) -> dict:
    nombre = (getattr(orden, "firmante_nombre", None) or "").strip() or None
    dni = (getattr(orden, "firmante_dni", None) or "").strip() or None
    direccion = (getattr(orden, "firmante_direccion", None) or "").strip() or None
    celular = (getattr(orden, "firmante_celular", None) or "").strip() or None
    return {
        "firmante_nombre": nombre,
        "firmante_dni": dni,
        "firmante_direccion": direccion,
        "firmante_celular": celular,
        "tiene_firmante_anexo": bool(nombre),
    }


def _aplicar_firmante_orden(orden, firmante) -> None:
    """Persiste o limpia el snapshot del firmante anexado (no crea Cliente).

    Pony Optional(str) no acepta None al asignar: se usa "" para limpiar.
    """
    if firmante is None:
        orden.firmante_nombre = ""
        orden.firmante_dni = ""
        orden.firmante_direccion = ""
        orden.firmante_celular = ""
        return
    nombre = (getattr(firmante, "nombre", None) or "").strip()
    dni = (getattr(firmante, "dni", None) or "").strip()
    direccion = (getattr(firmante, "direccion", None) or "").strip()
    celular = (getattr(firmante, "celular", None) or "").strip()
    if not nombre or not dni or not direccion:
        raise HTTPException(
            status_code=400,
            detail="El firmante anexado requiere nombre, DNI y domicilio.",
        )
    orden.firmante_nombre = nombre
    orden.firmante_dni = dni
    orden.firmante_direccion = direccion
    orden.firmante_celular = celular


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

                credito_aplicado = round_pesos(credito_aplicado or 0)
                seña_total = round_pesos(seña_pagada)
                monto_efectivo = round_pesos(max(seña_total - credito_aplicado, 0))

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

                total = round_pesos(presupuesto.total)
                saldo_pendiente = max(0, round_pesos(total - seña_total))
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
                    creado_por=usuario,
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
                        usuario=usuario,
                    )

                if monto_efectivo > 1e-9 and cuenta_destino is not None:
                    movimiento = CajaMovimiento(
                        fecha_hora=ahora_ar(),
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

                if seña_total > 1e-9:
                    ReciboOrden(
                        orden_trabajo=orden,
                        fecha_hora=ahora_ar(),
                        monto=seña_total,
                        motivo="Seña",
                        cliente_nombre=_nombre_cliente_para_recibo(orden),
                        presupuesto_numero=presupuesto.numero,
                        movimiento_caja_id=None,
                        usuario=usuario,
                    )
                    flush()

                reconstruir_productos_reservados_para_orden(orden, presupuesto)
                
                presupuesto.estado = "Aprobado"

                registrar_auditoria(
                    usuario,
                    AccionAuditoria.ORDEN_CREADA,
                    "orden",
                    orden.id,
                    f"Orden #{orden.id} creada (presupuesto {presupuesto.numero})",
                    {"presupuesto_numero": presupuesto.numero, "seña": seña_total},
                )
                if seña_total > 1e-9:
                    registrar_auditoria(
                        usuario,
                        AccionAuditoria.COBRO,
                        "orden",
                        orden.id,
                        f"Cobro seña ${seña_total:.2f} — orden #{orden.id}",
                        {"monto": seña_total, "tipo": "seña"},
                    )
                
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
                                       else (orden.metodo_pago_configurable.nombre if orden.metodo_pago_configurable else orden.metodo_pago)),
                        "creado_por_id": usuario.id,
                        "creado_por_nombre": nombre_usuario(usuario),
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
                    total_orden = round_pesos(o.seña_pagada + o.saldo_pendiente)
                    titular = _campos_titular_presupuesto(presupuesto)
                    
                    resultado.append({
                        "id": o.id,
                        "presupuesto_id": o.presupuesto.id,
                        "presupuesto_numero": o.presupuesto.numero,
                        **titular,
                        "fecha_evento": o.fecha_evento.isoformat(),
                        "fecha_creacion": isoformat_ar(o.fecha_creacion) if o.fecha_creacion else "",
                        "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else None,
                        "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else None,
                        "seña_pagada": round_pesos(o.seña_pagada),
                        "saldo_pendiente": round_pesos(o.saldo_pendiente),
                        "total": total_orden,  # Total de la orden (con descuento si aplica)
                        "total_presupuesto": round_pesos(o.presupuesto.total),  # Total del presupuesto (con descuento si aplica)
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
                        "extra_discount_created_at": isoformat_ar(descuento_created_at),
                        "contrato_generado_at": isoformat_ar(o.contrato_generado_at),
                        "etiquetas_armado_impresas_at": (
                        isoformat_ar(o.etiquetas_armado_impresas_at)
                            if getattr(o, "etiquetas_armado_impresas_at", None)
                            else None
                        ),
                        "conjunto_separado": bool(
                            getattr(o, "conjunto_separado", False)
                        ),
                        **_campos_firmante_orden(o),
                        **_campos_trazabilidad_orden(o),
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
                titular = _campos_titular_presupuesto(presupuesto)
                
                return {
                    "id": orden.id,
                    "presupuesto_id": orden.presupuesto.id,
                    "presupuesto_numero": orden.presupuesto.numero,
                    **titular,
                    "fecha_evento": orden.fecha_evento.isoformat(),
                    "fecha_creacion": isoformat_ar(orden.fecha_creacion) if orden.fecha_creacion else "",
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
                    "extra_discount_created_at": isoformat_ar(descuento_created_at),
                    "contrato_generado_at": isoformat_ar(orden.contrato_generado_at),
                    "etiquetas_armado_impresas_at": (
                        isoformat_ar(orden.etiquetas_armado_impresas_at)
                        if getattr(orden, "etiquetas_armado_impresas_at", None)
                        else None
                    ),
                    "conjunto_separado": bool(
                        getattr(orden, "conjunto_separado", False)
                    ),
                    **_campos_firmante_orden(orden),
                    **_campos_trazabilidad_orden(orden),
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
                        **_campos_titular_presupuesto(o.presupuesto),
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

                monto_total = round_pesos(monto_pagado)
                credito_aplicado = round_pesos(credito_aplicado or 0)
                monto_efectivo = round_pesos(max(monto_total - credito_aplicado, 0))

                if monto_total > round_pesos(orden.saldo_pendiente) + 1e-9:
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
                        usuario=usuario,
                    )

                saldo_pendiente_anterior = round_pesos(orden.saldo_pendiente)
                # Mantener seña_pagada alineada con pagos_services (total abonado).
                orden.seña_pagada = round_pesos(orden.seña_pagada + monto_total)
                total_presupuesto = round_pesos(orden.presupuesto.total)
                nuevo_saldo_pendiente = max(0, round_pesos(total_presupuesto - orden.seña_pagada))
                # No subir el saldo por drift de float; el pago no puede dejar más pendiente.
                if nuevo_saldo_pendiente > saldo_pendiente_anterior:
                    nuevo_saldo_pendiente = max(
                        0, round_pesos(saldo_pendiente_anterior - monto_total)
                    )
                orden.saldo_pendiente = nuevo_saldo_pendiente

                movimiento_caja = None
                if monto_efectivo > 1e-9 and cuenta_destino is not None:
                    movimiento_caja = CajaMovimiento(
                        fecha_hora=ahora_ar(),
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

                cliente_nombre_recibo = _nombre_cliente_para_recibo(orden)
                motivo = (motivo_recibo or "Pago").strip() or "Pago"
                if credito_aplicado > 1e-9:
                    cc_txt = f"${int(round(credito_aplicado)):,}".replace(",", ".")
                    motivo = f"{motivo} — {cc_txt} con cuenta corriente"
                recibo = ReciboOrden(
                    orden_trabajo=orden,
                    fecha_hora=ahora_ar(),
                    monto=monto_total,
                    motivo=motivo,
                    cliente_nombre=cliente_nombre_recibo,
                    presupuesto_numero=orden.presupuesto.numero,
                    movimiento_caja_id=movimiento_caja.id if movimiento_caja else None,
                    usuario=usuario,
                )
                flush()

                if nuevo_saldo_pendiente == 0:
                    orden.estado = "Pagada"

                registrar_auditoria(
                    usuario,
                    AccionAuditoria.COBRO,
                    "orden",
                    orden.id,
                    f"Cobro ${monto_total:.2f} — orden #{orden.id}",
                    {"monto": monto_total, "tipo": "pago_saldo", "recibo_id": recibo.id},
                )

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
                            "fecha_hora": isoformat_ar(recibo.fecha_hora),
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

                    # Monto de seña inicial desde caja + CC (no usar seña_pagada actual:
                    # ese campo se incrementa con pagos adicionales).
                    monto_sena_inicial = 0.0
                    if seña_inicial_mov is not None:
                        monto_sena_inicial = round_pesos(seña_inicial_mov.monto)
                    if cc_debit_sena > 1e-6:
                        monto_sena_inicial = round_pesos(monto_sena_inicial + cc_debit_sena)
                    if monto_sena_inicial <= 0:
                        monto_sena_inicial = round_pesos(orden.seña_pagada)

                    historial["pagos"].append({
                        "tipo": "Seña inicial",
                        "fecha": isoformat_ar(orden.fecha_creacion),
                        "fecha_hora": isoformat_ar(orden.fecha_creacion),
                        "monto": monto_sena_inicial,
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
                                "fecha": isoformat_ar(movimiento.fecha_hora),
                                "fecha_hora": isoformat_ar(movimiento.fecha_hora),
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
                                "fecha": isoformat_ar(movimiento_cc.fecha),
                                "fecha_hora": isoformat_ar(movimiento_cc.fecha),
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
        """Listar historial de recibos de una orden (recibos reales; seña sintética solo si falta en DB)."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
                cliente_nombre = _nombre_cliente_para_recibo(orden)
                recibos = []
                recibos_reales = sorted(orden.recibos, key=lambda r: r.fecha_hora)
                # Al crear la orden ya se persiste ReciboOrden de seña; no inventar otro.
                # Solo sintetizar para órdenes viejas sin fila en RecibosOrden.
                tiene_recibo_sena = any(
                    "seña" in (r.motivo or "").lower() or "sena" in (r.motivo or "").lower()
                    for r in recibos_reales
                )
                if orden.seña_pagada > 0 and not tiene_recibo_sena:
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
                    # Monto de seña inicial desde caja + CC (no usar seña_pagada acumulada).
                    presupuesto_numero = orden.presupuesto.numero
                    monto_sena_inicial = 0.0
                    for cm in CajaMovimiento.select():
                        origen = str(getattr(cm, "origen", None) or "")
                        if origen.startswith(f"SEÑA_PRESUPUESTO:{presupuesto_numero}"):
                            monto_sena_inicial = round_pesos(cm.monto)
                            break
                    if cc_debit_sena_rec > 1e-6:
                        monto_sena_inicial = round_pesos(monto_sena_inicial + cc_debit_sena_rec)
                    if monto_sena_inicial <= 0:
                        monto_sena_inicial = round_pesos(orden.seña_pagada)
                    recibos.append({
                        "id": None,
                        "orden_id": orden.id,
                        "tipo": "Seña inicial",
                        "fecha_hora": isoformat_ar(orden.fecha_creacion),
                        "monto": monto_sena_inicial,
                        "motivo": motivo_sena,
                        "cliente_nombre": cliente_nombre,
                        "presupuesto_numero": orden.presupuesto.numero,
                    })
                for r in recibos_reales:
                    motivo = r.motivo or ""
                    es_sena = "seña" in motivo.lower() or "sena" in motivo.lower()
                    recibos.append({
                        "id": r.id,
                        "orden_id": orden.id,
                        "tipo": "Seña inicial" if es_sena else "Pago adicional",
                        "fecha_hora": isoformat_ar(r.fecha_hora),
                        "monto": r.monto,
                        "motivo": motivo,
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
                orden.etiquetas_armado_impresas_at = ahora_ar()
                flush()
                return {
                    "message": "Etiquetas de armado registradas correctamente",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "etiquetas_armado_impresas_at": isoformat_ar(orden.etiquetas_armado_impresas_at),
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

                pr = next(
                    (
                        p
                        for p in list(orden.productos_reservados)
                        if p.producto and p.producto.id == producto_id
                    ),
                    None,
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
                    pr.notas_modista = ""

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

    def enviar_producto_a_modista_desde_orden(
        self,
        orden_id: int,
        producto_id: int,
        modista_id: int,
        usuario_id: int,
    ) -> dict:
        """Envía una prenda marcada para modista creando el ingreso real (ProductoModista)."""
        with db_session:
            orden = OrdenTrabajo.get(id=orden_id)
            if not orden:
                raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
            if orden.estado and orden.estado.lower() in ("cancelada", "completada"):
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede enviar a modista una orden en estado '{orden.estado}'",
                )

            pr = next(
                (
                    p
                    for p in list(orden.productos_reservados)
                    if p.producto and p.producto.id == producto_id
                ),
                None,
            )
            if not pr:
                raise HTTPException(
                    status_code=404,
                    detail="Producto no encontrado en esta orden",
                )
            if not bool(getattr(pr, "requiere_modista", False)):
                raise HTTPException(
                    status_code=400,
                    detail="La prenda no está marcada para trabajo de modista",
                )
            notas = (pr.notas_modista or "").strip()
            if not notas:
                raise HTTPException(
                    status_code=400,
                    detail="Indicá qué debe hacerse en modista antes de enviar",
                )

            prod = pr.producto
            if prod.estado == EstadoProducto.MODISTA:
                abiertos = [
                    pm
                    for pm in list(prod.productos_modistas)
                    if pm.fecha_salida is None
                ]
                if abiertos:
                    raise HTTPException(
                        status_code=400,
                        detail="La prenda ya está enviada a modista",
                    )

            cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
            fecha_retiro = None
            presupuesto = orden.presupuesto
            if presupuesto and getattr(presupuesto, "fecha_retiro", None):
                fecha_retiro = presupuesto.fecha_retiro.strftime("%d/%m/%Y")

            notas_envio = notas
            if fecha_retiro:
                notas_envio = f"Retiro: {fecha_retiro} | {notas}"

            # Copiar valores fuera de la sesión antes de delegar
            payload = {
                "modista_id": modista_id,
                "producto_id": producto_id,
                "notas": notas_envio,
                "cliente_nombre": cliente_nombre,
                "cliente_celular": cliente_celular,
                "usuario_id": usuario_id,
                "fecha_retiro": fecha_retiro,
                "orden_id": orden_id,
            }

        from src.services.modista_services import ModistaServices

        result = ModistaServices().asignar_producto(
            modista_id=payload["modista_id"],
            producto_id=payload["producto_id"],
            notas=payload["notas"],
            cliente_nombre=payload["cliente_nombre"],
            cliente_celular=payload["cliente_celular"],
            usuario_id=payload["usuario_id"],
        )
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("message") or "No se pudo enviar a modista",
            )
        data = result.get("data") or {}
        return {
            "message": "Prenda enviada a modista",
            "success": True,
            "data": {
                **(data if isinstance(data, dict) else {}),
                "orden_id": payload["orden_id"],
                "producto_id": payload["producto_id"],
                "modista_id": payload["modista_id"],
                "notas_enviadas": payload["notas"],
                "cliente_nombre": payload["cliente_nombre"],
                "fecha_retiro": payload["fecha_retiro"],
            },
        }

    def registrar_contrato_generado(self, orden_id: int, usuario=None, firmante=None) -> dict:
        """Registrar que se generó el contrato para esta orden (cliente, DNI y dirección).

        Empleados: requieren saldo pendiente 0.
        ADMIN / SUPER_ADMIN: pueden generar aunque haya deuda.

        firmante: opcional. Si se envía, se guarda snapshot para el LOCATARIO/pagaré
        (quien retira). Si es None, se limpia y el impreso usa al titular.
        Si el contrato ya estaba generado, solo actualiza el firmante (reimpresión).
        """
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
                if orden.presupuesto.precliente is not None:
                    raise HTTPException(status_code=400, detail="Solo se puede generar contrato para órdenes de cliente (no precliente).")
                saldo = round_pesos(orden.saldo_pendiente or 0)
                if saldo > 0:
                    rol_str = self._rol_efectivo_usuario(usuario)
                    if rol_str not in (Roles.ADMIN.value, Roles.SUPER_ADMIN.value):
                        raise HTTPException(status_code=400, detail="El saldo pendiente debe ser cero para generar el contrato.")
                if not orden.presupuesto.cliente.dni or not orden.presupuesto.cliente.direccion:
                    raise HTTPException(status_code=400, detail="El cliente debe tener DNI y Dirección para generar el contrato.")

                _aplicar_firmante_orden(orden, firmante)
                firmante_payload = _campos_firmante_orden(orden)

                ya_generado = getattr(orden, "contrato_generado_at", None) is not None
                if ya_generado:
                    flush()
                    return {
                        "message": "Firmante del contrato actualizado",
                        "success": True,
                        "data": {
                            "orden_id": orden.id,
                            "contrato_generado_at": isoformat_ar(orden.contrato_generado_at),
                            "reimpresion": True,
                            **firmante_payload,
                        },
                    }

                usuario_db = None
                if usuario is not None:
                    uid = getattr(usuario, "id", None)
                    if uid is not None:
                        usuario_db = Usuario.get(id=int(uid))
                orden.contrato_generado_at = ahora_ar()
                if usuario_db:
                    orden.contrato_generado_por = usuario_db
                for pr in list(orden.productos_reservados):
                    prod = getattr(pr, "producto", None)
                    if prod:
                        prod.estado = EstadoProducto.CLIENTE
                flush()
                detalle_auditoria = {"presupuesto_numero": orden.presupuesto.numero}
                if firmante_payload.get("tiene_firmante_anexo"):
                    detalle_auditoria["firmante_nombre"] = firmante_payload["firmante_nombre"]
                    detalle_auditoria["firmante_dni"] = firmante_payload["firmante_dni"]
                registrar_auditoria(
                    usuario_db,
                    AccionAuditoria.CONTRATO_GENERADO,
                    "orden",
                    orden.id,
                    f"Contrato generado — orden #{orden.id}",
                    detalle_auditoria,
                )
                return {
                    "message": "Contrato registrado correctamente",
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "contrato_generado_at": isoformat_ar(orden.contrato_generado_at),
                        "contrato_generado_por_id": usuario_db.id if usuario_db else None,
                        "contrato_generado_por_nombre": nombre_usuario(usuario_db),
                        "reimpresion": False,
                        **firmante_payload,
                    },
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al registrar contrato: {str(e)}")

    @staticmethod
    def _rol_efectivo_usuario(usuario) -> str:
        """Rol efectivo: siempre relee por id en la sesión abierta (fuente de verdad)."""
        if usuario is None:
            return ""
        uid = getattr(usuario, "id", None)
        if uid is not None:
            from src.models import Usuario

            u = Usuario.get(id=int(uid))
            if u is not None:
                rol = u.rol
                return (rol.value if hasattr(rol, "value") else str(rol)).strip().upper()
        rol = getattr(usuario, "rol", None)
        if rol is None:
            return ""
        return (rol.value if hasattr(rol, "value") else str(rol)).strip().upper()

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
                        titular = titular_presupuesto(presupuesto)
                        cliente_nombre = titular["cliente_nombre"]
                        cliente_dni = titular["cliente_dni"]
                        cliente_direccion = titular["cliente_direccion"]
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
                            "fecha_creacion": isoformat_ar(o.fecha_creacion),
                            "contrato_generado_at": isoformat_ar(o.contrato_generado_at),
                            "contrato_generado_por_id": o.contrato_generado_por.id if getattr(o, "contrato_generado_por", None) else None,
                            "contrato_generado_por_nombre": nombre_usuario(getattr(o, "contrato_generado_por", None)),
                            "total": float(o.seña_pagada or 0) + float(o.saldo_pendiente or 0),
                            "productos_reservados": productos_reservados,
                            **_campos_firmante_orden(o),
                        })
                    except Exception as item_e:
                        logger.warning("listar_contratos: omitiendo orden %s: %s", o.id, item_e)
                        continue
                return resultado
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al listar contratos: {str(e)}")

    def eliminar_orden_trabajo(self, orden_id: int, usuario_id: Optional[int] = None) -> dict:
        """Eliminar una orden de trabajo, anular señas/pagos en caja y liberar productos."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

                presupuesto = orden.presupuesto
                presupuesto_numero = presupuesto.numero if presupuesto else None
                orden_id_eliminada = orden.id
                seña_pagada = round_pesos(orden.seña_pagada)

                usuario = None
                if usuario_id:
                    usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    # Fallback: usuario de algún movimiento de seña / primer admin de la sucursal
                    for cm in list(CajaMovimiento.select()):
                        if presupuesto_numero and _origen_caja_liga_presupuesto_o_orden(
                            getattr(cm, "origen", None), presupuesto_numero, orden_id_eliminada
                        ):
                            usuario = cm.usuario
                            break
                if not usuario:
                    raise HTTPException(
                        status_code=400,
                        detail="No se pudo determinar el usuario para anular los movimientos de caja",
                    )

                anulaciones_caja = self._anular_ingresos_caja_de_orden(
                    orden_id=orden_id_eliminada,
                    presupuesto_numero=presupuesto_numero or "",
                    usuario=usuario,
                )
                anulaciones_cc = self._devolver_saldo_cc_de_orden(orden)

                # Recibos ligados a la orden (FK Required)
                for recibo in list(orden.recibos):
                    recibo.delete()

                # Liberar productos reservados
                for producto_reservado in list(orden.productos_reservados):
                    producto_reservado.delete()

                flush()

                orden.delete()

                if presupuesto:
                    presupuesto.estado = "cancelada"
                    flush()

                monto_anulado_caja = round_pesos(sum(a["monto"] for a in anulaciones_caja))
                monto_devuelto_cc = round_pesos(sum(a["monto"] for a in anulaciones_cc))
                registrar_auditoria(
                    usuario,
                    AccionAuditoria.ORDEN_ELIMINADA,
                    "orden",
                    orden_id_eliminada,
                    f"Orden #{orden_id_eliminada} eliminada",
                    {
                        "presupuesto_numero": presupuesto_numero,
                        "seña_pagada": seña_pagada,
                        "anulado_caja": monto_anulado_caja,
                        "devuelto_cc": monto_devuelto_cc,
                    },
                )
                partes_msg = [
                    "Orden de trabajo eliminada exitosamente.",
                    "El presupuesto fue cancelado y los productos liberados.",
                ]
                if monto_anulado_caja > 0:
                    partes_msg.append(
                        f"Se anuló en caja ${int(monto_anulado_caja):,}".replace(",", ".")
                        + " (seña/pagos)."
                    )
                if monto_devuelto_cc > 0:
                    partes_msg.append(
                        f"Se devolvió ${int(monto_devuelto_cc):,}".replace(",", ".")
                        + " a cuenta corriente del cliente."
                    )
                if monto_anulado_caja <= 0 and monto_devuelto_cc <= 0 and seña_pagada > 0:
                    partes_msg.append(
                        "No se encontraron movimientos de caja/CC para anular "
                        "(la seña pudo haberse registrado solo parcialmente)."
                    )

                return {
                    "message": " ".join(partes_msg),
                    "success": True,
                    "data": {
                        "id": orden_id_eliminada,
                        "monto_anulado_caja": monto_anulado_caja,
                        "monto_devuelto_cuenta_corriente": monto_devuelto_cc,
                        "anulaciones_caja": anulaciones_caja,
                        "anulaciones_cuenta_corriente": anulaciones_cc,
                    },
                }

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al eliminar orden de trabajo: {str(e)}")

    def _anular_ingresos_caja_de_orden(
        self,
        orden_id: int,
        presupuesto_numero: str,
        usuario: Usuario,
    ) -> list:
        """Genera EGRESOS que anulan INGRESOS de seña/pagos adicionales de la orden."""
        anulaciones = []
        if not presupuesto_numero:
            return anulaciones

        ingresos = []
        for cm in list(CajaMovimiento.select()):
            tipo_val = cm.tipo.value if hasattr(cm.tipo, "value") else str(cm.tipo)
            if tipo_val != "INGRESO":
                continue
            if not _origen_caja_liga_presupuesto_o_orden(
                getattr(cm, "origen", None), presupuesto_numero, orden_id
            ):
                continue
            ingresos.append(cm)

        for ingreso in ingresos:
            origen_anul = f"ANULACION_ORDEN:{orden_id}:MOV:{ingreso.id}"
            ya_anulado = False
            for cm in list(CajaMovimiento.select()):
                if (cm.origen or "") == origen_anul:
                    ya_anulado = True
                    break
            if ya_anulado:
                continue

            monto = round_pesos(ingreso.monto)
            if monto <= 0:
                continue

            CajaMovimiento(
                fecha_hora=ahora_ar(),
                tipo=TipoMovimiento.EGRESO,
                monto=monto,
                payment_method=ingreso.payment_method,
                metodo_pago_configurable=ingreso.metodo_pago_configurable,
                submetodo_pago=ingreso.submetodo_pago,
                origen=origen_anul,
                categoria="OTROS_EGRESOS",
                destino=f"Devolución seña/pago — anulación orden {orden_id}",
                venta=None,
                usuario=usuario,
                sucursal=ingreso.sucursal,
                cuenta_destino=ingreso.cuenta_destino,
            )
            anulaciones.append(
                {
                    "movimiento_original_id": ingreso.id,
                    "origen_original": ingreso.origen,
                    "monto": monto,
                    "origen_anulacion": origen_anul,
                }
            )
        flush()
        return anulaciones

    def _devolver_saldo_cc_de_orden(self, orden: OrdenTrabajo) -> list:
        """Si se usó saldo a favor (débitos CC) en la orden, lo restituye como crédito."""
        from src.services.pagos_services import PagosServices

        anulaciones = []
        cliente = None
        try:
            if orden.presupuesto and orden.presupuesto.cliente:
                cliente = orden.presupuesto.cliente
        except Exception:
            cliente = None
        if not cliente:
            return anulaciones

        pagos = PagosServices()
        debitos = [
            m
            for m in list(CuentaCorriente.select())
            if getattr(m, "referencia_orden", None) == orden.id
            and getattr(m, "tipo", "") == "debito"
            and float(m.monto or 0) > 0
        ]
        for deb in debitos:
            monto = round_pesos(deb.monto)
            if monto <= 0:
                continue
            concepto = (
                f"Anulación orden {orden.id} — devolución saldo usado "
                f"({deb.concepto or 'pago'})"
            )
            mov = pagos.append_movimiento_cuenta_corriente(
                cliente,
                "credito",
                monto,
                concepto,
                None,
                None,
                None,
                usuario=usuario,
            )
            anulaciones.append(
                {
                    "debito_original_id": deb.id,
                    "credito_id": mov.id,
                    "monto": monto,
                }
            )
        flush()
        return anulaciones

    def _obtener_cliente_orden(self, orden: "OrdenTrabajo") -> tuple:
        """Obtiene nombre y celular del cliente/precliente de la orden."""
        tit = titular_presupuesto(getattr(orden, "presupuesto", None))
        nombre = tit.get("cliente_nombre")
        if nombre in (None, "", "Sin titular asignado"):
            return None, None
        return nombre, tit.get("cliente_celular")

    def _aplicar_destino_productos(
        self,
        productos: list,
        destino: str,
        lavanderia_id: Optional[int],
        modista_id: Optional[int],
        descripcion: Optional[str] = None,
        cliente_nombre: Optional[str] = None,
        cliente_celular: Optional[str] = None,
        enviado_por: Optional[Usuario] = None,
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
        hoy = hoy_ar()
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
                # Cerrar ingresos abiertos previos para no duplicar filas en bolsa.
                for pl in list(prod.productos_lavanderias):
                    if pl.fecha_salida is None:
                        pl.fecha_salida = hoy
                for pm in list(prod.productos_modistas):
                    if pm.fecha_salida is None:
                        pm.fecha_salida = hoy
                kwargs = dict(
                    producto=prod,
                    lavanderia=lavanderia,
                    fecha_ingreso=hoy,
                    notas=notas,
                    cliente_nombre=cli_nombre,
                    cliente_celular=cli_celular,
                )
                if enviado_por is not None:
                    kwargs["enviado_por"] = enviado_por
                ProductoLavanderia(**{k: v for k, v in kwargs.items() if v is not None or k in ("producto", "lavanderia", "fecha_ingreso")})
            elif destino == "MODISTA" and modista:
                for pl in list(prod.productos_lavanderias):
                    if pl.fecha_salida is None:
                        pl.fecha_salida = hoy
                for pm in list(prod.productos_modistas):
                    if pm.fecha_salida is None:
                        pm.fecha_salida = hoy
                kwargs = dict(
                    producto=prod,
                    modista=modista,
                    fecha_ingreso=hoy,
                    notas=notas,
                    cliente_nombre=cli_nombre,
                    cliente_celular=cli_celular,
                )
                if enviado_por is not None:
                    kwargs["enviado_por"] = enviado_por
                ProductoModista(**{k: v for k, v in kwargs.items() if v is not None or k in ("producto", "modista", "fecha_ingreso")})

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

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                productos_en_orden = {pr.producto.id: pr for pr in orden.productos_reservados}
                revisiones_abiertas = _revisiones_abiertas_orden(orden)

                # Sin prendas reservadas: solo se puede finalizar si no hay revisiones abiertas.
                if not productos_en_orden:
                    if revisiones_abiertas:
                        raise HTTPException(
                            status_code=403,
                            detail=(
                                "Hay prendas en revisión. No se puede dar de baja el contrato "
                                "ni marcar la devolución como completada. No romper el pagaré "
                                "hasta finalizar la revisión."
                            ),
                        )
                    orden.estado = "Completada"
                    orden.devolucion_recibida_por = usuario
                    orden.devolucion_recibida_at = ahora_ar()
                    flush()
                    registrar_auditoria(
                        usuario,
                        AccionAuditoria.DEVOLUCION_COMPLETA,
                        "orden",
                        orden.id,
                        f"Devolución finalizada — orden #{orden.id}",
                        {"productos": 0, "restantes": 0},
                    )
                    return {
                        "message": "Devolución finalizada. Contrato cerrado.",
                        "success": True,
                        "data": {
                            "orden_id": orden.id,
                            "estado": orden.estado,
                            "productos_procesados": 0,
                            "productos_restantes_orden": 0,
                            "remitos": [],
                            "orden_completada": True,
                            "bloqueo_por_revision": False,
                            "revisiones_abiertas": [],
                            "devolucion_recibida_por_id": usuario.id,
                            "devolucion_recibida_por_nombre": nombre_usuario(usuario),
                            "devolucion_recibida_at": isoformat_ar(orden.devolucion_recibida_at),
                        },
                    }

                cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
                remitos_out: List[dict] = []
                stamp = ahora_ar().strftime("%Y%m%d%H%M%S")

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
                        enviado_por=usuario,
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
                        nueva_obs = f"[Devolución {num_remito} - {ahora_ar().strftime('%d/%m/%Y %H:%M')}]"
                        pr.observaciones = (
                            f"{observaciones_previas}\n{nueva_obs}".strip()
                            if observaciones_previas
                            else nueva_obs
                        )
                        pid_del = pr.producto.id
                        pr.delete()
                        productos_en_orden.pop(pid_del, None)

                restantes = len(productos_en_orden)
                bloqueo_por_revision = False
                if restantes == 0:
                    if _revisiones_abiertas_orden(orden):
                        bloqueo_por_revision = True
                        # No cerrar contrato mientras haya revisión abierta.
                    else:
                        orden.estado = "Completada"
                orden.devolucion_recibida_por = usuario
                orden.devolucion_recibida_at = ahora_ar()
                flush()

                for rem in remitos_out:
                    dest = rem.get("destino")
                    if dest == "LAVANDERIA":
                        registrar_auditoria(
                            usuario,
                            AccionAuditoria.LAVANDERIA_ENVIO,
                            "orden",
                            orden.id,
                            f"Envío a lavandería — remito {rem.get('numero')}",
                            {"remito": rem.get("numero"), "productos": rem.get("cantidad")},
                        )
                    elif dest == "MODISTA":
                        registrar_auditoria(
                            usuario,
                            AccionAuditoria.MODISTA_ENVIO,
                            "orden",
                            orden.id,
                            f"Envío a modista — remito {rem.get('numero')}",
                            {"remito": rem.get("numero"), "productos": rem.get("cantidad")},
                        )

                orden_completada = restantes == 0 and not bloqueo_por_revision
                registrar_auditoria(
                    usuario,
                    AccionAuditoria.DEVOLUCION_COMPLETA if orden_completada else AccionAuditoria.DEVOLUCION_PARCIAL,
                    "orden",
                    orden.id,
                    f"Devolución recibida — orden #{orden.id} ({len(asignados)} prenda(s))",
                    {
                        "productos": len(asignados),
                        "restantes": restantes,
                        "remitos": len(remitos_out),
                        "bloqueo_por_revision": bloqueo_por_revision,
                    },
                )

                msg_base = (
                    f"Devolución registrada: {len(remitos_out)} remito(s)."
                    if remitos_out
                    else "Devolución registrada."
                )
                if restantes > 0:
                    msg_base += f" Quedan {restantes} prenda(s) en la orden (no incluidas en envíos)."
                if bloqueo_por_revision:
                    msg_base += (
                        " Hay prendas en revisión: no se cerró el contrato. "
                        "No romper el pagaré hasta finalizar la revisión."
                    )

                return {
                    "message": msg_base,
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "estado": orden.estado,
                        "productos_procesados": len(asignados),
                        "productos_restantes_orden": restantes,
                        "remitos": remitos_out,
                        "orden_completada": orden_completada,
                        "bloqueo_por_revision": bloqueo_por_revision,
                        "revisiones_abiertas": _revisiones_abiertas_para_api(orden),
                        "devolucion_recibida_por_id": usuario.id,
                        "devolucion_recibida_por_nombre": nombre_usuario(usuario),
                        "devolucion_recibida_at": isoformat_ar(orden.devolucion_recibida_at),
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
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                cliente_nombre, cliente_celular = self._obtener_cliente_orden(orden)
                motivo = (descripcion or "").strip()
                if not motivo:
                    raise HTTPException(
                        status_code=400,
                        detail="Debe describir el motivo de la revisión",
                    )
                notas_taller = f"{PREFIJO_REVISION_NOTA} {motivo}".strip()
                self._aplicar_destino_productos(
                    a_devolver,
                    destino,
                    lavanderia_id,
                    modista_id,
                    descripcion=notas_taller,
                    cliente_nombre=cliente_nombre,
                    cliente_celular=cliente_celular,
                    enviado_por=usuario,
                )

                for pr in a_devolver:
                    prod = pr.producto
                    observaciones_previas = pr.observaciones or ""
                    nueva_observacion = (
                        f"[Devolución parcial / revisión - {ahora_ar().strftime('%d/%m/%Y %H:%M')}] {motivo}"
                    )
                    pr.observaciones = (
                        f"{observaciones_previas}\n{nueva_observacion}".strip()
                        if observaciones_previas
                        else nueva_observacion
                    )
                    RevisionDevolucion(
                        orden=orden,
                        producto=prod,
                        motivo=motivo,
                        destino=destino,
                        estado=EstadoRevisionDevolucion.ABIERTA.value,
                        creada_at=ahora_ar(),
                    )
                    pr.delete()

                if orden.estado and orden.estado.lower() not in ["completada", "cancelada"]:
                    if orden.estado.lower() not in ["en proceso", "entregada"]:
                        orden.estado = "En proceso"

                orden.devolucion_recibida_por = usuario
                orden.devolucion_recibida_at = ahora_ar()
                flush()

                if destino == "LAVANDERIA":
                    registrar_auditoria(
                        usuario,
                        AccionAuditoria.LAVANDERIA_ENVIO,
                        "orden",
                        orden.id,
                        f"Envío parcial a lavandería — orden #{orden.id}",
                        {"productos": productos_ids},
                    )
                elif destino == "MODISTA":
                    registrar_auditoria(
                        usuario,
                        AccionAuditoria.MODISTA_ENVIO,
                        "orden",
                        orden.id,
                        f"Envío parcial a modista — orden #{orden.id}",
                        {"productos": productos_ids},
                    )
                registrar_auditoria(
                    usuario,
                    AccionAuditoria.DEVOLUCION_PARCIAL,
                    "orden",
                    orden.id,
                    f"Devolución con revisión — orden #{orden.id}",
                    {"productos": productos_ids, "destino": destino},
                )

                return {
                    "message": (
                        f"Devolución con revisión registrada. Productos enviados a {destino}. "
                        "No romper el pagaré hasta finalizar la revisión."
                    ),
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "productos_devueltos": productos_ids,
                        "descripcion": motivo,
                        "destino": destino,
                        "productos_devueltos_count": len(productos_ids),
                        "revisiones_abiertas": _revisiones_abiertas_para_api(orden),
                        "tiene_revisiones_abiertas": True,
                        "devolucion_recibida_por_id": usuario.id,
                        "devolucion_recibida_por_nombre": nombre_usuario(usuario),
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al registrar devolución parcial: {str(e)}")

    def resolver_revision_devolucion(
        self,
        orden_id: int,
        usuario_id: int,
        revision_id: Optional[int] = None,
        producto_id: Optional[int] = None,
    ) -> dict:
        """Marca una revisión de devolución como RESUELTA."""
        with db_session:
            try:
                orden = OrdenTrabajo.get(id=orden_id)
                if not orden:
                    raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
                if orden.estado and orden.estado.lower() in ["completada", "cancelada"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"La orden ya está en estado '{orden.estado}'",
                    )

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                revision = None
                if revision_id is not None:
                    revision = RevisionDevolucion.get(id=revision_id)
                    if not revision or revision.orden.id != orden.id:
                        raise HTTPException(status_code=404, detail="Revisión no encontrada")
                elif producto_id is not None:
                    candidatas = [
                        r
                        for r in _revisiones_abiertas_orden(orden)
                        if r.producto and r.producto.id == producto_id
                    ]
                    if not candidatas:
                        raise HTTPException(
                            status_code=404,
                            detail="No hay revisión abierta para ese producto",
                        )
                    revision = max(candidatas, key=lambda r: r.id)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="Indique revision_id o producto_id",
                    )

                if (revision.estado or "") != EstadoRevisionDevolucion.ABIERTA.value:
                    raise HTTPException(status_code=400, detail="La revisión ya está resuelta")

                revision.estado = EstadoRevisionDevolucion.RESUELTA.value
                revision.resuelta_at = ahora_ar()
                revision.resuelta_por = usuario
                flush()

                registrar_auditoria(
                    usuario,
                    AccionAuditoria.REVISION_DEVOLUCION_RESUELTA,
                    "orden",
                    orden.id,
                    f"Revisión resuelta — orden #{orden.id} producto #{revision.producto.id}",
                    {"revision_id": revision.id, "producto_id": revision.producto.id},
                )

                abiertas = _revisiones_abiertas_para_api(orden)
                puede_finalizar = (
                    len(list(orden.productos_reservados)) == 0 and len(abiertas) == 0
                )

                return {
                    "message": "Revisión marcada como resuelta."
                    + (
                        " Ya se puede finalizar la devolución / cerrar el contrato."
                        if puede_finalizar
                        else ""
                    ),
                    "success": True,
                    "data": {
                        "orden_id": orden.id,
                        "revision_id": revision.id,
                        "producto_id": revision.producto.id,
                        "revisiones_abiertas": abiertas,
                        "tiene_revisiones_abiertas": len(abiertas) > 0,
                        "puede_finalizar_devolucion": puede_finalizar,
                    },
                }
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al resolver revisión: {str(e)}",
                )


