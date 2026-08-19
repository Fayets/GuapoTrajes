"""Reservar a futuro no exige que la prenda esté en salón hoy."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import EstadoProducto, Producto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world

R = date(2035, 8, 10)
D = date(2035, 12, 15)


def _item(producto_id: int) -> ItemPresupuestoIn:
    return ItemPresupuestoIn(
        producto_id=producto_id,
        cantidad=1,
        precio_unitario=100.0,
        subtotal=100.0,
    )


def _presupuesto(
    w,
    *,
    fecha_retiro: date,
    fecha_devolucion: date,
    agasajado: str,
) -> PresupuestoCreate:
    return PresupuestoCreate(
        cliente_id=w.cliente_id,
        fecha_evento=fecha_retiro,
        fecha_retiro=fecha_retiro,
        fecha_devolucion=fecha_devolucion,
        categoria_evento="Casamiento",
        nombre_agasajado=agasajado,
        lugar_evento="Salón",
        observaciones="",
        items=[_item(w.producto_a_id)],
    )


def _alquiler_agosto_en_cliente(w) -> None:
    cu = fake_current_user(w.usuario_id)
    creado = PresupuestosServices().crear_presupuesto(
        _presupuesto(
            w,
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            agasajado="Agosto",
        ),
        cu,
    )
    orden = OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=creado["data"]["id"],
        seña_pagada=100.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario_id,
        cuenta_destino_id=w.cuenta_destino_id,
    )
    OrdenTrabajoServices().registrar_contrato_generado(orden["data"]["id"])
    with db_session:
        assert Producto[w.producto_a_id].estado == EstadoProducto.CLIENTE


def test_producto_en_cliente_se_puede_reservar_meses_despues():
    w = seed_base_world()
    _alquiler_agosto_en_cliente(w)

    result = PresupuestosServices().crear_presupuesto(
        _presupuesto(
            w,
            fecha_retiro=D,
            fecha_devolucion=D + timedelta(days=3),
            agasajado="Diciembre",
        ),
        fake_current_user(w.usuario_id),
    )
    assert result["success"] is True


def test_producto_en_cliente_sigue_bloqueado_si_las_fechas_solapan():
    w = seed_base_world()
    _alquiler_agosto_en_cliente(w)

    with pytest.raises(HTTPException) as exc:
        PresupuestosServices().crear_presupuesto(
            _presupuesto(
                w,
                fecha_retiro=R + timedelta(days=2),
                fecha_devolucion=R + timedelta(days=4),
                agasajado="Solapa agosto",
            ),
            fake_current_user(w.usuario_id),
        )
    assert exc.value.status_code == 400
    assert "no está disponible" in str(exc.value.detail).lower()


def test_producto_en_lavanderia_sin_reserva_se_puede_presupuestar():
    w = seed_base_world()
    with db_session:
        Producto[w.producto_a_id].estado = EstadoProducto.LAVANDERIA

    result = PresupuestosServices().crear_presupuesto(
        _presupuesto(
            w,
            fecha_retiro=D,
            fecha_devolucion=D + timedelta(days=2),
            agasajado="Lavandería diciembre",
        ),
        fake_current_user(w.usuario_id),
    )
    assert result["success"] is True


def test_producto_vendido_no_se_puede_reservar_a_futuro():
    w = seed_base_world()
    with db_session:
        Producto[w.producto_a_id].estado = EstadoProducto.VENDIDO

    with pytest.raises(HTTPException) as exc:
        PresupuestosServices().crear_presupuesto(
            _presupuesto(
                w,
                fecha_retiro=D,
                fecha_devolucion=D + timedelta(days=2),
                agasajado="Vendido",
            ),
            fake_current_user(w.usuario_id),
        )
    assert exc.value.status_code == 400
    assert "vendido" in str(exc.value.detail).lower()
