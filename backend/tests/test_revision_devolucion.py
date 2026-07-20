"""Devolución parcial = revisión: bloqueo de Completada y alerta en lavandería."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session, flush

from src.models import (
    EstadoProducto,
    EstadoRevisionDevolucion,
    Lavanderia,
    OrdenTrabajo,
    Presupuesto,
    Producto,
    ProductoLavanderia,
    RevisionDevolucion,
)
from src.revision_devolucion import PREFIJO_REVISION_NOTA
from src.schemas import DevolucionEnvioBatchSchema, ItemPresupuestoIn, PresupuestoCreate
from src.services.lavanderia_services import LavanderiaServices
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


@pytest.fixture
def orden_dos_productos_contrato():
    w = seed_base_world()
    R = date(2032, 4, 10)
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    out = pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=5),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="Test",
            nombre_agasajado="Y",
            lugar_evento="Z",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=50.0,
                    subtotal=50.0,
                ),
                ItemPresupuestoIn(
                    producto_id=w.producto_b.id,
                    cantidad=1,
                    precio_unitario=50.0,
                    subtotal=50.0,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    ord_svc = OrdenTrabajoServices()
    ord_svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=100.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        pr = Presupuesto.get(id=pid)
        oid = pr.orden_trabajo.id
    ord_svc.registrar_contrato_generado(oid)
    return type(
        "X",
        (),
        {
            "world": w,
            "orden_id": oid,
            "id_ok": w.producto_a.id,
            "id_rev": w.producto_b.id,
            "usuario_id": w.usuario.id,
        },
    )()


def test_parcial_crea_revision_y_no_completa(orden_dos_productos_contrato):
    x = orden_dos_productos_contrato
    svc = OrdenTrabajoServices()

    # 1 OK por completa (subset)
    out_ok = svc.completar_devolucion(
        x.orden_id,
        usuario_id=x.usuario_id,
        envios=[
            DevolucionEnvioBatchSchema(
                productos_ids=[x.id_ok],
                destino="SALON",
            )
        ],
    )
    assert out_ok["data"]["orden_completada"] is False

    # 1 con revisión
    out_rev = svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_rev],
        descripcion="Mancha en solapa",
        usuario_id=x.usuario_id,
        destino="SALON",
    )
    assert out_rev["success"] is True
    assert out_rev["data"]["tiene_revisiones_abiertas"] is True

    with db_session:
        o = OrdenTrabajo.get(id=x.orden_id)
        assert o.estado != "Completada"
        revs = [
            r
            for r in list(RevisionDevolucion.select())
            if r.orden.id == x.orden_id
            and r.estado == EstadoRevisionDevolucion.ABIERTA.value
        ]
        assert len(revs) == 1
        assert revs[0].producto.id == x.id_rev
        assert "Mancha" in revs[0].motivo


def test_completar_bloqueado_con_revision_abierta(orden_dos_productos_contrato):
    x = orden_dos_productos_contrato
    svc = OrdenTrabajoServices()
    svc.completar_devolucion(
        x.orden_id,
        usuario_id=x.usuario_id,
        envios=[
            DevolucionEnvioBatchSchema(productos_ids=[x.id_ok], destino="SALON")
        ],
    )
    svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_rev],
        descripcion="Requiere revisión",
        usuario_id=x.usuario_id,
        destino="SALON",
    )
    with pytest.raises(HTTPException) as ei:
        svc.completar_devolucion(
            x.orden_id,
            usuario_id=x.usuario_id,
            destino="SALON",
        )
    assert ei.value.status_code == 403
    assert "revisión" in ei.value.detail.lower() or "pagaré" in ei.value.detail.lower()


def test_resolver_revision_permite_finalizar(orden_dos_productos_contrato):
    x = orden_dos_productos_contrato
    svc = OrdenTrabajoServices()
    svc.completar_devolucion(
        x.orden_id,
        usuario_id=x.usuario_id,
        envios=[
            DevolucionEnvioBatchSchema(productos_ids=[x.id_ok], destino="SALON")
        ],
    )
    svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_rev],
        descripcion="Revisión test",
        usuario_id=x.usuario_id,
        destino="SALON",
    )
    with db_session:
        rev = next(
            r
            for r in list(RevisionDevolucion.select())
            if r.orden.id == x.orden_id
            and r.estado == EstadoRevisionDevolucion.ABIERTA.value
        )
        rid = rev.id

    resolved = svc.resolver_revision_devolucion(
        x.orden_id, x.usuario_id, revision_id=rid
    )
    assert resolved["data"]["puede_finalizar_devolucion"] is True

    out = svc.completar_devolucion(
        x.orden_id, usuario_id=x.usuario_id, destino="SALON"
    )
    assert out["data"]["orden_completada"] is True
    with db_session:
        o = OrdenTrabajo.get(id=x.orden_id)
        assert o.estado == "Completada"


def test_listar_incluye_orden_solo_con_revision(orden_dos_productos_contrato):
    x = orden_dos_productos_contrato
    svc = OrdenTrabajoServices()
    svc.completar_devolucion(
        x.orden_id,
        usuario_id=x.usuario_id,
        envios=[
            DevolucionEnvioBatchSchema(productos_ids=[x.id_ok], destino="SALON"),
        ],
    )
    svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_rev],
        descripcion="Pendiente de revisión",
        usuario_id=x.usuario_id,
        destino="SALON",
    )

    lista = svc.listar_ordenes_trabajo()
    found = next(row for row in lista if row["id"] == x.orden_id)
    assert found["tiene_revisiones_abiertas"] is True
    assert len(found["revisiones_abiertas"]) >= 1
    assert found["estado"].lower() != "completada"
    # Sin prendas reservadas reales (solo revisión abierta)
    with db_session:
        o = OrdenTrabajo.get(id=x.orden_id)
        assert len(list(o.productos_reservados)) == 0


def test_regreso_lavanderia_alerta_revision(orden_dos_productos_contrato):
    x = orden_dos_productos_contrato
    with db_session:
        lav = Lavanderia(nombre="Lav revisión test")
        flush()
        lav_id = lav.id

    svc = OrdenTrabajoServices()
    svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_rev],
        descripcion="Mancha fuerte",
        usuario_id=x.usuario_id,
        destino="LAVANDERIA",
        lavanderia_id=lav_id,
    )
    with db_session:
        pl = next(
            pl
            for pl in list(ProductoLavanderia.select())
            if pl.producto.id == x.id_rev and pl.fecha_salida is None
        )
        assert (pl.notas or "").startswith(PREFIJO_REVISION_NOTA)

    lav_svc = LavanderiaServices()
    out = lav_svc.regresar_producto_de_lavanderia(x.id_rev, usuario_id=x.usuario_id)
    assert out.requiere_cuidado_especial is True
    assert out.mensaje_revision
    assert "cuidado" in out.mensaje_revision.lower() or "revisión" in out.mensaje_revision.lower()

    with db_session:
        p = Producto.get(id=x.id_rev)
        assert p.estado == EstadoProducto.SALON
