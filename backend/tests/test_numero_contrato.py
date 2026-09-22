"""Numeración secuencial de contratos impresos (desde 500)."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.models import OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import CONTRATO_NUMERO_INICIAL, OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_orden_pagada(w, *, producto_id: int, retiro: date, total: float = 1000.0) -> int:
    cu = fake_current_user(w.usuario.id)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=retiro + timedelta(days=3),
            fecha_retiro=retiro,
            fecha_devolucion=retiro + timedelta(days=7),
            categoria_evento="ContratoNum",
            nombre_agasajado="Test",
            lugar_evento="Local",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=producto_id,
                    cantidad=1,
                    precio_unitario=total,
                    subtotal=total,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=total,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        o = Presupuesto.get(id=pid).orden_trabajo
        assert o is not None
        assert float(o.saldo_pendiente) == 0
        return o.id


def test_primer_contrato_usa_500_y_el_siguiente_501():
    w = seed_base_world()
    admin = fake_current_user(w.usuario.id)
    svc = OrdenTrabajoServices()

    oid1 = _crear_orden_pagada(w, producto_id=w.producto_a.id, retiro=date(2034, 3, 10))
    oid2 = _crear_orden_pagada(w, producto_id=w.producto_b.id, retiro=date(2034, 4, 10))

    r1 = svc.registrar_contrato_generado(oid1, usuario=admin)
    r2 = svc.registrar_contrato_generado(oid2, usuario=admin)

    assert r1["data"]["numero_contrato"] == CONTRATO_NUMERO_INICIAL
    assert r2["data"]["numero_contrato"] == CONTRATO_NUMERO_INICIAL + 1

    with db_session:
        assert OrdenTrabajo[oid1].numero_contrato == CONTRATO_NUMERO_INICIAL
        assert OrdenTrabajo[oid2].numero_contrato == CONTRATO_NUMERO_INICIAL + 1
        OrdenTrabajo[oid1].numero_contrato = None
        OrdenTrabajo[oid2].numero_contrato = None
        OrdenTrabajo[oid1].contrato_generado_at = None
        OrdenTrabajo[oid2].contrato_generado_at = None
        flush()


def test_reimpresion_no_cambia_numero_contrato():
    w = seed_base_world()
    admin = fake_current_user(w.usuario.id)
    svc = OrdenTrabajoServices()
    oid = _crear_orden_pagada(w, producto_id=w.producto_a.id, retiro=date(2034, 5, 10))

    r1 = svc.registrar_contrato_generado(oid, usuario=admin)
    numero = r1["data"]["numero_contrato"]
    assert numero is not None

    r2 = svc.registrar_contrato_generado(oid, usuario=admin)
    assert r2["data"]["reimpresion"] is True
    assert r2["data"]["numero_contrato"] == numero

    with db_session:
        assert OrdenTrabajo[oid].numero_contrato == numero
        OrdenTrabajo[oid].numero_contrato = None
        OrdenTrabajo[oid].contrato_generado_at = None
        flush()
