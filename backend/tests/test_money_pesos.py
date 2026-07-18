"""Montos en pesos enteros: no deben degradarse (ej. 7000 → 6999, 40059 → 40058)."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.models import CajaMovimiento, MetodoPagoConfigurable, OrdenTrabajo, Presupuesto, ReciboOrden
from src.money import round_pesos
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def test_round_pesos_no_degrada_enteros_ni_casi_enteros():
    assert round_pesos(7000) == 7000.0
    assert round_pesos(7000.0) == 7000.0
    assert round_pesos(6999.999999999) == 7000.0
    assert round_pesos(7000.4) == 7000.0
    # HALF_UP (alineado con Math.round de JS): .5 sube
    assert round_pesos(7000.5) == 7001.0
    assert round_pesos(None) == 0.0
    # Acumulación típica de float que a veces deja 6999.999...
    x = sum(1.0 for _ in range(7000))
    assert round_pesos(x) == 7000.0
    # Resta que produce float “sucio”
    assert round_pesos(10000.0 - 3000.0000000001) == 7000.0


def test_round_pesos_40058_5_no_baja_a_40058():
    """Caso reportado: $40.059 mostrado en UI no debe guardarse como $40.058.

    Python ``round(40058.5)`` (bancario) da 40058; nosotros usamos HALF_UP → 40059
    como ``Math.round`` en el frontend.
    """
    assert round(40058.5) == 40058  # documenta el bug de round() nativo
    assert round_pesos(40058.5) == 40059.0
    assert round_pesos(40059) == 40059.0
    assert round_pesos(40059.0) == 40059.0
    assert round_pesos(40058.999999999) == 40059.0


def test_sena_7000_se_guarda_exacta_en_orden_y_caja():
    """Reproduce el caso reportado: seña $7.000 no debe quedar en $6.999."""
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    R = date(2032, 6, 1)
    total = 15000.0
    sena = 7000.0

    with db_session:
        from src.models import Sucursal

        sucursal = Sucursal.get(id=w.sucursal_id)
        metodo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Efectivo money test",
            activo=True,
            tiene_submetodos=False,
            orden=1,
        )
        flush()
        metodo_id = metodo.id

    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=5),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=8),
            categoria_evento="MoneyTest",
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
        assert o is not None
        assert float(o.seña_pagada) == 7000.0
        assert float(o.saldo_pendiente) == 8000.0
        origen_esperado = f"SEÑA_PRESUPUESTO:{p.numero}"
        movs = [
            m
            for m in list(CajaMovimiento.select())
            if (m.origen or "") == origen_esperado
        ]
        assert len(movs) == 1
        assert float(movs[0].monto) == 7000.0


def test_pago_adicional_7000_no_degrada_saldo():
    """Pago parcial de $7.000 sobre saldo pendiente debe restar exacto."""
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    R = date(2032, 7, 1)
    total = 20000.0

    with db_session:
        from src.models import Sucursal

        sucursal = Sucursal.get(id=w.sucursal_id)
        metodo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Efectivo pago test",
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
            categoria_evento="MoneyPago",
            nombre_agasajado="Pago",
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
    svc = OrdenTrabajoServices()
    svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=5000.0,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )

    with db_session:
        oid = Presupuesto.get(id=pid).orden_trabajo.id

    svc.registrar_pago_saldo(
        orden_id=oid,
        monto_pagado=7000.0,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        # seña_pagada acumula seña + pagos adicionales
        assert float(o.seña_pagada) == 12000.0
        # 20000 - 5000 seña - 7000 pago = 8000
        assert float(o.saldo_pendiente) == 8000.0
        montos_7000 = [
            float(m.monto)
            for m in list(CajaMovimiento.select())
            if abs(float(m.monto) - 7000.0) < 1e-9
        ]
        assert len(montos_7000) >= 1
        assert all(m == 7000.0 for m in montos_7000)


def test_pago_40059_no_queda_en_40058():
    """Reproduce el caso: pago de $40.059 no debe registrarse como $40.058."""
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    R = date(2032, 8, 1)
    total = 100000.0
    sena = 20000.0

    with db_session:
        from src.models import Sucursal

        sucursal = Sucursal.get(id=w.sucursal_id)
        metodo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Efectivo 40059",
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
            categoria_evento="Money40059",
            nombre_agasajado="Pago40059",
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
    svc = OrdenTrabajoServices()
    svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=sena,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )

    with db_session:
        p = Presupuesto.get(id=pid)
        oid = p.orden_trabajo.id
        origen_pago = f"PAGO_ADICIONAL_ORDEN:{p.numero}"

    # Float .5 que el UI mostraría como 40059 con Math.round, pero round() de
    # Python guardaría 40058 — round_pesos debe subir a 40059.
    svc.registrar_pago_saldo(
        orden_id=oid,
        monto_pagado=40058.5,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert float(o.seña_pagada) == sena + 40059.0
        assert float(o.saldo_pendiente) == total - sena - 40059.0
        movs = [
            m
            for m in list(CajaMovimiento.select())
            if (m.origen or "") == origen_pago
        ]
        assert len(movs) == 1
        assert float(movs[0].monto) == 40059.0
        assert 40058.0 not in [float(m.monto) for m in movs]
        recibos = [
            r
            for r in list(ReciboOrden.select())
            if r.orden_trabajo.id == oid and abs(float(r.monto) - 40059.0) < 1e-9
        ]
        assert len(recibos) >= 1

    # Segundo pago entero exacto $40.059 (saldo restante alcanza)
    svc.registrar_pago_saldo(
        orden_id=oid,
        monto_pagado=30000.0,
        payment_method=None,
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
        metodo_pago_id=metodo_id,
    )

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert float(o.seña_pagada) == sena + 40059.0 + 30000.0
        assert float(o.saldo_pendiente) == total - sena - 40059.0 - 30000.0
        montos_extra = sorted(
            float(m.monto)
            for m in list(CajaMovimiento.select())
            if (m.origen or "") == origen_pago
        )
        assert montos_extra == [30000.0, 40059.0]
