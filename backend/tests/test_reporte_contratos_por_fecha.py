"""Reporte contratos por fecha: no duplicar presupuesto+orden (10 vs 5)."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.fechas_ar import hoy_ar
from src.models import OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from src.services.reportes_services import ReportesServices
from tests.factories import fake_current_user, seed_base_world


def _crear_n_ordenes(w, n: int, total: float = 1000.0, seña: float = 1000.0):
    cu = fake_current_user(w.usuario.id)
    ids = []
    for i in range(n):
        R = date(2035, 3, 1) + timedelta(days=i)
        out = PresupuestosServices().crear_presupuesto(
            PresupuestoCreate(
                cliente_id=w.cliente.id,
                fecha_evento=R + timedelta(days=5),
                fecha_retiro=R,
                fecha_devolucion=R + timedelta(days=8),
                categoria_evento="ContratoReporte",
                nombre_agasajado=f"Cliente {i}",
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
            ids.append({"presupuesto_id": pid, "orden_id": o.id})
    return ids


def _cleanup(ids: list[dict]) -> None:
    with db_session:
        for row in ids:
            o = OrdenTrabajo.get(id=row["orden_id"])
            if o:
                o.delete()
            p = Presupuesto.get(id=row["presupuesto_id"])
            if p:
                for item in list(p.items):
                    item.delete()
                p.delete()


def test_contratos_por_fecha_tipo_todos_no_duplica_presupuesto_y_orden():
    """5 órdenes el mismo día no deben contarse como 10 (presupuesto+orden)."""
    w = seed_base_world()
    ids = _crear_n_ordenes(w, 5)
    hoy = hoy_ar()
    try:
        svc = ReportesServices()

        solo_ordenes = svc.obtener_contratos_por_fecha(
            fecha_desde=hoy,
            fecha_hasta=hoy,
            sucursal_id=w.sucursal_id,
            filtro_fecha="fecha_creacion",
            tipo="ordenes_trabajo",
        )
        # Puede haber ruido de otros tests en la misma DB de sesión; filtramos por nuestros ids
        nuestros_orden = {
            c["orden_trabajo_id"]
            for c in solo_ordenes
            if c.get("orden_trabajo_id") in {r["orden_id"] for r in ids}
        }
        assert len(nuestros_orden) == 5

        todos = svc.obtener_contratos_por_fecha(
            fecha_desde=hoy,
            fecha_hasta=hoy,
            sucursal_id=w.sucursal_id,
            filtro_fecha="fecha_creacion",
            tipo="todos",
        )
        nuestros_todos = [
            c
            for c in todos
            if c.get("orden_trabajo_id") in {r["orden_id"] for r in ids}
            or c.get("presupuesto_id") in {r["presupuesto_id"] for r in ids}
        ]
        # Con el fix: solo las 5 órdenes (los presupuestos con orden se omiten)
        assert len(nuestros_todos) == 5
        assert all(c["tipo"] == "orden_trabajo" for c in nuestros_todos)
        assert len(nuestros_todos) != 10
    finally:
        _cleanup(ids)


def test_contratos_por_fecha_ordenes_trabajo_coincide_con_listado():
    """El tipo que usa el front debe devolver exactamente las órdenes del día."""
    w = seed_base_world()
    ids = _crear_n_ordenes(w, 3, total=500.0, seña=500.0)
    hoy = hoy_ar()
    try:
        resultado = ReportesServices().obtener_contratos_por_fecha(
            fecha_desde=hoy,
            fecha_hasta=hoy,
            sucursal_id=w.sucursal_id,
            filtro_fecha="fecha_creacion",
            tipo="ordenes_trabajo",
        )
        nuestros = [
            c
            for c in resultado
            if c.get("orden_trabajo_id") in {r["orden_id"] for r in ids}
        ]
        assert len(nuestros) == 3
        assert all(c["tipo"] == "orden_trabajo" for c in nuestros)
    finally:
        _cleanup(ids)
