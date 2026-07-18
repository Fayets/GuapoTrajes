"""Lavandería: ingresos duplicados no deben bloquear el regreso al salón."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.models import EstadoProducto, Lavanderia, Producto, ProductoLavanderia
from src.services.lavanderia_services import LavanderiaServices
from tests.factories import seed_base_world


def _cleanup(ids: dict) -> None:
    with db_session:
        for pl in list(ProductoLavanderia.select()):
            if pl.producto.id == ids.get("producto_id") or pl.lavanderia.id == ids.get(
                "lavanderia_id"
            ):
                pl.delete()
        if ids.get("lavanderia_id"):
            lav = Lavanderia.get(id=ids["lavanderia_id"])
            if lav:
                lav.delete()
        if ids.get("producto_id"):
            p = Producto.get(id=ids["producto_id"])
            if p:
                p.estado = EstadoProducto.SALON
                p.inmovilizado = False


def test_regresar_con_ingresos_duplicados_cierra_todos_y_vuelve_a_salon():
    """Reproduce el bug de los zapatos: mismo producto con 2 ingresos abiertos."""
    world = seed_base_world()
    ids: dict = {"producto_id": world.producto_a_id, "lavanderia_id": None}
    try:
        with db_session:
            lav = Lavanderia(
                nombre="Lav test zapatos",
                telefono="1100000000",
                direccion="Calle test",
            )
            flush()
            ids["lavanderia_id"] = lav.id
            producto = Producto.get(id=world.producto_a_id)
            producto.estado = EstadoProducto.LAVANDERIA
            producto.inmovilizado = False
            # Dos ingresos abiertos (como al devolver dos veces sin cerrar el anterior)
            ProductoLavanderia(
                producto=producto,
                lavanderia=lav,
                fecha_ingreso=date.today() - timedelta(days=5),
                notas="Devolución orden #127",
                cliente_nombre="GONZALEZ LUCAS",
            )
            ProductoLavanderia(
                producto=producto,
                lavanderia=lav,
                fecha_ingreso=date.today() - timedelta(days=5),
                notas="Devolución orden #161",
                cliente_nombre="ROBLEDO PABLO",
            )
            flush()

        svc = LavanderiaServices()

        # El listado debe mostrar UNA sola fila (no dos checkboxes sincronizados)
        listado = svc.get_productos_lavanderia(lavanderia_id=ids["lavanderia_id"])
        del_mismo = [p for p in listado if p["id"] == world.producto_a_id]
        assert len(del_mismo) == 1

        # Antes fallaba con MultipleObjectsFoundError → 0 regresados, N con aviso
        resultado = svc.regresar_varios_de_lavanderia([world.producto_a_id, world.producto_a_id])
        assert len(resultado["data"]["regresados"]) == 1
        assert resultado["data"]["regresados"][0] == world.producto_a_id
        assert resultado["data"]["errores"] == []

        with db_session:
            producto = Producto.get(id=world.producto_a_id)
            assert producto.estado == EstadoProducto.SALON
            abiertos = [
                pl
                for pl in list(ProductoLavanderia.select())
                if pl.producto.id == world.producto_a_id and pl.fecha_salida is None
            ]
            assert abiertos == []
    finally:
        _cleanup(ids)


def test_nueva_devolucion_a_lavanderia_cierra_ingreso_previo():
    """Al enviar de nuevo a lavandería no deben quedar dos ingresos abiertos."""
    world = seed_base_world()
    ids: dict = {"producto_id": world.producto_a_id, "lavanderia_id": None}
    try:
        with db_session:
            lav = Lavanderia(nombre="Lav test no dup", telefono="11", direccion="x")
            flush()
            ids["lavanderia_id"] = lav.id

        svc = LavanderiaServices()
        svc.asignar_producto(
            lavanderia_id=ids["lavanderia_id"],
            producto_id=world.producto_a_id,
            notas="Primera",
            cliente_nombre="Cliente A",
        )
        svc.asignar_producto(
            lavanderia_id=ids["lavanderia_id"],
            producto_id=world.producto_a_id,
            notas="Segunda",
            cliente_nombre="Cliente B",
        )

        with db_session:
            abiertos = [
                pl
                for pl in list(ProductoLavanderia.select())
                if pl.producto.id == world.producto_a_id and pl.fecha_salida is None
            ]
            assert len(abiertos) == 1
            assert (abiertos[0].notas or "") == "Segunda"
    finally:
        _cleanup(ids)
