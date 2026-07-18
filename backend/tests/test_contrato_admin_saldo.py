"""Admin puede registrar contrato con saldo pendiente; empleado no."""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pony.orm import db_session, flush

from src.models import OrdenTrabajo, Presupuesto, Roles, Usuario, Sucursal
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_orden_con_saldo(w, seña: float, total: float):
    cu = fake_current_user(w.usuario.id)
    R = date(2034, 2, 10)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=3),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="SaldoTest",
            nombre_agasajado="Saldo",
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
        seña_pagada=seña,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        o = Presupuesto.get(id=pid).orden_trabajo
        assert o is not None
        assert float(o.saldo_pendiente) > 0
        return o.id


def test_admin_puede_registrar_contrato_con_saldo_pendiente():
    w = seed_base_world()
    oid = _crear_orden_con_saldo(w, seña=100.0, total=1000.0)
    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)

    result = OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=admin)
    assert result["success"] is True

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        assert float(o.saldo_pendiente) > 0
        o.contrato_generado_at = None
        flush()


def test_super_admin_puede_registrar_contrato_con_saldo_pendiente():
    w = seed_base_world()
    oid = _crear_orden_con_saldo(w, seña=50.0, total=500.0)
    sa = SimpleNamespace(id=w.usuario.id, rol=Roles.SUPER_ADMIN)

    result = OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=sa)
    assert result["success"] is True

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        o.contrato_generado_at = None
        flush()


def test_empleado_no_puede_registrar_contrato_con_saldo_pendiente():
    w = seed_base_world()
    oid = _crear_orden_con_saldo(w, seña=100.0, total=800.0)

    with db_session:
        sucursal = Sucursal.get(id=w.sucursal_id)
        emp_user = Usuario(
            username=f"emp_{oid}_{w.usuario.id}",
            email=f"emp_{oid}_{w.usuario.id}@test.local",
            password="x",
            nombre="Emp",
            apellido="Test",
            rol=Roles.EMPLEADO,
            sucursal=sucursal,
        )
        flush()
        emp_id = emp_user.id

    emp = SimpleNamespace(id=emp_id)

    with pytest.raises(HTTPException) as ei:
        OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=emp)
    assert ei.value.status_code == 400
    assert "saldo pendiente" in ei.value.detail.lower()

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is None
        # limpiar usuario de prueba
        u = Usuario.get(id=emp_id)
        if u:
            u.delete()
        flush()


def test_usuario_sin_rol_en_objeto_se_resuelve_por_id_admin():
    """Regresión: si el usuario solo trae id, se relee el rol ADMIN desde BD."""
    w = seed_base_world()
    oid = _crear_orden_con_saldo(w, seña=200.0, total=900.0)
    solo_id = SimpleNamespace(id=w.usuario.id)

    result = OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=solo_id)
    assert result["success"] is True

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        o.contrato_generado_at = None
        flush()


def test_api_admin_registrar_contrato_con_saldo():
    """HTTP: ADMIN autenticado puede POST /registrar-contrato con deuda."""
    from fastapi.testclient import TestClient
    from jose import jwt
    from main import app
    from src.security import SECRET_KEY, ALGORITHM

    w = seed_base_world()
    oid = _crear_orden_con_saldo(w, seña=150.0, total=1000.0)
    token = jwt.encode(
        {"sub": str(w.usuario.id), "type": "access"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    client = TestClient(app)
    res = client.post(
        f"/ordenes/{oid}/registrar-contrato",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body.get("success") is True

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_at is not None
        o.contrato_generado_at = None
        flush()
