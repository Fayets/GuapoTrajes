"""No se puede guardar presupuesto ni tomar seña sin fecha de devolución."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session, flush
from pydantic import ValidationError

from src.models import Cliente, ItemPresupuesto, Presupuesto, Producto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _item(producto_id: int) -> ItemPresupuestoIn:
    return ItemPresupuestoIn(
        producto_id=producto_id,
        cantidad=1,
        precio_unitario=80.0,
        subtotal=80.0,
    )


def test_schema_rechaza_presupuesto_sin_fecha_devolucion():
    evento = date(2036, 4, 10)
    with pytest.raises(ValidationError) as ei:
        PresupuestoCreate(
            cliente_id=1,
            fecha_evento=evento,
            fecha_retiro=evento,
            fecha_devolucion=None,
            categoria_evento="Casamiento",
            nombre_agasajado="Test",
            lugar_evento="Salón",
            observaciones="",
            items=[_item(1)],
        )
    assert "fecha de devolución" in str(ei.value).lower()


def test_crear_presupuesto_sin_fecha_devolucion_rechaza():
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    evento = date(2036, 4, 10)
    data = PresupuestoCreate.model_construct(
        cliente_id=w.cliente.id,
        fecha_evento=evento,
        fecha_retiro=evento,
        fecha_devolucion=None,
        categoria_evento="Casamiento",
        nombre_agasajado="Test",
        lugar_evento="Salón",
        observaciones="",
        items=[_item(w.producto_a.id)],
        extra_discount_percentage=None,
        extra_discount_amount=None,
        extra_discount_reason=None,
        ignorar_conflictos_reserva=False,
    )
    with pytest.raises(HTTPException) as ei:
        PresupuestosServices().crear_presupuesto(data, cu)
    assert ei.value.status_code == 400
    assert "devolución" in ei.value.detail.lower()


def test_editar_presupuesto_no_puede_borrar_fecha_devolucion():
    w = seed_base_world()
    cu = fake_current_user(w.usuario.id)
    evento = date(2036, 5, 1)
    svc = PresupuestosServices()
    creado = svc.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=evento,
            fecha_retiro=evento,
            fecha_devolucion=evento + timedelta(days=3),
            categoria_evento="Casamiento",
            nombre_agasajado="Test",
            lugar_evento="Salón",
            observaciones="",
            items=[_item(w.producto_a.id)],
        ),
        cu,
    )
    pid = creado["data"]["id"]
    data = PresupuestoCreate.model_construct(
        cliente_id=w.cliente.id,
        fecha_evento=evento,
        fecha_retiro=evento,
        fecha_devolucion=None,
        categoria_evento="Casamiento",
        nombre_agasajado="Test",
        lugar_evento="Salón",
        observaciones="",
        items=[_item(w.producto_a.id)],
        extra_discount_percentage=None,
        extra_discount_amount=None,
        extra_discount_reason=None,
        ignorar_conflictos_reserva=False,
    )
    with pytest.raises(HTTPException) as ei:
        svc.editar_presupuesto(pid, data, cu)
    assert ei.value.status_code == 400
    with db_session:
        assert Presupuesto[pid].fecha_devolucion == evento + timedelta(days=3)


def test_no_crear_orden_si_presupuesto_no_tiene_fecha_devolucion():
    w = seed_base_world()
    evento = date(2036, 6, 10)
    with db_session:
        p = Presupuesto(
            numero="PRES-SIN-DEV",
            cliente=Cliente.get(id=w.cliente_id),
            fecha_evento=evento,
            fecha_retiro=evento,
            categoria_evento="Casamiento",
            nombre_agasajado="Test",
            lugar_evento="Salón",
            observaciones="",
            estado="pendiente",
            total=80.0,
        )
        ItemPresupuesto(
            presupuesto=p,
            producto=Producto.get(id=w.producto_a_id),
            cantidad=1,
            precio_unitario=80.0,
            subtotal=80.0,
        )
        flush()
        pid = p.id
    with pytest.raises(HTTPException) as ei:
        OrdenTrabajoServices().crear_orden_trabajo(
            presupuesto_id=pid,
            seña_pagada=80.0,
            payment_method="EFECTIVO",
            usuario_id=w.usuario_id,
            cuenta_destino_id=w.cuenta_destino_id,
        )
    assert ei.value.status_code == 400
    assert "devolución" in ei.value.detail.lower()
