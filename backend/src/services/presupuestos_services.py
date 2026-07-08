from pony.orm import db_session, flush, commit
from datetime import datetime, date, timedelta
from typing import List, Optional
from decouple import config
from fastapi import HTTPException
from src.fechas_ar import fecha_presupuesto_api_ymd, instante_a_fecha_ar
from src.money import round_pesos
from src.fechas_ar import ahora_ar
from src.models import Presupuesto, ItemPresupuesto, Producto, Cliente, Precliente, Roles, Usuario, db
from src.schemas import PresupuestoCreate, PresupuestoResponse, ItemPresupuestoResponse, ConjuntoMismaFechaCategoriaOut
from src.descripcion_producto import format_descripcion_producto
from src.services.disponibilidad_services import (
    validar_producto_para_item_presupuesto,
    reconstruir_productos_reservados_para_orden,
)

def _presupuesto_cliente_info(p):
    """Devuelve cliente_id, precliente_id, cliente_nombre, es_precliente, cliente_dni, cliente_direccion, cliente_celular para un presupuesto."""
    if p.precliente:
        return {
            "cliente_id": None,
            "precliente_id": p.precliente.id,
            "cliente_nombre": f"{p.precliente.apellido} {p.precliente.nombre}".strip(),
            "es_precliente": True,
            "cliente_dni": None,
            "cliente_direccion": None,
            "cliente_celular": p.precliente.celular,
        }
    c = p.cliente
    if c:
        return {
            "cliente_id": c.id,
            "precliente_id": None,
            "cliente_nombre": f"{c.apellido} {c.nombre}".strip(),
            "es_precliente": False,
            "cliente_dni": c.dni,
            "cliente_direccion": c.direccion,
            "cliente_celular": c.celular,
        }
    return {
        "cliente_id": None,
        "precliente_id": None,
        "cliente_nombre": "Cliente eliminado",
        "es_precliente": False,
        "cliente_dni": None,
        "cliente_direccion": None,
        "cliente_celular": None,
    }


def _descuento_maximo_estandar(usuario: Optional[Usuario]) -> float:
    if usuario and usuario.rol in (Roles.ADMIN, Roles.SUPER_ADMIN):
        return 50.0
    return 15.0


def _extra_discount_reason_para_db(value: Optional[str]) -> str:
    """
    Motivo de descuento extra: en algunos despliegues Pony/BD no aceptan NULL en la columna.
    Normalizar a cadena vacía en lugar de None al persistir.
    """
    if value is None:
        return ""
    return str(value).strip()


def _total_pagado_orden(orden, total_presupuesto_anterior: float) -> float:
    """Importe ya abonado (seña + pagos adicionales), según total y saldo vigentes."""
    return max(0.0, round_pesos(float(total_presupuesto_anterior) - round_pesos(orden.saldo_pendiente)))


