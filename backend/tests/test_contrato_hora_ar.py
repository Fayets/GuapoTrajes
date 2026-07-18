"""
Regresión: contratos/fechas no deben pasar de 02/07 a 03/07 por UTC
después de las 00:00 UTC (21:00 Argentina).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from pony.orm import db_session

from src.fechas_ar import (
    ahora_ar,
    hoy_ar,
    instante_a_fecha_ar,
    isoformat_ar,
)
from src.models import OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


UTC = ZoneInfo("UTC")


def test_despues_medianoche_utc_sigue_siendo_2_julio_en_argentina():
    """02/07 22:00 ART = 03/07 01:00 UTC → día civil en AR debe ser 02/07."""
    utc_despues_00 = datetime(2026, 7, 3, 1, 0, 0, tzinfo=UTC)
    assert instante_a_fecha_ar(utc_despues_00) == date(2026, 7, 2)

    naive_ar = datetime(2026, 7, 2, 22, 30, 0)
    assert instante_a_fecha_ar(naive_ar) == date(2026, 7, 2)
    assert isoformat_ar(naive_ar) == "2026-07-02T22:30:00-03:00"

    # date del instante UTC fallaría (día 03); AR debe quedar en 02
    assert utc_despues_00.date() == date(2026, 7, 3)
    assert utc_despues_00.date() != instante_a_fecha_ar(utc_despues_00)


def test_ahora_ar_y_hoy_ar_usan_zona_argentina(monkeypatch):
    """Simula reloj del servidor en UTC a las 01:30 del 03/07 (= 22:30 del 02/07 AR)."""
    instante_utc = datetime(2026, 7, 3, 1, 30, 0, tzinfo=UTC)

    class _DT:
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return instante_utc.replace(tzinfo=None)
            return instante_utc.astimezone(tz)

    monkeypatch.setattr("src.fechas_ar.datetime", _DT)

    assert hoy_ar() == date(2026, 7, 2)
    ahora = ahora_ar()
    assert ahora.tzinfo is None
    assert ahora.date() == date(2026, 7, 2)
    assert ahora.hour == 22
    assert ahora.minute == 30


def test_registrar_contrato_despues_00_utc_guarda_fecha_2_julio():
    """contrato_generado_at no debe quedar en 03/07 por el reloj UTC del servidor."""
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    R = date(2032, 8, 10)

    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=3),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="FechaTest",
            nombre_agasajado="Fecha",
            lugar_evento="Local",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    svc = OrdenTrabajoServices()
    svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=100.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )

    with db_session:
        oid = Presupuesto.get(id=pid).orden_trabajo.id

    # 02/07/2026 22:45 Argentina (ya es 03/07 01:45 UTC)
    fijo = datetime(2026, 7, 2, 22, 45, 0)
    with patch("src.services.orden_trabajo_services.ahora_ar", return_value=fijo):
        result = svc.registrar_contrato_generado(oid, usuario=cu)

    assert result["success"] is True
    iso = result["data"]["contrato_generado_at"]
    assert iso.startswith("2026-07-02T22:45:00")
    assert "-03:00" in iso

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        assert instante_a_fecha_ar(o.contrato_generado_at) == date(2026, 7, 2)
        assert isoformat_ar(o.contrato_generado_at).startswith("2026-07-02")
