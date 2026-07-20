"""Firmante anexado opcional al registrar contrato (snapshot, no Cliente)."""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import OrdenTrabajo, Presupuesto, Roles
from src.schemas import FirmanteContratoSchema, ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_orden_pagada(w, total: float = 500.0):
    cu = fake_current_user(w.usuario.id)
    R = date(2035, 3, 10)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=3),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="FirmanteTest",
            nombre_agasajado="Titular",
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
        seña_pagada=total,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        o = Presupuesto.get(id=pid).orden_trabajo
        assert o is not None
        return o.id


def test_registrar_contrato_sin_firmante_deja_campos_vacios():
    w = seed_base_world()
    oid = _crear_orden_pagada(w)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)

    result = OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=admin)
    assert result["success"] is True
    assert result["data"]["tiene_firmante_anexo"] is False

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        assert not (o.firmante_nombre or "").strip()
        assert not (o.firmante_dni or "").strip()


def test_registrar_contrato_con_firmante_guarda_snapshot():
    w = seed_base_world()
    oid = _crear_orden_pagada(w)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)
    firmante = FirmanteContratoSchema(
        nombre="Juan Retira",
        dni="30111222",
        direccion="Av. Siempre Viva 742",
        celular="5491112345678",
    )

    result = OrdenTrabajoServices().registrar_contrato_generado(
        oid, usuario=admin, firmante=firmante
    )
    assert result["success"] is True
    assert result["data"]["tiene_firmante_anexo"] is True
    assert result["data"]["firmante_nombre"] == "Juan Retira"

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.firmante_nombre == "Juan Retira"
        assert o.firmante_dni == "30111222"
        assert o.firmante_direccion == "Av. Siempre Viva 742"
        assert o.firmante_celular == "5491112345678"
        # El titular del presupuesto no cambia
        assert o.presupuesto.cliente.nombre == "Ana"


def test_reimpresion_actualiza_o_limpia_firmante():
    w = seed_base_world()
    oid = _crear_orden_pagada(w)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)
    firmante = FirmanteContratoSchema(
        nombre="Primero",
        dni="111",
        direccion="Dir 1",
        celular=None,
    )
    OrdenTrabajoServices().registrar_contrato_generado(
        oid, usuario=admin, firmante=firmante
    )

    # Reimpresión con otro firmante
    otro = FirmanteContratoSchema(
        nombre="Segundo",
        dni="222",
        direccion="Dir 2",
        celular="123",
    )
    r2 = OrdenTrabajoServices().registrar_contrato_generado(
        oid, usuario=admin, firmante=otro
    )
    assert r2["data"]["reimpresion"] is True
    assert r2["data"]["firmante_nombre"] == "Segundo"

    # Reimpresión sin firmante → limpia
    r3 = OrdenTrabajoServices().registrar_contrato_generado(
        oid, usuario=admin, firmante=None
    )
    assert r3["data"]["tiene_firmante_anexo"] is False
    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert not (o.firmante_nombre or "").strip()
        assert o.contrato_generado_at is not None


def test_firmante_incompleto_rechaza():
    w = seed_base_world()
    oid = _crear_orden_pagada(w)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)
    incompleto = SimpleNamespace(nombre="Solo nombre", dni="  ", direccion="Calle", celular=None)
    with pytest.raises(HTTPException) as ei:
        OrdenTrabajoServices().registrar_contrato_generado(
            oid, usuario=admin, firmante=incompleto
        )
    assert ei.value.status_code == 400
    assert "firmante" in ei.value.detail.lower()


def test_obtener_orden_incluye_firmante():
    w = seed_base_world()
    oid = _crear_orden_pagada(w)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)
    OrdenTrabajoServices().registrar_contrato_generado(
        oid,
        usuario=admin,
        firmante=FirmanteContratoSchema(
            nombre="Retira",
            dni="999",
            direccion="Calle 1",
            celular="555",
        ),
    )
    data = OrdenTrabajoServices().obtener_orden_por_id(oid)
    assert data["tiene_firmante_anexo"] is True
    assert data["firmante_nombre"] == "Retira"
    assert data["cliente_nombre"].startswith("Ana") or "Ana" in data["cliente_nombre"]
