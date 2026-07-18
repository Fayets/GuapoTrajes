"""Al cambiar color/línea/talle/tela, la descripción del producto debe regenerarse."""
from __future__ import annotations

import uuid
from datetime import date

from pony.orm import db_session, flush

from src.models import (
    EstadoProducto,
    Producto,
    ProductoColor,
    ProductoLinea,
    ProductoTalle,
    ProductoTela,
    Sucursal,
)
from src.schemas import ProductUpdate
from src.services.productos_services import ProductoServices, _build_descripcion


def _seed_producto_con_atributos():
    suf = uuid.uuid4().hex[:8]
    with db_session:
        sucursal = Sucursal(nombre=f"Suc Desc {suf}", direccion="Dir", provincia="BA")
        linea = ProductoLinea(nombre=f"Saco {suf}", codigo=suf[:3])
        talle = ProductoTalle(nombre=f"42 {suf}", codigo=suf[3:5] or "T1")
        tela = ProductoTela(nombre=f"Lana {suf}", codigo=suf[5:7] or "E1")
        color_a = ProductoColor(nombre=f"Negro {suf}", codigo=(suf[7] + "A")[:2])
        color_b = ProductoColor(nombre=f"Azul {suf}", codigo=(suf[7] + "B")[:2])
        flush()
        desc = _build_descripcion(linea, talle, tela, color_a)
        producto = Producto(
            codigo_barra=f"DESC-{suf}",
            linea=linea,
            talle=talle,
            tela=tela,
            color=color_a,
            descripcion=desc,
            costo=100.0,
            precio_alquiler_lista=200.0,
            precio_alquiler_efectivo=180.0,
            precio_venta_nuevo_lista=300.0,
            precio_venta_nuevo_efectivo=280.0,
            precio_de_venta_medio_uso=150.0,
            precio_venta=290.0,
            precio_liquidacion=100.0,
            stock=1,
            stock_minimo=0,
            fecha_alta=date(2025, 1, 1),
            estado=EstadoProducto.SALON,
            sucursal=sucursal,
        )
        flush()
        return {
            "producto_id": producto.id,
            "sucursal_id": sucursal.id,
            "linea_id": linea.id,
            "talle_id": talle.id,
            "tela_id": tela.id,
            "color_a_id": color_a.id,
            "color_b_id": color_b.id,
            "color_a_nombre": color_a.nombre.upper(),
            "color_b_nombre": color_b.nombre.upper(),
            "desc_inicial": desc,
        }


def _cleanup(ids: dict) -> None:
    with db_session:
        p = Producto.get(id=ids["producto_id"])
        if p:
            p.delete()
        for model, key in (
            (ProductoColor, "color_a_id"),
            (ProductoColor, "color_b_id"),
            (ProductoTela, "tela_id"),
            (ProductoTalle, "talle_id"),
            (ProductoLinea, "linea_id"),
            (Sucursal, "sucursal_id"),
        ):
            obj = model.get(id=ids[key])
            if obj:
                obj.delete()


def test_cambiar_color_actualiza_descripcion_sin_enviar_descripcion():
    """Reproduce el bug: PUT solo con color_id debe regenerar la descripción."""
    ids = _seed_producto_con_atributos()
    try:
        assert ids["color_a_nombre"] in ids["desc_inicial"]
        assert ids["color_b_nombre"] not in ids["desc_inicial"]

        # Como el frontend viejo: manda color_id pero no descripcion
        out = ProductoServices().update_product(
            ids["producto_id"],
            ProductUpdate(color_id=ids["color_b_id"]),
        )
        producto = out["producto"]
        assert ids["color_b_nombre"] in producto["descripcion"]
        assert ids["color_a_nombre"] not in producto["descripcion"]
        assert producto["color_id"] == ids["color_b_id"]

        with db_session:
            p = Producto.get(id=ids["producto_id"])
            assert p is not None
            assert ids["color_b_nombre"] in (p.descripcion or "")
    finally:
        _cleanup(ids)


def test_build_descripcion_incluye_color():
    assert _build_descripcion(
        type("L", (), {"nombre": "Saco"})(),
        type("T", (), {"nombre": "42"})(),
        type("E", (), {"nombre": "Lana"})(),
        type("C", (), {"nombre": "Negro"})(),
    ) == "SACO 42 LANA NEGRO"
