from __future__ import annotations

from typing import Optional

from pony.orm import db_session
from datetime import date, datetime, timedelta
from fastapi import HTTPException

from src.descripcion_producto import format_descripcion_producto
from src.fechas_ar import hoy_ar
from src.models import (
    ConfiguracionSistema,
    ProductoReservado,
    Producto,
    EstadoProducto,
)
from src.presupuesto_titular import titular_presupuesto

_ORDEN_CERRADA = ("cancelada", "cancelado", "completada", "completado")

# Si todavía no hay fila en ConfiguracionSistema, se usa este valor.
DIAS_VENTANA_SEGURIDAD_DEFAULT = 2
DIAS_VENTANA_SEGURIDAD_MIN = 0
DIAS_VENTANA_SEGURIDAD_MAX = 30


def dias_ventana_seguridad() -> int:
    """
    Días de limpieza después de la devolución. Sale del ajuste global (rol admin).
    Si no hay fila guardada, devuelve el valor por defecto.
    Se puede llamar dentro de un db_session ya abierto.
    """

    @db_session
    def _leer() -> int:
        fila = ConfiguracionSistema.select().first()
        if fila is None:
            return DIAS_VENTANA_SEGURIDAD_DEFAULT
        valor = int(fila.dias_ventana_seguridad)
        if valor < DIAS_VENTANA_SEGURIDAD_MIN or valor > DIAS_VENTANA_SEGURIDAD_MAX:
            return DIAS_VENTANA_SEGURIDAD_DEFAULT
        return valor

    return _leer()


def texto_dias(dias: int) -> str:
    if dias == 1:
        return "1 día"
    return f"{dias} días"


def explicacion_ventana_seguridad(dias: int | None = None) -> dict:
    """Textos que dicen de qué fecha del presupuesto sale cada tramo."""
    n = dias_ventana_seguridad() if dias is None else int(dias)
    if n == 0:
        cierre = (
            "Termina el día de la devolución. "
            "Al día siguiente ya se puede retirar."
        )
        marca = "el mismo día de la fecha de retiro"
    else:
        cierre = (
            f"Después de la devolución suma {texto_dias(n)} de limpieza. "
            "Esos días la prenda no puede salir. "
            "El próximo retiro puede ser el día siguiente a ese plazo."
        )
        marca = f"{texto_dias(n)} antes de la fecha de retiro"
    return {
        "dias": n,
        "inicio": (
            "Empieza el día de la fecha de retiro. "
            "Sale de la fecha de retiro del presupuesto. "
            "Si el presupuesto no tiene fecha de retiro, se usa la fecha del evento."
        ),
        "fin": (
            f"{cierre} "
            "El conteo sale de la fecha de devolución del presupuesto. "
            "Si no hay fecha de devolución, se usa la fecha del evento."
        ),
        "reservado_hoy": (
            f"En el listado de productos, la marca de reservado cubre desde {marca} "
            "hasta el día del retiro. Solo aparece si la prenda ya tiene seña."
        ),
    }


@db_session
def guardar_dias_ventana_seguridad(dias: int) -> dict:
    if isinstance(dias, bool) or not isinstance(dias, int):
        raise HTTPException(
            status_code=400,
            detail="La ventana tiene que ser un número entero de días.",
        )
    if dias < DIAS_VENTANA_SEGURIDAD_MIN or dias > DIAS_VENTANA_SEGURIDAD_MAX:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La ventana tiene que estar entre {DIAS_VENTANA_SEGURIDAD_MIN} "
                f"y {DIAS_VENTANA_SEGURIDAD_MAX} días."
            ),
        )
    fila = ConfiguracionSistema.select().first()
    if fila is None:
        ConfiguracionSistema(dias_ventana_seguridad=dias)
    else:
        fila.dias_ventana_seguridad = dias
    return explicacion_ventana_seguridad(dias)


def _as_date(d: date | datetime) -> date:
    if isinstance(d, datetime):
        from src.fechas_ar import instante_a_fecha_ar

        return instante_a_fecha_ar(d)
    return d


def _intervalos_solapan(a_ini: date, a_fin: date, b_ini: date, b_fin: date) -> bool:
    return a_ini <= b_fin and a_fin >= b_ini


def _fechas_alquiler_presupuesto(presupuesto) -> tuple[date, date]:
    retiro = _as_date(presupuesto.fecha_retiro or presupuesto.fecha_evento)
    devolucion = _as_date(presupuesto.fecha_devolucion or presupuesto.fecha_evento)
    return retiro, devolucion


