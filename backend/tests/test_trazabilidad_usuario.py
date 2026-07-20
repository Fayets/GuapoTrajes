"""Trazabilidad por usuario: captura de responsable en acciones clave."""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from pony.orm import db_session, flush

from src.models import (
    AccionAuditoria,
    AuditoriaEvento,
    CuentaCorriente,
    Lavanderia,
    OrdenTrabajo,
    Presupuesto,
    ProductoLavanderia,
    Roles,
)
from src.schemas import CreditoManualRequest, ItemPresupuestoIn, PresupuestoCreate
from src.services.lavanderia_services import LavanderiaServices
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.pagos_services import PagosServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_presupuesto(w, total: float = 1000.0):
    cu = fake_current_user(w.usuario.id)
    R = date(2035, 3, 10)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=3),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="Trazabilidad",
            nombre_agasajado="Audit",
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
    return out["data"]["id"]


def test_presupuesto_guarda_creado_por_y_auditoria():
    w = seed_base_world()
    pid = _crear_presupuesto(w)

    with db_session:
        p = Presupuesto.get(id=pid)
        assert p is not None
        assert p.creado_por is not None
        assert p.creado_por.id == w.usuario.id
        eventos = [
            e
            for e in AuditoriaEvento.select()
            if e.accion == AccionAuditoria.PRESUPUESTO_CREADO.value
            and e.entidad_id == pid
        ]
        assert len(eventos) >= 1
        assert eventos[0].usuario.id == w.usuario.id


def test_contrato_guarda_generado_por():
    w = seed_base_world()
    pid = _crear_presupuesto(w, total=500.0)
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=500.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        oid = Presupuesto.get(id=pid).orden_trabajo.id

    admin = SimpleNamespace(id=w.usuario.id, rol=Roles.ADMIN)
    result = OrdenTrabajoServices().registrar_contrato_generado(oid, usuario=admin)
    assert result["success"] is True
    assert result["data"]["contrato_generado_por_id"] == w.usuario.id

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.contrato_generado_por is not None
        assert o.contrato_generado_por.id == w.usuario.id
        assert o.contrato_generado_at is not None


def test_devolucion_guarda_recibida_por():
    w = seed_base_world()
    pid = _crear_presupuesto(w, total=200.0)
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=200.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        o = Presupuesto.get(id=pid).orden_trabajo
        oid = o.id
        # Marcar contrato para que productos estén en CLIENTE (flujo real)
        o.contrato_generado_at = o.fecha_creacion
        flush()

    result = OrdenTrabajoServices().completar_devolucion(
        oid,
        w.usuario.id,
        destino="SALON",
    )
    assert result["success"] is True
    assert result["data"]["devolucion_recibida_por_id"] == w.usuario.id

    with db_session:
        o = OrdenTrabajo.get(id=oid)
        assert o.devolucion_recibida_por is not None
        assert o.devolucion_recibida_por.id == w.usuario.id
        assert o.devolucion_recibida_at is not None


def test_credito_manual_guarda_usuario_en_cc():
    w = seed_base_world()
    out = PagosServices().registrar_credito_manual(
        CreditoManualRequest(
            cliente_id=w.cliente.id,
            monto=150.0,
            concepto="Crédito test trazabilidad",
            registrar_en_caja=False,
        ),
        w.usuario.id,
    )
    mov_id = out["movimiento_id"]
    with db_session:
        mov = CuentaCorriente.get(id=mov_id)
        assert mov is not None
        assert mov.usuario is not None
        assert mov.usuario.id == w.usuario.id


def test_regresar_lavanderia_guarda_recibido_por():
    w = seed_base_world()
    with db_session:
        lav = Lavanderia(nombre=f"Lav Test {w.usuario.id}", telefono="111", direccion="X")
        flush()
        lav_id = lav.id
        prod_id = w.producto_a.id

    LavanderiaServices().asignar_producto(
        lav_id, prod_id, usuario_id=w.usuario.id
    )
    LavanderiaServices().regresar_producto_de_lavanderia(
        prod_id, usuario_id=w.usuario.id
    )

    with db_session:
        pls = [
            pl
            for pl in ProductoLavanderia.select()
            if pl.producto.id == prod_id and pl.fecha_salida is not None
        ]
        assert pls
        assert pls[0].enviado_por is not None
        assert pls[0].enviado_por.id == w.usuario.id
        assert pls[0].recibido_por is not None
        assert pls[0].recibido_por.id == w.usuario.id
