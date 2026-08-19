"""
Pruebas funcionales: bloqueo de alquiler en la ventana [fecha_retiro-5, fecha_devolucion]
tras generar orden de trabajo (ProductoReservado).

Regla: no disponible si el intervalo solicitado [fecha_retiro, fecha_devolucion]
se solapa con [R-5, D] donde R es la fecha de retiro y D la devolución del titular.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.disponibilidad_services import verificar_disponibilidad
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices

from tests.factories import fake_current_user, seed_base_world

# Fecha de retiro del titular (R). Evento y devolución distintos para detectar bugs con fecha_evento.
R = date(2030, 6, 15)


def _d(days: int) -> date:
    return R + timedelta(days=days)


@pytest.fixture(scope="module")
def mundo_reserva():
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    payload = PresupuestoCreate(
        cliente_id=w.cliente.id,
        fecha_evento=R + timedelta(days=10),
        fecha_retiro=R,
        fecha_devolucion=R + timedelta(days=20),
        categoria_evento="Casamiento",
        nombre_agasajado="X",
        lugar_evento="Salón",
        observaciones="",
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a.id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            ),
            ItemPresupuestoIn(
                producto_id=w.producto_b.id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            ),
        ],
    )
    out = pres.crear_presupuesto(payload, cu)
    pid = out["data"]["id"]
    ord_svc = OrdenTrabajoServices()
    ord_svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    return w


# (retiro_offset, devolucion_offset, esperado_disponible, descripcion)
# Titular: retiro = R, devolución = R+20 → ocupación [R-5, R+20]
CASOS_BLOQUEO = [
    (-7, -6, True, "completamente_antes_de_R_menos_5"),
    (-7, -5, False, "solapa_en_R_menos_5"),
    (-5, -4, False, "empieza_en_borde_R_menos_5"),
    (-4, -2, False, "dentro_de_ventana"),
    (-3, 0, False, "hasta_R"),
    (1, 3, False, "despues_del_retiro_dentro_del_alquiler"),
    (-6, 1, False, "solapa_por_devolucion_mas_alla_de_R"),
    (-8, -7, True, "muy_antes_sin_solapar"),
    (21, 25, True, "completamente_despues_de_devolucion"),
]


@pytest.mark.parametrize("prod_attr", ["producto_a", "producto_b"])
@pytest.mark.parametrize("off_ret,off_dev,esperado,desc", CASOS_BLOQUEO)
def test_disponibilidad_ventana_cinco_dias(
    mundo_reserva, prod_attr, off_ret, off_dev, esperado, desc
):
    w = mundo_reserva
    pid = getattr(w, prod_attr).id
    fr = _d(off_ret)
    fd = _d(off_dev)
    assert fr <= fd, "caso mal definido"
    got = verificar_disponibilidad(pid, fr, fd)
    assert got is esperado, (
        f"{prod_attr} {desc}: retiro={fr} dev={fd} "
        f"esperado_disponible={esperado} obtuvo={got}"
    )


def test_metricas_resumen_bloqueo_mundo(mundo_reserva):
    """Resumen: 2 productos × N casos = total ítems y porcentaje (siempre 100% si el módulo pasó)."""
    w = mundo_reserva
    total = 0
    ok = 0
    for prod_attr in ("producto_a", "producto_b"):
        pid = getattr(w, prod_attr).id
        for off_ret, off_dev, esperado, desc in CASOS_BLOQUEO:
            total += 1
            fr, fd = _d(off_ret), _d(off_dev)
            if verificar_disponibilidad(pid, fr, fd) is esperado:
                ok += 1
            else:
                print(f"FALLA {prod_attr} {desc} {fr} {fd}")
    pct = (100.0 * ok / total) if total else 0.0
    print(
        f"\n[metricas_bloqueo_5_dias] aprobados={ok}/{total} "
        f"({pct:.1f}%)\n"
    )
    assert ok == total


@pytest.fixture(scope="module")
def mundo_solo_presupuesto_sin_sena():
    """Presupuesto pendiente sin orden: bloquea por solapamiento de fechas de alquiler."""
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    payload = PresupuestoCreate(
        cliente_id=w.cliente.id,
        fecha_evento=R + timedelta(days=10),
        fecha_retiro=R,
        fecha_devolucion=R + timedelta(days=20),
        categoria_evento="Casamiento",
        nombre_agasajado="X",
        lugar_evento="Salón",
        observaciones="",
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a.id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            ),
            ItemPresupuestoIn(
                producto_id=w.producto_b.id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            ),
        ],
    )
    pres.crear_presupuesto(payload, cu)
    return w


CASOS_PRESUPUESTO_SIN_SENA = [
    (-10, -6, True, "completamente_antes_de_R_menos_5"),
    (-7, -5, False, "solapa_en_R_menos_5"),
    (-3, -1, False, "dentro_de_ventana_pre_retiro"),
    (-1, 1, False, "solapa_en_retiro"),
    (0, 5, False, "desde_retiro"),
    (10, 15, False, "dentro_del_alquiler"),
    (21, 25, True, "completamente_despues"),
]


@pytest.mark.parametrize("prod_attr", ["producto_a", "producto_b"])
@pytest.mark.parametrize("off_ret,off_dev,esperado,desc", CASOS_PRESUPUESTO_SIN_SENA)
def test_presupuesto_sin_sena_bloquea_fechas_solapadas(
    mundo_solo_presupuesto_sin_sena,
    prod_attr,
    off_ret,
    off_dev,
    esperado,
    desc,
):
    """Presupuesto pendiente sin seña bloquea si el período de alquiler se solapa."""
    w = mundo_solo_presupuesto_sin_sena
    pid = getattr(w, prod_attr).id
    fr = _d(off_ret)
    fd = _d(off_dev)
    assert fr <= fd
    got = verificar_disponibilidad(pid, fr, fd)
    assert got is esperado, (
        f"{prod_attr} {desc}: retiro={fr} dev={fd} "
        f"esperado_disponible={esperado} obtuvo={got}"
    )


def test_presupuesto_sin_sena_no_bloquea_fechas_sin_solapar(mundo_solo_presupuesto_sin_sena):
    """Presupuesto pendiente no bloquea si las fechas no se solapan."""
    w = mundo_solo_presupuesto_sin_sena
    pid = w.producto_a.id
    fr = _d(25)
    fd = _d(30)
    assert verificar_disponibilidad(pid, fr, fd) is True


def test_segundo_presupuesto_rechazado_si_solapa(mundo_solo_presupuesto_sin_sena):
    """Crear un segundo presupuesto con las mismas fechas y producto debe fallar."""
    w = mundo_solo_presupuesto_sin_sena
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    payload = PresupuestoCreate(
        cliente_id=w.cliente.id,
        fecha_evento=R,
        fecha_retiro=R,
        fecha_devolucion=R + timedelta(days=5),
        categoria_evento="Casamiento",
        nombre_agasajado="Y",
        lugar_evento="Salón",
        observaciones="",
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a.id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            ),
        ],
    )
    with pytest.raises(HTTPException):
        pres.crear_presupuesto(payload, cu)


def test_escenario_usuario_evento_agosto_vs_julio():
    """
    Reporte usuario: presupuesto evento 01/08/26 bloquea producto para otro del 28/07/26.
    Datos aislados con seed_base_world (sin seña).
    """
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    pid = w.producto_a.id

    pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=date(2026, 8, 1),
            fecha_retiro=date(2026, 8, 1),
            fecha_devolucion=date(2026, 8, 5),
            categoria_evento="Casamiento",
            nombre_agasajado="Evento A",
            lugar_evento="Salón",
            observaciones="test escenario usuario",
            items=[
                ItemPresupuestoIn(
                    producto_id=pid,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                ),
            ],
        ),
        cu,
    )

    assert verificar_disponibilidad(pid, date(2026, 7, 28), date(2026, 7, 30)) is False

    with pytest.raises(HTTPException) as exc:
        pres.crear_presupuesto(
            PresupuestoCreate(
                cliente_id=w.cliente.id,
                fecha_evento=date(2026, 7, 28),
                fecha_retiro=date(2026, 7, 28),
                fecha_devolucion=date(2026, 7, 30),
                categoria_evento="Casamiento",
                nombre_agasajado="Evento B",
                lugar_evento="Salón",
                observaciones="test escenario usuario B",
                items=[
                    ItemPresupuestoIn(
                        producto_id=pid,
                        cantidad=1,
                        precio_unitario=100.0,
                        subtotal=100.0,
                    ),
                ],
            ),
            cu,
        )
    assert exc.value.status_code == 400
    assert "no está disponible" in str(exc.value.detail).lower()

    assert verificar_disponibilidad(pid, date(2026, 8, 10), date(2026, 8, 12)) is True
