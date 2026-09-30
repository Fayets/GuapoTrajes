"""Conjuntos para armar: un ingreso viejo a modista no pisa el estado actual."""
from __future__ import annotations

from datetime import date, timedelta

from pony.orm import db_session, flush

from src.models import EstadoProducto, Modista, Producto, ProductoModista
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import (
    OrdenTrabajoServices,
    cerrar_visitas_taller_abiertas,
)
from src.services.presupuestos_services import PresupuestosServices
from src.services.reportes_services import ReportesServices
from tests.factories import fake_current_user, seed_base_world

R = date(2034, 9, 12)


def _orden():
    w = seed_base_world()
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R,
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=4),
            categoria_evento="Casamiento",
            nombre_agasajado="Pantalón",
            lugar_evento="Salón",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                )
            ],
        ),
        fake_current_user(w.usuario.id),
    )
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=out["data"]["id"],
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    return w


def _fila(producto_id: int) -> dict:
    filas = ReportesServices().obtener_prendas_a_armar(R, R)
    for fila in filas:
        for producto in fila["productos"]:
            if producto["producto_id"] == producto_id:
                return producto
    raise AssertionError("el producto no está en conjuntos para armar")


def test_ingreso_abierto_no_marca_modista_si_la_prenda_ya_esta_en_salon():
    w = _orden()
    with db_session:
        producto = Producto[w.producto_a.id]
        producto.estado = EstadoProducto.SALON
        modista = Modista(nombre="Taller viejo")
        ProductoModista(
            producto=producto,
            modista=modista,
            fecha_ingreso=R - timedelta(days=20),
            notas="Arreglo anterior",
        )

    fila = _fila(w.producto_a.id)
    assert fila["estado_actual"] == "SALON"
    assert fila["es_critico_armado"] is False
    assert fila["motivo_critico_armado"] != "En modista"


def test_si_el_estado_es_modista_el_reporte_si_lo_marca():
    w = _orden()
    with db_session:
        producto = Producto[w.producto_a.id]
        producto.estado = EstadoProducto.MODISTA
        modista = Modista(nombre="Taller actual")
        ProductoModista(
            producto=producto,
            modista=modista,
            fecha_ingreso=R - timedelta(days=1),
            notas="Ahora sí",
        )

    fila = _fila(w.producto_a.id)
    assert fila["motivo_critico_armado"] == "En modista"
    assert fila["ubicacion_critica"] == "Taller actual"


def test_volver_al_salon_cierra_el_ingreso_que_habia_quedado_abierto():
    w = _orden()
    with db_session:
        producto = Producto[w.producto_a.id]
        producto.estado = EstadoProducto.MODISTA
        modista = Modista(nombre="Taller")
        visita = ProductoModista(
            producto=producto,
            modista=modista,
            fecha_ingreso=R - timedelta(days=3),
            notas="Pendiente",
        )
        flush()
        visita_id = visita.id
        cerrar_visitas_taller_abiertas(producto)
        producto.estado = EstadoProducto.SALON
        flush()
        assert visita.fecha_salida is not None

    with db_session:
        cerrada = ProductoModista[visita_id]
        assert cerrada.fecha_salida is not None
        assert Producto[w.producto_a.id].estado == EstadoProducto.SALON
