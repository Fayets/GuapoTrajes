"""Reparación de contrato_generado_at guardados en UTC (02/07 → 03/07)."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from pony.orm import db_session, flush

from src.fechas_ar import (
    instante_a_fecha_ar,
    isoformat_ar,
    parece_timestamp_utc_tras_medianoche,
    utc_naive_a_ar_naive,
)
from src.migrations import reparar_contratos_generados_hora_ar
from src.models import OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def test_heuristica_detecta_utc_tras_medianoche_no_toca_ar():
    # 02/07 22:30 AR guardado mal como UTC → 03/07 01:30 naive
    utc_bug = datetime(2026, 7, 3, 1, 30, 0)
    assert parece_timestamp_utc_tras_medianoche(utc_bug) is True
    fixed = utc_naive_a_ar_naive(utc_bug)
    assert fixed == datetime(2026, 7, 2, 22, 30, 0)
    assert instante_a_fecha_ar(fixed) == date(2026, 7, 2)

    # Ya en hora AR: no tocar
    ar_ok = datetime(2026, 7, 2, 22, 30, 0)
    assert parece_timestamp_utc_tras_medianoche(ar_ok) is False

    # Después de corregir: no vuelve a tocar
    assert parece_timestamp_utc_tras_medianoche(fixed) is False


def test_reparar_contratos_corrige_y_limpia_dato_de_prueba():
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    R = date(2033, 1, 15)

    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=3),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="RepairTest",
            nombre_agasajado="Repair",
            lugar_evento="Local",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=50.0,
                    subtotal=50.0,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    svc = OrdenTrabajoServices()
    svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )

    with db_session:
        oid = Presupuesto.get(id=pid).orden_trabajo.id

    svc.registrar_contrato_generado(oid, usuario=cu)

    # Simular bug: UTC naive (03/07 01:45) en vez de AR (02/07 22:45)
    with db_session:
        o = OrdenTrabajo.get(id=oid)
        o.contrato_generado_at = datetime(2026, 7, 3, 1, 45, 0)
        flush()

    n = reparar_contratos_generados_hora_ar()
    assert n >= 1

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at == datetime(2026, 7, 2, 22, 45, 0)
        assert instante_a_fecha_ar(o.contrato_generado_at) == date(2026, 7, 2)
        assert isoformat_ar(o.contrato_generado_at).startswith("2026-07-02T22:45:00")
        assert parece_timestamp_utc_tras_medianoche(o.contrato_generado_at) is False

    # Idempotente
    assert reparar_contratos_generados_hora_ar() == 0

    # Limpiar marca de contrato de prueba
    with db_session:
        o = OrdenTrabajo.get(id=oid)
        if o:
            o.contrato_generado_at = None
            flush()
