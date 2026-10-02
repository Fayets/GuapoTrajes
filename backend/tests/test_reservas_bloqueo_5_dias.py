"""
Pruebas funcionales: bloqueo de alquiler en [fecha_retiro, fecha_devolucion + 2]
tras generar orden de trabajo (ProductoReservado).

Regla: no disponible si el intervalo solicitado, también extendido 2 días después
de su devolución, se solapa con [R, D+2]. Esos 2 días son la limpieza: si
devuelven el día D, no se puede retirar el D+1 ni el D+2. El próximo retiro
puede ser el D+3.
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
# Titular: retiro = R, devolución = R+20 → ocupación [R, R+22]
# Entre una devolución y el próximo retiro tienen que quedar 2 días.
CASOS_BLOQUEO = [
    (-5, -3, True, "dos_dias_entre_devolucion_y_retiro"),
    (-4, -2, False, "un_solo_dia_entre_devolucion_y_retiro"),
    (-2, -1, False, "devolucion_pegada_al_retiro"),
    (-1, 0, False, "dentro_de_ventana"),
    (1, 3, False, "despues_del_retiro_dentro_del_alquiler"),
    (-4, 1, False, "solapa_por_devolucion_mas_alla_de_R"),
    (-8, -7, True, "muy_antes_sin_solapar"),
    (21, 25, False, "dentro_de_los_dos_dias_de_limpieza"),
    (23, 28, True, "retiro_al_dia_siguiente_de_la_limpieza"),
]


@pytest.mark.parametrize("prod_attr", ["producto_a", "producto_b"])
@pytest.mark.parametrize("off_ret,off_dev,esperado,desc", CASOS_BLOQUEO)
def test_disponibilidad_ventana_dos_dias(
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
        f"\n[metricas_bloqueo_2_dias] aprobados={ok}/{total} "
        f"({pct:.1f}%)\n"
    )
    assert ok == total


@pytest.fixture(scope="module")
def mundo_solo_presupuesto_sin_sena():
    """Presupuesto pendiente sin seña: la prenda sigue libre."""
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
    (-10, -3, True, "dos_dias_libres_antes_del_retiro"),
    (-4, -2, True, "un_solo_dia_entre_devolucion_y_retiro"),
    (-1, 1, True, "devolucion_pegada_al_retiro"),
    (0, 1, True, "solapa_en_retiro"),
    (0, 5, True, "desde_retiro"),
    (10, 15, True, "dentro_del_alquiler"),
    (21, 25, True, "dentro_de_los_dos_dias_de_limpieza"),
    (23, 28, True, "retiro_al_dia_siguiente_de_la_limpieza"),
]


@pytest.mark.parametrize("prod_attr", ["producto_a", "producto_b"])
@pytest.mark.parametrize("off_ret,off_dev,esperado,desc", CASOS_PRESUPUESTO_SIN_SENA)
def test_presupuesto_sin_sena_no_ocupa_la_prenda(
    mundo_solo_presupuesto_sin_sena,
    prod_attr,
    off_ret,
    off_dev,
    esperado,
    desc,
):
    """Un presupuesto sin seña no bloquea, aunque las fechas se solapen."""
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


def test_segundo_presupuesto_se_puede_armar_si_el_primero_no_pago_sena(mundo_solo_presupuesto_sin_sena):
    """Dos presupuestos pueden llevar la misma prenda hasta que uno pague seña."""
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
    creado = pres.crear_presupuesto(payload, cu)
    assert creado["success"] is True


def test_escenario_usuario_evento_agosto_vs_julio():
    """
    Un presupuesto sin seña no bloquea. Al cobrar la seña, la orden sí ocupa
    la prenda para el otro evento.
    """
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    pid = w.producto_a.id

    creado = pres.crear_presupuesto(
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

    assert verificar_disponibilidad(pid, date(2026, 7, 28), date(2026, 7, 30)) is True
    otro = pres.crear_presupuesto(
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
    assert otro["success"] is True

    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=creado["data"]["id"],
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    assert verificar_disponibilidad(pid, date(2026, 7, 28), date(2026, 7, 30)) is False
    assert verificar_disponibilidad(pid, date(2026, 8, 10), date(2026, 8, 12)) is True


def test_cuadro_del_cliente_devolucion_12_proximo_retiro_15():
    """
    Cuadro del local, con seña ya cobrada: el cliente llevó la prenda el
    sábado 10 y la devuelve el lunes 12. 12 + 2 = 14, así que el 13 y el 14
    no sale. El próximo alquiler se retira el 15 en adelante.
    Sin seña, esas fechas siguen libres.
    """
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    pid = w.producto_a.id
    creado = pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=date(2026, 10, 10),
            fecha_retiro=date(2026, 10, 10),
            fecha_devolucion=date(2026, 10, 12),
            categoria_evento="Casamiento",
            nombre_agasajado="Cuadro bloqueo",
            lugar_evento="Salón",
            observaciones="",
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
    assert verificar_disponibilidad(pid, date(2026, 10, 14), date(2026, 10, 16)) is True

    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=creado["data"]["id"],
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )

    assert verificar_disponibilidad(pid, date(2026, 10, 13), date(2026, 10, 16)) is False
    assert verificar_disponibilidad(pid, date(2026, 10, 14), date(2026, 10, 16)) is False
    assert verificar_disponibilidad(pid, date(2026, 10, 15), date(2026, 10, 18)) is True

    with pytest.raises(HTTPException) as exc:
        pres.crear_presupuesto(
            PresupuestoCreate(
                cliente_id=w.cliente.id,
                fecha_evento=date(2026, 10, 16),
                fecha_retiro=date(2026, 10, 14),
                fecha_devolucion=date(2026, 10, 16),
                categoria_evento="Casamiento",
                nombre_agasajado="Retiro en el bloqueo",
                lugar_evento="Salón",
                observaciones="",
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
    assert "14/10/2026" in str(exc.value.detail)
    assert "15/10/2026" in str(exc.value.detail)

    creado = pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=date(2026, 10, 17),
            fecha_retiro=date(2026, 10, 15),
            fecha_devolucion=date(2026, 10, 18),
            categoria_evento="Casamiento",
            nombre_agasajado="Retiro despues de la limpieza",
            lugar_evento="Salón",
            observaciones="",
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
    assert creado["success"] is True
