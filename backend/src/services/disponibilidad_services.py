from __future__ import annotations

from typing import Optional

from pony.orm import db_session
from datetime import date, datetime, timedelta
from src.models import ProductoReservado


def _as_date(d: date | datetime) -> date:
    if isinstance(d, datetime):
        return d.date()
    return d


def _intervalos_solapan(a_ini: date, a_fin: date, b_ini: date, b_fin: date) -> bool:
    return a_ini <= b_fin and a_fin >= b_ini


def producto_ids_en_ventana_reserva_el_dia(ref: Optional[date] = None) -> set[int]:
    """
    IDs de productos que hoy (o `ref`) caen en ventana de bloqueo **solo tras seña**:
    orden de trabajo con ProductoReservado y ref ∈ [fecha_bloqueo, fecha_bloqueo+5]
    (orden no cancelada).

    Un presupuesto pendiente **no** bloquea: la prenda se compromete al cobrar la seña
    (creación de orden y ProductoReservado).

    Debe ejecutarse dentro de un db_session activo (p. ej. desde ProductoServices).
    """
    dia = _as_date(ref) if ref is not None else date.today()
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
