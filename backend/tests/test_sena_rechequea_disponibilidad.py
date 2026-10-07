"""Cobrar un presupuesto viejo vuelve a chequear que la prenda siga libre."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import Presupuesto, Roles, Usuario
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


R = date(2036, 9, 16)
D = date(2036, 9, 20)


def _armar(w, agasajado: str) -> int:
    creado = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente_id,
            fecha_evento=R,
            fecha_retiro=R,
            fecha_devolucion=D,
            categoria_evento="Casamiento",
            nombre_agasajado=agasajado,
            lugar_evento="Salón",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a_id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                )
            ],
        ),
        fake_current_user(w.usuario_id),
    )
    return creado["data"]["id"]


def _cobrar(w, presupuesto_id: int, **kwargs):
    return OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=presupuesto_id,
        seña_pagada=100.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario_id,
        cuenta_destino_id=w.cuenta_destino_id,
        **kwargs,
    )


def test_sena_dias_despues_rechaza_si_otra_orden_ocupo_la_prenda():
    w = seed_base_world()
    presupuesto_viejo = _armar(w, "Gho Silva")
    presupuesto_intermedio = _armar(w, "Otro cliente")
    _cobrar(w, presupuesto_intermedio)

    with pytest.raises(HTTPException) as exc:
        _cobrar(w, presupuesto_viejo)

    assert exc.value.status_code == 400
    detalle = str(exc.value.detail).lower()
    assert "no se puede tomar la seña" in detalle
    assert "conflicto" in detalle
    with db_session:
        presupuesto = Presupuesto.get(id=presupuesto_viejo)
        assert presupuesto.orden_trabajo is None
        assert (presupuesto.estado or "").lower() != "aprobado"


def test_sena_dias_despues_pasa_si_la_prenda_sigue_libre():
    w = seed_base_world()
    presupuesto_id = _armar(w, "Sigue libre")
    resultado = _cobrar(w, presupuesto_id)
    assert resultado["success"] is True
    assert resultado["data"]["saldo_pendiente"] == 0


def test_admin_puede_forzar_la_sena_si_confirma_el_conflicto():
    w = seed_base_world()
    presupuesto_viejo = _armar(w, "Forzar")
    _cobrar(w, _armar(w, "Quien reservó primero"))

    resultado = _cobrar(w, presupuesto_viejo, ignorar_conflictos_reserva=True)
    assert resultado["success"] is True


def test_empleado_no_puede_forzar_el_conflicto_al_cobrar():
    w = seed_base_world()
    presupuesto_viejo = _armar(w, "Empleado")
    _cobrar(w, _armar(w, "Reserva previa"))
    with db_session:
        Usuario[w.usuario_id].rol = Roles.EMPLEADO

    with pytest.raises(HTTPException) as exc:
        _cobrar(w, presupuesto_viejo, ignorar_conflictos_reserva=True)

    assert exc.value.status_code == 403
    assert "administrador" in str(exc.value.detail).lower()


def test_prenda_inmovilizada_despues_del_presupuesto_tampoco_se_puede_senar():
    w = seed_base_world()
    presupuesto_id = _armar(w, "Inmovilizado")
    with db_session:
        from src.models import Producto

        Producto[w.producto_a_id].inmovilizado = True

    with pytest.raises(HTTPException) as exc:
        _cobrar(w, presupuesto_id, ignorar_conflictos_reserva=True)

    assert exc.value.status_code == 400
    assert "inmovilizado" in str(exc.value.detail).lower()


def test_otra_orden_en_fechas_que_no_se_pisan_no_bloquea_la_sena():
    w = seed_base_world()
    lejos = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente_id,
            fecha_evento=R + timedelta(days=40),
            fecha_retiro=R + timedelta(days=40),
            fecha_devolucion=R + timedelta(days=43),
            categoria_evento="Casamiento",
            nombre_agasajado="Otra fecha",
            lugar_evento="Salón",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a_id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                )
            ],
        ),
        fake_current_user(w.usuario_id),
    )
    _cobrar(w, lejos["data"]["id"])
    resultado = _cobrar(w, _armar(w, "Fecha original"))
    assert resultado["success"] is True
