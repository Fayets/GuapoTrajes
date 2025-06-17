from pony.orm import db_session, select
from datetime import date
from src.models import ItemPresupuesto

@db_session
def verificar_disponibilidad(producto_id: int, fecha_retiro: date, fecha_devolucion: date) -> bool:
    reservas = select(pp for pp in ItemPresupuesto if
        pp.producto.id == producto_id and
        pp.presupuesto.estado == "aprobado"
    )[:]

    for pp in reservas:
        fecha_inicio = pp.presupuesto.fecha_evento
        fecha_fin = pp.presupuesto.fecha_devolucion or pp.presupuesto.fecha_evento

        if fecha_inicio <= fecha_devolucion and fecha_fin >= fecha_retiro:
            return False

    return True