class PresupuestosServices:
    def __init__(self):
        pass

    def crear_presupuesto(self, data: PresupuestoCreate, current_user=None) -> dict:
        with db_session:
            try:
                
                # Cliente o precliente
                cliente = None
                precliente = None
                if data.cliente_id is not None:
                    cliente = Cliente.get(id=data.cliente_id)
                    if not cliente:
                        raise HTTPException(status_code=404, detail="Cliente no encontrado")
                else:
                    precliente = Precliente.get(id=data.precliente_id)
                    if not precliente:
                        raise HTTPException(status_code=404, detail="Precliente no encontrado")
                

                # Verificar que todos los productos existen y están disponibles
                fecha_retiro = data.fecha_retiro or data.fecha_evento
                fecha_devolucion = data.fecha_devolucion or data.fecha_evento
                
                for i, item in enumerate(data.items):
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")

                    validar_producto_para_item_presupuesto(
                        producto,
                        fecha_retiro=fecha_retiro,
                        fecha_devolucion=fecha_devolucion,
                        orden_excluir_id=None,
                        es_reuso_del_mismo_presupuesto=False,
                    )

                # Calcular total base sumando los subtotales de los items
                # NOTA: El frontend ya aplicó el descuento redistribuyendo los precios de los items,
                # por lo que total_base ya es el total FINAL con el descuento aplicado
                total_base = round_pesos(sum(item.subtotal for item in data.items))
                
                # Validar descuento extra si existe
                total = total_base
                usuario_aplico_descuento = (
                    Usuario.get(id=current_user.id) if current_user else None
                )
                descuento_maximo_estandar = _descuento_maximo_estandar(
                    usuario_aplico_descuento
                )

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
                    "precliente": precliente,
                    "fecha_evento": fecha_evento_presupuesto,
                    "fecha_retiro": data.fecha_retiro,
                    "fecha_devolucion": data.fecha_devolucion,
                    "categoria_evento": data.categoria_evento,
                    "nombre_agasajado": data.nombre_agasajado,
                    "lugar_evento": data.lugar_evento,
                    "observaciones": data.observaciones,
                    "estado": "pendiente",
                    "total": total,
                    "fecha_creacion": ahora_ar(),
                }
                
                # Solo agregar campos de descuento extra si tienen valores
                if data.extra_discount_percentage is not None:
                    presupuesto_args["extra_discount_percentage"] = data.extra_discount_percentage
                    presupuesto_args["extra_discount_amount"] = data.extra_discount_amount
                    presupuesto_args["extra_discount_reason"] = _extra_discount_reason_para_db(
                        data.extra_discount_reason
                    )
                    if usuario_aplico_descuento:
                        presupuesto_args["extra_discount_applied_by"] = usuario_aplico_descuento
                    presupuesto_args["extra_discount_created_at"] = ahora_ar()
                
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
                        "cliente_id": presupuesto.cliente.id if presupuesto.cliente else None,
                        "precliente_id": presupuesto.precliente.id if presupuesto.precliente else None,
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
                # Pony ORM falla en Python 3.14 al usar order_by(desc(...)) con deepcopy del traductor.
                # Evitamos ese camino ordenando en memoria para mantener compatibilidad.
                presupuestos = list(Presupuesto.select())
                presupuestos.sort(
                    key=lambda p: p.fecha_creacion or datetime.min,
                    reverse=True,
                )
                
                if not presupuestos:
                    return []
                
                return [
                    PresupuestoResponse(
                        id=p.id,
                        numero=p.numero,
                        **_presupuesto_cliente_info(p),
                        fecha_evento=fecha_presupuesto_api_ymd(p.fecha_evento) or "",
                        fecha_retiro=fecha_presupuesto_api_ymd(p.fecha_retiro),
                        fecha_devolucion=fecha_presupuesto_api_ymd(p.fecha_devolucion),
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
                                producto_descripcion=format_descripcion_producto(
                                    item.producto.descripcion,
                                    item.producto.descripcion_extra,
                                ),
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
                        orden_id=p.orden_trabajo.id if p.orden_trabajo else None,
                    )
                    for p in presupuestos
                ]
            except Exception as e:
                print(f"❌ Error en listar_presupuestos: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al listar presupuestos: {str(e)}")

    @staticmethod
    def _norm_categoria_evento(val: Optional[str]) -> str:
        return (val or "").strip().casefold()

    @staticmethod
    def _fecha_evento_dia_presupuesto(p) -> date:
        """Día civil del evento (AR si el ORM devolviera datetime con zona)."""
        v = p.fecha_evento
        if isinstance(v, datetime):
            return instante_a_fecha_ar(v)
        return v

    def listar_conjuntos_misma_fecha_categoria(
        self,
        fecha_evento: date,
        categoria_evento: str,
        excluir_presupuesto_id: Optional[int] = None,
    ) -> List[ConjuntoMismaFechaCategoriaOut]:
        """Presupuestos con la misma fecha de evento y categoría (normalizada), excl. cancelados."""
        cat_buscada = self._norm_categoria_evento(categoria_evento)
        if not cat_buscada:
            return []
        with db_session:
            try:
                # Rango ±1 día: SQL crudo (Pony 0.7 + Python 3.13 rompe el decompilador con >= / and en lambdas).
                fecha_lo = fecha_evento - timedelta(days=1)
                fecha_hi = fecha_evento + timedelta(days=1)
                sqlite = (config("DB_PROVIDER", default="postgres") or "postgres").lower() == "sqlite"
                conn = db.get_connection()
                cur = conn.cursor()
                try:
                    if sqlite:
                        cur.execute(
                            'SELECT id FROM "Presupuesto" WHERE "fecha_evento" >= ? AND "fecha_evento" <= ?',
                            (fecha_lo, fecha_hi),
                        )
                    else:
                        cur.execute(
                            'SELECT id FROM "Presupuesto" WHERE "fecha_evento" >= %s AND "fecha_evento" <= %s',
                            (fecha_lo, fecha_hi),
                        )
                    ids = [row[0] for row in cur.fetchall()]
                finally:
                    cur.close()

                candidatos = []
                for pid in ids:
                    p = Presupuesto.get(id=pid)
                    if p is None:
                        continue
                    if self._fecha_evento_dia_presupuesto(p) != fecha_evento:
                        continue
                    candidatos.append(p)
                out: List[ConjuntoMismaFechaCategoriaOut] = []
                for p in candidatos:
                    if excluir_presupuesto_id is not None and p.id == excluir_presupuesto_id:
                        continue
                    est = (p.estado or "").strip().lower()
                    if est == "cancelada":
                        continue
                    if self._norm_categoria_evento(p.categoria_evento) != cat_buscada:
                        continue
                    lineas: List[str] = []
                    for item in p.items:
                        desc = format_descripcion_producto(
                            item.producto.descripcion, item.producto.descripcion_extra
                        )
                        if not desc:
                            desc = f"Producto #{item.producto.id}"
                        if item.cantidad and item.cantidad > 1:
                            desc = f"{desc} x{item.cantidad}"
                        lineas.append(desc)
                    agasajado = (p.nombre_agasajado or "").strip() or "(sin nombre)"
                    lugar = (p.lugar_evento or "").strip() or None
                    out.append(
                        ConjuntoMismaFechaCategoriaOut(
                            presupuesto_id=p.id,
                            numero=p.numero,
                            nombre_agasajado=agasajado,
                            lugar_evento=lugar,
                            productos=lineas,
                        )
                    )
                out.sort(key=lambda x: (x.nombre_agasajado.lower(), x.numero))
                return out
            except Exception as e:
                print(f"❌ Error en listar_conjuntos_misma_fecha_categoria: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al consultar conjuntos: {str(e)}")

    def editar_presupuesto(self, presupuesto_id: int, data: PresupuestoCreate, current_user=None) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                orden = presupuesto.orden_trabajo
                if orden:
                    oest = (orden.estado or "").strip().lower()
                    if oest in ("completada", "cancelada", "cancelado"):
                        raise HTTPException(
                            status_code=400,
                            detail="No se puede editar: la orden está completada o cancelada.",
                        )
                    if getattr(orden, "contrato_generado_at", None):
                        raise HTTPException(
                            status_code=400,
                            detail="No se puede editar: el contrato ya fue generado.",
                        )

                # Cliente o precliente
                cliente = None
                precliente = None
                if data.cliente_id is not None:
                    cliente = Cliente.get(id=data.cliente_id)
                    if not cliente:
                        raise HTTPException(status_code=404, detail="Cliente no encontrado")
                else:
                    precliente = Precliente.get(id=data.precliente_id)
                    if not precliente:
                        raise HTTPException(status_code=404, detail="Precliente no encontrado")

                # Verificar productos y disponibilidad
                fecha_retiro = data.fecha_retiro or data.fecha_evento
                fecha_devolucion = data.fecha_devolucion or data.fecha_evento

                old_product_ids = {item.producto.id for item in presupuesto.items}
                orden_excluir_id = orden.id if orden else None

                for item in data.items:
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")

                    validar_producto_para_item_presupuesto(
                        producto,
                        fecha_retiro=fecha_retiro,
                        fecha_devolucion=fecha_devolucion,
                        orden_excluir_id=orden_excluir_id,
                        es_reuso_del_mismo_presupuesto=(producto.id in old_product_ids),
                    )

                # Actualizar presupuesto
                presupuesto.cliente = cliente
                presupuesto.precliente = precliente
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
                total = round_pesos(total_base)
                usuario_aplico_descuento = (
                    Usuario.get(id=current_user.id) if current_user else None
                )
                descuento_maximo_estandar = _descuento_maximo_estandar(
                    usuario_aplico_descuento
                )

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
                    total = round_pesos(total_base)

                    presupuesto.extra_discount_percentage = data.extra_discount_percentage
                    presupuesto.extra_discount_amount = data.extra_discount_amount
                    presupuesto.extra_discount_reason = _extra_discount_reason_para_db(
                        data.extra_discount_reason
                    )
                    presupuesto.extra_discount_applied_by = usuario_aplico_descuento
                    presupuesto.extra_discount_created_at = ahora_ar()
                else:
                    # Si no hay descuento extra, limpiar campos
                    presupuesto.extra_discount_percentage = None
                    presupuesto.extra_discount_amount = None
                    presupuesto.extra_discount_reason = ""
                    presupuesto.extra_discount_applied_by = None
                    presupuesto.extra_discount_created_at = None

                total_presupuesto_anterior = round_pesos(presupuesto.total or 0.0)
                presupuesto.total = round_pesos(total)

                if orden:
                    total_pagado = _total_pagado_orden(orden, total_presupuesto_anterior)
                    if total_pagado > round_pesos(total) + 1e-9:
                        raise HTTPException(
                            status_code=400,
                            detail="El total del presupuesto no puede ser menor que lo ya pagado.",
                        )
                    orden.saldo_pendiente = max(0.0, round_pesos(round_pesos(total) - total_pagado))
                    # Misma regla que al pagar saldo desde la orden: si no queda saldo, marcar pagada.
                    oest = (orden.estado or "").strip().lower()
                    if orden.saldo_pendiente <= 0:
                        if oest not in (
                            "completada",
                            "cancelada",
                            "cancelado",
                            "entregada",
                        ):
                            orden.estado = "Pagada"
                    elif oest == "pagada":
                        orden.estado = "En proceso"
                    orden.fecha_evento = data.fecha_evento
                    orden.extra_discount_percentage = presupuesto.extra_discount_percentage
                    orden.extra_discount_amount = presupuesto.extra_discount_amount
                    orden.extra_discount_reason = presupuesto.extra_discount_reason
                    orden.extra_discount_applied_by = presupuesto.extra_discount_applied_by
                    orden.extra_discount_created_at = presupuesto.extra_discount_created_at
                    reconstruir_productos_reservados_para_orden(orden, presupuesto)

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
                    **_presupuesto_cliente_info(presupuesto),
                    fecha_evento=fecha_presupuesto_api_ymd(presupuesto.fecha_evento) or "",
                    fecha_retiro=fecha_presupuesto_api_ymd(presupuesto.fecha_retiro),
                    fecha_devolucion=fecha_presupuesto_api_ymd(presupuesto.fecha_devolucion),
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
                            producto_descripcion=format_descripcion_producto(
                                item.producto.descripcion,
                                item.producto.descripcion_extra,
                            ),
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
                    orden_id=presupuesto.orden_trabajo.id if presupuesto.orden_trabajo else None,
                )

            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en obtener_presupuesto_por_id: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al obtener presupuesto: {str(e)}")
