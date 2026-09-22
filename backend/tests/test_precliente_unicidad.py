"""Alta de precliente: el celular se puede repetir; la tripleta no."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from pony.orm import db_session, flush

from src.models import Cliente, Precliente
from src.schemas import PreclientCreate
from src.services.precliente_services import PreclientServices
from tests.factories import seed_base_world


def test_celular_repetido_distinto_nombre_ok():
    seed_base_world()
    svc = PreclientServices()
    a = svc.crear_cliente(
        PreclientCreate(nombre="Luis", apellido="Perez", celular="11 5555-0000")
    )
    b = svc.crear_cliente(
        PreclientCreate(nombre="Maria", apellido="Lopez", celular="1155550000")
    )
    assert a["success"] is True
    assert b["success"] is True
    assert a["data"]["id"] != b["data"]["id"]


def test_tripleta_duplicada_precliente_400():
    seed_base_world()
    svc = PreclientServices()
    svc.crear_cliente(PreclientCreate(nombre="Luis", apellido="Perez", celular="1155551111"))
    with pytest.raises(HTTPException) as ei:
        svc.crear_cliente(
            PreclientCreate(nombre=" luis ", apellido="PEREZ", celular="11-5555-1111")
        )
    assert ei.value.status_code == 400
    assert "nombre" in ei.value.detail.lower()


def test_tripleta_igual_a_cliente_400():
    w = seed_base_world()
    svc = PreclientServices()
    with pytest.raises(HTTPException) as ei:
        svc.crear_cliente(
            PreclientCreate(
                nombre=w.cliente.nombre,
                apellido=w.cliente.apellido,
                celular=w.cliente.celular,
            )
        )
    assert ei.value.status_code == 400
    assert "cliente" in ei.value.detail.lower()


def test_detectar_y_convertir_con_usar_cliente_id():
    w = seed_base_world()
    svc = PreclientServices()
    created = svc.crear_cliente(
        PreclientCreate(nombre="Otro", apellido="Titular", celular="111000111")
    )
    pc_id = created["data"]["id"]
    with pytest.raises(HTTPException) as ei:
        svc.convertir_a_cliente(pc_id, direccion="Otra dir 123", dni=w.cliente.dni)
    assert ei.value.status_code == 409
    detail = ei.value.detail
    assert isinstance(detail, dict)
    assert detail["cliente"]["id"] == w.cliente.id

    out = svc.convertir_a_cliente(
        pc_id,
        direccion="Otra dir 123",
        dni=w.cliente.dni,
        usar_cliente_id=w.cliente.id,
    )
    assert out["success"] is True
    assert out["data"]["id"] == w.cliente.id
    with db_session:
        assert Precliente.get(id=pc_id) is None
        assert Cliente.get(id=w.cliente.id) is not None


def test_detectar_por_nombre_apellido_celular():
    w = seed_base_world()
    with db_session:
        pc = Precliente(
            nombre=w.cliente.nombre,
            apellido=w.cliente.apellido,
            celular=w.cliente.celular,
        )
        flush()
        pc_id = pc.id
    det = PreclientServices().detectar_cliente_existente(pc_id)
    assert det["encontrado"] is True
    assert det["confianza"] == "triple"
    assert det["cliente"]["id"] == w.cliente.id
