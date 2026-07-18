"""Al eliminar una orden, la seña/pagos en caja deben anularse (EGRESO)."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.models import CajaMovimiento, MetodoPagoConfigurable, OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_orden_con_sena(w, total: float = 20000.0, sena: float = 7000.0):
    cu = fake_current_user(w.usuario.id)
    R = date(2036, 4, 1)

    with db_session:
        from src.models import Sucursal

        sucursal = Sucursal.get(id=w.sucursal_id)
        metodo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Efectivo anular seña",
            activo=True,
            tiene_submetodos=False,
            orden=1,
        )
        flush()
        metodo_id = metodo.id

    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=4),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=9),
            categoria_evento="AnularSena",
            nombre_agasajado="Test",
            lugar_evento="Local",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
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
        seña_pagada=sena,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )
    with db_session:
        p = Presupuesto.get(id=pid)
        o = p.orden_trabajo
        return {
            "presupuesto_id": pid,
            "orden_id": o.id,
            "numero": p.numero,
            "sena": sena,
            "metodo_id": metodo_id,
        }


def _cleanup(ids: dict) -> None:
    with db_session:
        # Orden puede ya estar borrada; limpiar presupuestos y movimientos de prueba
        o = OrdenTrabajo.get(id=ids["orden_id"])
        if o:
            for r in list(o.recibos):
                r.delete()
            for pr in list(o.productos_reservados):
                pr.delete()
            o.delete()
        p = Presupuesto.get(id=ids["presupuesto_id"])
        if p:
            for item in list(p.items):
                item.delete()
            p.delete()
        # Movimientos de caja de la prueba
        for cm in list(CajaMovimiento.select()):
            origen = cm.origen or ""
            if (
                f"SEÑA_PRESUPUESTO:{ids['numero']}" in origen
                or f"ANULACION_ORDEN:{ids['orden_id']}:" in origen
                or f"PAGO_ADICIONAL_ORDEN:{ids['numero']}" in origen
            ):
                cm.delete()


def test_eliminar_orden_anula_sena_en_caja():
    """Reproduce el bug: borrar orden debe generar EGRESO por la seña."""
    w = seed_base_world()
    ids = _crear_orden_con_sena(w, total=20000.0, sena=7000.0)
    try:
        origen_sena = f"SEÑA_PRESUPUESTO:{ids['numero']}"
        with db_session:
            ingresos = [
                m
                for m in list(CajaMovimiento.select())
                if (m.origen or "") == origen_sena
            ]
            assert len(ingresos) == 1
            assert float(ingresos[0].monto) == 7000.0
            tipo_ing = ingresos[0].tipo.value if hasattr(ingresos[0].tipo, "value") else str(ingresos[0].tipo)
            assert tipo_ing == "INGRESO"

        result = OrdenTrabajoServices().eliminar_orden_trabajo(
            ids["orden_id"], w.usuario.id
        )
        assert result["success"] is True
        assert float(result["data"]["monto_anulado_caja"]) == 7000.0

        with db_session:
            assert OrdenTrabajo.get(id=ids["orden_id"]) is None
            p = Presupuesto.get(id=ids["presupuesto_id"])
            assert p is not None
            assert p.estado == "cancelada"

            egresos = [
                m
                for m in list(CajaMovimiento.select())
                if (m.origen or "").startswith(f"ANULACION_ORDEN:{ids['orden_id']}:")
            ]
            assert len(egresos) == 1
            assert float(egresos[0].monto) == 7000.0
            tipo_eg = egresos[0].tipo.value if hasattr(egresos[0].tipo, "value") else str(egresos[0].tipo)
            assert tipo_eg == "EGRESO"

            # Neto de la seña en caja: +7000 ingreso -7000 egreso = 0
            movs_sena = [
                m
                for m in list(CajaMovimiento.select())
                if (m.origen or "") == origen_sena
                or (m.origen or "").startswith(f"ANULACION_ORDEN:{ids['orden_id']}:")
            ]
            neto = 0.0
            for m in movs_sena:
                t = m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo)
                if t == "INGRESO":
                    neto += float(m.monto)
                elif t == "EGRESO":
                    neto -= float(m.monto)
            assert abs(neto) < 1e-9
    finally:
        _cleanup(ids)


def test_eliminar_orden_tambien_anula_pago_adicional():
    w = seed_base_world()
    ids = _crear_orden_con_sena(w, total=20000.0, sena=5000.0)
    try:
        with db_session:
            from src.models import Sucursal

            metodo_id = ids["metodo_id"]

        OrdenTrabajoServices().registrar_pago_saldo(
            orden_id=ids["orden_id"],
            monto_pagado=3000.0,
            payment_method=None,
            usuario_id=w.usuario.id,
            cuenta_destino_id=w.cuenta_destino.id,
            metodo_pago_id=metodo_id,
        )

        result = OrdenTrabajoServices().eliminar_orden_trabajo(
            ids["orden_id"], w.usuario.id
        )
        assert result["success"] is True
        # 5000 seña + 3000 pago adicional
        assert float(result["data"]["monto_anulado_caja"]) == 8000.0

        with db_session:
            egresos = [
                m
                for m in list(CajaMovimiento.select())
                if (m.origen or "").startswith(f"ANULACION_ORDEN:{ids['orden_id']}:")
            ]
            montos = sorted(float(m.monto) for m in egresos)
            assert montos == [3000.0, 5000.0]
    finally:
        _cleanup(ids)
