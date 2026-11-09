"""
Un color dado de alta con el código de otro (AERO 34 sobre CHAMPAGNE 34) dejaba la lista
de colores en 500 y la pantalla vacía. El alta tiene que rechazarlo y el arranque repararlo.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src import migrations
from src.db import db
from src.migrations import codigos_a_reasignar, ensure_codigos_unicos_catalogos_producto
from src.models import ProductoColor
from src.schemas import ProductoColorCreate
from src.services.config_productos_services import ConfigProductosServices


def _codigo_color_libre() -> str:
    with db_session:
        usados = {c.codigo for c in ProductoColor.select()}
    return next(f"{n:02d}" for n in range(10, 100) if f"{n:02d}" not in usados)


def test_repetido_pasa_al_siguiente_del_mayor():
    filas = [(64, "33"), (83, "34"), (84, "34"), (67, "31")]
    assert codigos_a_reasignar(filas, 2) == [(84, "35")]


def test_se_queda_el_de_id_mas_bajo_y_respeta_el_largo():
    filas = [(9, "001"), (3, "001"), (5, "001"), (4, "002")]
    assert codigos_a_reasignar(filas, 3) == [(5, "003"), (9, "004")]


def test_sin_repetidos_no_cambia_nada():
    assert codigos_a_reasignar([(1, "01"), (2, "02")], 2) == []


def test_en_el_tope_usa_el_primer_hueco():
    filas = [(1, "01"), (2, "99"), (3, "99")]
    assert codigos_a_reasignar(filas, 2) == [(3, "02")]


def test_alta_de_color_con_codigo_de_otro_se_rechaza():
    servicio = ConfigProductosServices()
    codigo = _codigo_color_libre()
    suf = uuid.uuid4().hex[:6]
    servicio.create_color(ProductoColorCreate(nombre=f"CHAMPAGNE {suf}", codigo=codigo))

    with pytest.raises(HTTPException) as exc:
        servicio.create_color(ProductoColorCreate(nombre=f"AERO {suf}", codigo=codigo))

    assert exc.value.status_code == 400
    assert f"CHAMPAGNE {suf}" in exc.value.detail
    nombres = [c["nombre"] for c in servicio.get_colores() if c["codigo"] == codigo]
    assert nombres == [f"CHAMPAGNE {suf}"]


def test_alta_de_color_con_nombre_repetido_se_rechaza_sin_importar_mayusculas():
    servicio = ConfigProductosServices()
    suf = uuid.uuid4().hex[:6]
    servicio.create_color(ProductoColorCreate(nombre=f"Vainilla {suf}", codigo=_codigo_color_libre()))

    with pytest.raises(HTTPException) as exc:
        servicio.create_color(ProductoColorCreate(nombre=f"VAINILLA {suf}", codigo=_codigo_color_libre()))

    assert exc.value.status_code == 400


def test_arranque_repara_repetidos_y_deja_el_indice_unico(monkeypatch):
    tabla = f"CatalogoPrueba{uuid.uuid4().hex[:6]}"
    with db_session:
        db.execute(f'CREATE TABLE "{tabla}" ("id" INTEGER PRIMARY KEY, "nombre" TEXT, "codigo" TEXT)')
        db.execute(
            f"INSERT INTO \"{tabla}\" VALUES (64, 'VERDE', '33'), (83, 'CHAMPAGNE', '34'), (84, 'AERO', '34')"
        )
    monkeypatch.setattr(migrations, "CATALOGOS_PRODUCTO_LARGO_CODIGO", {tabla: 2})

    ensure_codigos_unicos_catalogos_producto()

    with db_session:
        assert db.select(f'SELECT "nombre", "codigo" FROM "{tabla}" ORDER BY "id"') == [
            ("VERDE", "33"),
            ("CHAMPAGNE", "34"),
            ("AERO", "35"),
        ]
    with pytest.raises(Exception):
        with db_session:
            db.execute(f"INSERT INTO \"{tabla}\" VALUES (85, 'OTRO', '34')")
