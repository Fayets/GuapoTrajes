from pony.orm import db_session, select
from src.models import OrdenTrabajo, ProductoReservado, Presupuesto, Producto
from datetime import datetime, timedelta

@db_session
def crear_orden_trabajo(presupuesto_id: int, seña_pagada: float):
    presupuesto = Presupuesto.get(id=presupuesto_id)
    if not presupuesto:
        raise ValueError("Presupuesto no encontrado")

    total = presupuesto.total
    saldo_pendiente = total - seña_pagada
    fecha_bloqueo = presupuesto.fecha_evento - timedelta(days=5)

    orden = OrdenTrabajo(
        presupuesto=presupuesto,
        fecha_evento=presupuesto.fecha_evento,
        seña_pagada=seña_pagada,
        saldo_pendiente=saldo_pendiente
    )
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
    return orden


@db_session
def listar_ordenes_trabajo():
    ordenes = OrdenTrabajo.select()[:]
    return [
        {
            "id": o.id,
            "presupuesto_id": o.presupuesto.id,
            "fecha_evento": o.fecha_evento.isoformat(),
            "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else "",
            "seña_pagada": o.seña_pagada,
            "saldo_pendiente": o.saldo_pendiente,
            "estado": o.estado,
            "productos_reservados": [
                {
                    "producto_id": pr.producto.id,
                    "estado": pr.estado,
                    "fecha_bloqueo": pr.fecha_bloqueo.isoformat(),
                    "observaciones": pr.observaciones,
                }
                for pr in o.productos_reservados
            ],
        }
        for o in ordenes
    ]


@db_session
def obtener_ordenes_para_semana(fecha_base: datetime):
    lunes = fecha_base - timedelta(days=fecha_base.weekday())
    domingo = lunes + timedelta(days=6)

    return select(o for o in OrdenTrabajo if lunes <= o.fecha_evento <= domingo)[:]