def _rango_ocupacion(fecha_retiro: date, fecha_devolucion: date) -> tuple[date, date]:
    """
    La prenda está tomada desde el retiro hasta N días después de la devolución.

    Esos N días son la limpieza. Si devuelven el 12 y N es 2, no sale el 13
    ni el 14: el próximo retiro puede ser el 15. Entre la devolución y el
    nuevo retiro tienen que quedar esos N días.
    """
    inicio = _as_date(fecha_retiro)
    devolucion = _as_date(fecha_devolucion)
    fin = devolucion + timedelta(days=dias_ventana_seguridad())
    if fin < inicio:
        fin = inicio
    return inicio, fin


def _rango_bloqueo_presupuesto(presupuesto) -> tuple[date, date]:
    """Ocupación de un presupuesto activo, incluida la limpieza posterior."""
    retiro, devolucion = _fechas_alquiler_presupuesto(presupuesto)
    return _rango_ocupacion(retiro, devolucion)


def _rango_bloqueo_producto_reservado(producto_reservado) -> tuple[date, date]:
    """
    Ocupación de una orden con seña: [retiro, devolución + días de limpieza].
    Las fechas salen del presupuesto vigente, no del fecha_bloqueo guardado
    (ese valor puede ser de la ventana anterior).
    """
    orden = producto_reservado.orden_trabajo
    presupuesto = getattr(orden, "presupuesto", None) if orden else None
    if presupuesto is not None:
        return _rango_bloqueo_presupuesto(presupuesto)
    inicio = _as_date(producto_reservado.fecha_bloqueo)
    return inicio, inicio + timedelta(days=dias_ventana_seguridad())


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
    orden de trabajo con ProductoReservado y ref ∈ [retiro−días de ventana, retiro]
    (orden no cancelada).

    Un presupuesto pendiente **no** bloquea: la prenda se compromete al cobrar la seña
    (creación de orden y ProductoReservado).

    Debe ejecutarse dentro de un db_session activo (p. ej. desde ProductoServices).
    """
    dia = _as_date(ref) if ref is not None else hoy_ar()
    margen = dias_ventana_seguridad()
    out: set[int] = set()

    for pr in ProductoReservado.select():
        orden = pr.orden_trabajo
        if not orden:
            continue
        oest = (orden.estado or "").strip().lower()
        if oest in ("cancelada", "cancelado"):
            continue
        presupuesto = getattr(orden, "presupuesto", None)
        if presupuesto is not None:
            retiro = _as_date(presupuesto.fecha_retiro or presupuesto.fecha_evento)
            bi = retiro - timedelta(days=margen)
            bf = retiro
        else:
            bi = _as_date(pr.fecha_bloqueo)
            bf = bi + timedelta(days=margen)
        if bi <= dia <= bf:
            out.add(pr.producto.id)

    return out


def _orden_esta_cerrada(orden) -> bool:
    if not orden:
        return True
    return (orden.estado or "").strip().lower() in _ORDEN_CERRADA


def _info_reserva_venta(producto_reservado) -> dict:
    orden = producto_reservado.orden_trabajo
    presupuesto = getattr(orden, "presupuesto", None) if orden else None
    tit = titular_presupuesto(presupuesto) if presupuesto else {}
    retiro = None
    evento = None
    devolucion = None
    numero = None
    if presupuesto is not None:
        retiro = _as_date(presupuesto.fecha_retiro or presupuesto.fecha_evento)
        evento = _as_date(presupuesto.fecha_evento) if presupuesto.fecha_evento else None
        devolucion = _as_date(presupuesto.fecha_devolucion or presupuesto.fecha_evento)
        numero = presupuesto.numero
    return {
        "orden_id": orden.id if orden else None,
        "presupuesto_numero": numero,
        "cliente_nombre": tit.get("cliente_nombre"),
        "fecha_retiro": retiro.isoformat() if retiro else None,
        "fecha_evento": evento.isoformat() if evento else None,
        "fecha_devolucion": devolucion.isoformat() if devolucion else None,
    }


def reserva_activa_para_venta(producto_id: int) -> Optional[dict]:
    """
    Reserva que impide vender: ProductoReservado en orden no cancelada/completada.
    Un presupuesto pendiente sin seña no cuenta.
    Debe ejecutarse dentro de db_session.
    """
    candidatas = []
    for pr in ProductoReservado.select():
        if pr.producto.id != producto_id:
            continue
        if _orden_esta_cerrada(pr.orden_trabajo):
            continue
        candidatas.append(pr)
    if not candidatas:
        return None

    def _key(pr):
        info = _info_reserva_venta(pr)
        fr = info.get("fecha_retiro")
        if not fr:
            return date.max
        if isinstance(fr, date):
            return fr
        try:
            return date.fromisoformat(str(fr)[:10])
        except ValueError:
            return date.max

    return _info_reserva_venta(min(candidatas, key=_key))


def reservas_activas_para_venta_por_producto() -> dict[int, dict]:
    """Primera reserva (retiro más próximo) por producto. Dentro de db_session."""
    by_product: dict[int, list] = {}
    for pr in ProductoReservado.select():
        if _orden_esta_cerrada(pr.orden_trabajo):
            continue
        by_product.setdefault(pr.producto.id, []).append(pr)
    out: dict[int, dict] = {}
    for pid, lista in by_product.items():
        def _key(pr):
            info = _info_reserva_venta(pr)
            fr = info.get("fecha_retiro")
            if not fr:
                return date.max
            if isinstance(fr, date):
                return fr
            try:
                return date.fromisoformat(str(fr)[:10])
            except ValueError:
                return date.max

        out[pid] = _info_reserva_venta(min(lista, key=_key))
    return out


def _fmt_fecha(valor: str | date | None) -> str:
    if valor is None or valor == "":
        return ""
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    try:
        return date.fromisoformat(str(valor)[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return str(valor)


def _texto_limpieza(conflicto: dict) -> str:
    """Días en que la prenda no puede salir después de la devolución."""
    n = conflicto.get("dias_bloqueo")
    devolucion = conflicto.get("fecha_devolucion")
    if not isinstance(n, int) or n <= 0 or not devolucion:
        return ""
    try:
        dia_devolucion = date.fromisoformat(str(devolucion)[:10])
    except ValueError:
        return ""
    primero = dia_devolucion + timedelta(days=1)
    ultimo = dia_devolucion + timedelta(days=n)
    disponible = ultimo + timedelta(days=1)
    if n == 1:
        no_sale = f"la prenda no puede salir el {_fmt_fecha(primero)}"
    elif n == 2:
        no_sale = (
            f"la prenda no puede salir el {_fmt_fecha(primero)} "
            f"ni el {_fmt_fecha(ultimo)}"
        )
    else:
        no_sale = (
            f"la prenda no puede salir desde el {_fmt_fecha(primero)} "
            f"hasta el {_fmt_fecha(ultimo)}"
        )
    return (
        f" Lo devuelven el {_fmt_fecha(dia_devolucion)} y {no_sale}. "
        f"El próximo retiro puede ser desde el {_fmt_fecha(disponible)}."
    )


def _armar_conflicto(
    *,
    tipo: str,
    id_ref,
    numero,
    cliente,
    fecha_retiro: date,
    fecha_devolucion: date,
) -> dict:
    n = dias_ventana_seguridad()
    bloqueo_hasta = fecha_devolucion + timedelta(days=n)
    conflicto = {
        "tipo": tipo,
        "id": id_ref,
        "numero": numero,
        "cliente": cliente,
        "fecha_retiro": fecha_retiro.isoformat(),
        "fecha_devolucion": fecha_devolucion.isoformat(),
        "dias_bloqueo": n,
        "bloqueo_hasta": bloqueo_hasta.isoformat(),
        "disponible_desde": (bloqueo_hasta + timedelta(days=1)).isoformat(),
    }
    conflicto["mensaje"] = texto_conflicto_disponibilidad(conflicto)
    return conflicto


def _conflicto_orden(orden, presupuesto, ini: date, fin: date) -> dict:
    tit = titular_presupuesto(presupuesto) if presupuesto else {}
    if presupuesto is not None:
        retiro, devolucion = _fechas_alquiler_presupuesto(presupuesto)
    else:
        retiro, devolucion = ini, fin
    return _armar_conflicto(
        tipo="orden",
        id_ref=orden.id if orden else None,
        numero=presupuesto.numero if presupuesto else None,
        cliente=tit.get("cliente_nombre"),
        fecha_retiro=retiro,
        fecha_devolucion=devolucion,
    )


def texto_conflicto_disponibilidad(conflicto: Optional[dict]) -> str:
    if not conflicto:
        return "Conflicto con otro presupuesto u orden de trabajo."
    numero = conflicto.get("numero") or ""
    cliente = conflicto.get("cliente") or ""
    fr_txt = _fmt_fecha(conflicto.get("fecha_retiro"))
    fd_txt = _fmt_fecha(conflicto.get("fecha_devolucion"))
    fechas = f" del {fr_txt} al {fd_txt}" if fr_txt or fd_txt else ""
    quien = f" ({cliente})" if cliente else ""
    limpieza = _texto_limpieza(conflicto)
    if conflicto.get("tipo") == "orden":
        etiqueta = f"orden #{conflicto.get('id')}"
        if numero:
            etiqueta = f"{etiqueta} / {numero}"
        return f"ocupado por {etiqueta}{quien}{fechas}.{limpieza}".replace("..", ".")
    etiqueta = numero or f"presupuesto #{conflicto.get('id')}"
    return f"ocupado por {etiqueta}{quien}{fechas}.{limpieza}".replace("..", ".")


@db_session
def explicar_conflicto_disponibilidad(
    producto_id: int,
    fecha_retiro: date,
    fecha_devolucion: date,
    presupuesto_excluir_id: Optional[int] = None,
    orden_excluir_id: Optional[int] = None,
) -> Optional[dict]:
    """Primer conflicto de calendario, o None si está libre."""
    fecha_retiro = _as_date(fecha_retiro)
    fecha_devolucion = _as_date(fecha_devolucion)
    sol_ini, sol_fin = _rango_ocupacion(fecha_retiro, fecha_devolucion)

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
        pres = getattr(orden, "presupuesto", None)
        if (
            presupuesto_excluir_id is not None
            and pres is not None
            and pres.id == presupuesto_excluir_id
        ):
            continue

        r_ini, r_fin = _rango_bloqueo_producto_reservado(producto_reservado)
        if _intervalos_solapan(r_ini, r_fin, sol_ini, sol_fin):
            return _conflicto_orden(orden, pres, r_ini, r_fin)

    return None


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

    Bloquea por órdenes con seña (ProductoReservado), no por un presupuesto
    pendiente. La ocupación es [retiro, devolución + días de limpieza].
    Esos días extra son para procesar la ropa.

    No usa el estado físico actual (CLIENTE / MODISTA / LAVANDERÍA). Eso indica
    dónde está la prenda hoy, no si se puede comprometer para otra fecha.

    Args:
        producto_id: ID del producto a verificar
        fecha_retiro: Inicio del alquiler solicitado (retiro del cliente)
        fecha_devolucion: Fin del alquiler solicitado
        presupuesto_excluir_id: Al editar, excluir ítems del propio presupuesto.
        orden_excluir_id: Si se edita un presupuesto con orden, excluir sus propias reservas.

    Returns:
        True si el producto está disponible, False si está ocupado
    """
    try:
        return (
            explicar_conflicto_disponibilidad(
                producto_id,
                fecha_retiro,
                fecha_devolucion,
                presupuesto_excluir_id=presupuesto_excluir_id,
                orden_excluir_id=orden_excluir_id,
            )
            is None
        )
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
    presupuesto_excluir_id: Optional[int] = None,
    orden_excluir_id: Optional[int],
    es_reuso_del_mismo_presupuesto: bool,
    ignorar_conflicto_reserva: bool = False,
) -> None:
    """
    Valida el calendario de reservas. El estado físico de hoy (cliente, modista,
    lavandería) no impide armar un presupuesto para otra fecha. Sí bloquean
    inmovilizado y VENDIDO, salvo reutilización del mismo presupuesto.
    """
    desc = format_descripcion_producto(
        producto.descripcion, producto.descripcion_extra
    ) or f"#{producto.id}"
    if not ignorar_conflicto_reserva:
        conflicto = explicar_conflicto_disponibilidad(
            producto.id,
            fecha_retiro,
            fecha_devolucion,
            presupuesto_excluir_id=presupuesto_excluir_id,
            orden_excluir_id=orden_excluir_id,
        )
        if conflicto:
            raise HTTPException(
                status_code=400,
                detail=(
                    f'El producto "{desc}" no está disponible para la nueva fecha. '
                    f"Conflicto: {texto_conflicto_disponibilidad(conflicto).rstrip('.')}."
                ),
            )
    if es_reuso_del_mismo_presupuesto:
        return
    if getattr(producto, "inmovilizado", False):
        raise HTTPException(
            status_code=400,
            detail=f'El producto "{desc}" no está disponible (inmovilizado).',
        )
    if _estado_producto_codigo(producto.estado) == EstadoProducto.VENDIDO.value:
        raise HTTPException(
            status_code=400,
            detail=f'El producto "{desc}" no está disponible (vendido).',
        )


def reconstruir_productos_reservados_para_orden(orden, presupuesto) -> None:
    """
    Elimina ProductoReservado de la orden y los recrea según ítems del presupuesto
    (fecha_bloqueo = fecha_retiro_reserva − días de ventana), alineado con crear_orden_trabajo.
    Ejecutar dentro del mismo db_session que la edición del presupuesto.
    """
    fecha_retiro_reserva = presupuesto.fecha_retiro or presupuesto.fecha_evento
    for pr in list(orden.productos_reservados):
        pr.delete()
    for item in presupuesto.items:
        producto = item.producto
        fecha_bloqueo = fecha_retiro_reserva - timedelta(days=dias_ventana_seguridad())
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
