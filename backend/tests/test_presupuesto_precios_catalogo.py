"""Al editar, el ítem trae el precio guardado y, aparte, el catálogo del producto."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session

from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def test_presupuesto_separa_precio_guardado_del_catalogo():
    with db_session:
        w = seed_base_world()
        cliente_id = w.cliente.id
        producto_id = w.producto_a.id
        usuario_id = w.usuario.id

    R = date(2036, 8, 12)
    svc = PresupuestosServices()
    out = svc.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=cliente_id,
            fecha_evento=R,
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=3),
            categoria_evento="Casamiento",
            nombre_agasajado="Precios",
            lugar_evento="Salón",
            observaciones="",
            extra_discount_percentage=10,
            extra_discount_amount=18,
            items=[
                ItemPresupuestoIn(
                    producto_id=producto_id,
                    cantidad=1,
                    precio_unitario=162.0,
                    subtotal=162.0,
                )
            ],
        ),
        fake_current_user(usuario_id),
    )
    presupuesto_id = out["data"]["id"]

    def _assert_item(item):
        assert item.precio_unitario == 162.0
        assert item.precio_alquiler_lista == 200.0
        assert item.precio_alquiler_efectivo == 180.0
        assert item.precio_de_venta_medio_uso == 150.0
        assert item.precio_venta == 290.0
        assert item.precio_liquidacion == 100.0
        assert item.precio_venta_nuevo_lista == 300.0
        assert item.precio_venta_nuevo_efectivo == 280.0

    listado = svc.listar_presupuestos()
    guardado = next(p for p in listado if p.id == presupuesto_id)
    assert guardado.extra_discount_percentage == 10
    _assert_item(guardado.items[0])

    detalle = svc.obtener_presupuesto_por_id(presupuesto_id)
    assert detalle.extra_discount_percentage == 10
    _assert_item(detalle.items[0])
