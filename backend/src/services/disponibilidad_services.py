from __future__ import annotations

from typing import Optional

from pony.orm import db_session
from datetime import date, datetime, timedelta
from fastapi import HTTPException

from src.descripcion_producto import format_descripcion_producto
from src.fechas_ar import hoy_ar
from src.models import ProductoReservado, Producto, EstadoProducto


def _as_date(d: date | datetime) -> date:
    if isinstance(d, datetime):
        from src.fechas_ar import instante_a_fecha_ar

        return instante_a_fecha_ar(d)
    return d


def _intervalos_solapan(a_ini: date, a_fin: date, b_ini: date, b_fin: date) -> bool:
    return a_ini <= b_fin and a_fin >= b_ini


def _estado_producto_codigo(estado) -> str:
    """Pony puede exponer Required(EstadoProducto) como Enum o como str según driver/carga."""
    if estado is None:
        return ""
    if isinstance(estado, EstadoProducto):
        return estado.value
    return str(estado).strip().upper()


def producto_ids_en_ventana_reserva_el_dia(ref: Optional[date] = None) -> set[int]:
    """
    IDs de productos que hoy (o `ref`) caen en ventana de bloqueo **solo tras seña**:
    orden de trabajo con ProductoReservado y ref ∈ [fecha_bloqueo, fecha_bloqueo+5]
    (orden no cancelada).

    Un presupuesto pendiente **no** bloquea: la prenda se compromete al cobrar la seña
    (creación de orden y ProductoReservado).

    Debe ejecutarse dentro de un db_session activo (p. ej. desde ProductoServices).
    """
    dia = _as_date(ref) if ref is not None else hoy_ar()
    out: set[int] = set()

    for pr in ProductoReservado.select():
        orden = pr.orden_trabajo
        if not orden:
            continue
        oest = (orden.estado or "").strip().lower()
        if oest in ("cancelada", "cancelado"):
            continue
        bi = _as_date(pr.fecha_bloqueo)
        bf = bi + timedelta(days=5)
        if bi <= dia <= bf:
            out.add(pr.producto.id)

    return out


@db_session
def verificar_disponibilidad(
    producto_id: int,
    fecha_retiro: date,
    fecha_devolucion: date,
    presupuesto_excluir_id: Optional[int] = None,
    orden_excluir_id: Optional[int] = None,
) -> bool:
    """
    Verifica si un producto está disponible en las fechas indicadas.

    Solo bloquea por **órdenes con seña** (ProductoReservado): ventana
    [fecha_bloqueo, fecha_bloqueo+5], coherente con crear_orden_trabajo (fecha_bloqueo = R - 5 días).

    Los presupuestos sin orden **no** bloquean (el cliente puede no concretar).

    Args:
        producto_id: ID del producto a verificar
        fecha_retiro: Inicio del alquiler solicitado (retiro del cliente)
        fecha_devolucion: Fin del alquiler solicitado
        presupuesto_excluir_id: Reservado por compatibilidad de API; ya no afecta la regla.
        orden_excluir_id: Si se edita un presupuesto con orden, excluir sus propias reservas.

    Returns:
        True si el producto está disponible, False si está ocupado
    """
    _ = presupuesto_excluir_id  # compatibilidad API; bloqueo solo con OT + seña
    try:
        fecha_retiro = _as_date(fecha_retiro)
        fecha_devolucion = _as_date(fecha_devolucion)

        for producto_reservado in ProductoReservado.select():
            if producto_reservado.producto.id != producto_id:
                continue
            orden = producto_reservado.orden_trabajo
            if not orden:
                continue
            if orden_excluir_id is not None and orden.id == orden_excluir_id:
                continue
            oest = (orden.estado or "").strip().lower()
            if oest in ("cancelada", "cancelado"):
                continue

            fecha_bloqueo_inicio = _as_date(producto_reservado.fecha_bloqueo)
            fecha_bloqueo_fin = fecha_bloqueo_inicio + timedelta(days=5)

            if _intervalos_solapan(
                fecha_bloqueo_inicio, fecha_bloqueo_fin, fecha_retiro, fecha_devolucion
            ):
                return False

        return True
    except Exception as e:
        print(f"Error en verificar_disponibilidad: {e}")
        import traceback

        traceback.print_exc()
        return True


def validar_producto_para_item_presupuesto(
    producto: Producto,
    *,
    fecha_retiro: date,
    fecha_devolucion: date,
    orden_excluir_id: Optional[int],
    es_reuso_del_mismo_presupuesto: bool,
    ignorar_conflicto_reserva: bool = False,
) -> None:
    """
    Valida disponibilidad por ventana de reserva y, si el ítem no es reutilización del mismo
    presupuesto, estado en salón y no inmovilizado.
    """
    desc = format_descripcion_producto(
        producto.descripcion, producto.descripcion_extra
    ) or f"#{producto.id}"
    if not ignorar_conflicto_reserva and not verificar_disponibilidad(
        producto.id,
        fecha_retiro,
        fecha_devolucion,
        presupuesto_excluir_id=None,
        orden_excluir_id=orden_excluir_id,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f'El producto "{desc}" no está disponible para la nueva fecha. '
                "Conflicto con otra reserva."
            ),
        )
    if es_reuso_del_mismo_presupuesto:
        return
    if getattr(producto, "inmovilizado", False):
        raise HTTPException(
            status_code=400,
            detail=f'El producto "{desc}" no está disponible (inmovilizado).',
        )
    if _estado_producto_codigo(producto.estado) != EstadoProducto.SALON.value:
        raise HTTPException(
            status_code=400,
            detail=(
                f'El producto "{desc}" no está disponible para asignar '
                f'(estado actual: {_estado_producto_codigo(producto.estado) or "—"}). Debe estar en salón.'
            ),
        )


def reconstruir_productos_reservados_para_orden(orden, presupuesto) -> None:
    """
    Elimina ProductoReservado de la orden y los recrea según ítems del presupuesto
    (fecha_bloqueo = fecha_retiro_reserva - 5 días), alineado con crear_orden_trabajo.
    Ejecutar dentro del mismo db_session que la edición del presupuesto.
    """
    fecha_retiro_reserva = presupuesto.fecha_retiro or presupuesto.fecha_evento
    for pr in list(orden.productos_reservados):
        pr.delete()
    for item in presupuesto.items:
        producto = item.producto
        fecha_bloqueo = fecha_retiro_reserva - timedelta(days=5)
        if _estado_producto_codigo(producto.estado) in (
            EstadoProducto.LAVANDERIA.value,
            EstadoProducto.MODISTA.value,
            EstadoProducto.VENDIDO.value,
        ):
            estado_pr = "no disponible"
        else:
            estado_pr = "reservado"
        ProductoReservado(
            orden_trabajo=orden,
            producto=producto,
            estado=estado_pr,
            fecha_bloqueo=fecha_bloqueo,
        )
