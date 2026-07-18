"""Observación interna del cliente: persistencia, edición y limpieza."""
from __future__ import annotations

import uuid

from pony.orm import db_session

from src.models import Cliente
from src.schemas import ClientCreate
from src.services.cliente_services import ClientServices


def _datos(suf: str, notas: str) -> ClientCreate:
    return ClientCreate(
        nombre="Ana",
        apellido="Prueba",
        dni=f"OBS-{suf}",
        direccion="Calle 123",
        celular="1111111111",
        notas=notas,
    )


def _borrar_cliente(cliente_id: int) -> None:
    with db_session:
        cliente = Cliente.get(id=cliente_id)
        if cliente:
            cliente.delete()


def test_observacion_interna_se_crea_muestra_y_actualiza_con_trim():
    suf = uuid.uuid4().hex[:10]
    servicio = ClientServices()
    cliente_id = 0
    try:
        creado = servicio.crear_cliente(
            _datos(suf, "  Devolvió con demora y la ropa muy sucia.  ")
        )
        cliente_id = creado["data"]["id"]

        assert creado["data"]["notas"] == "Devolvió con demora y la ropa muy sucia."
        assert servicio.buscar_cliente_por_id(cliente_id)["notas"] == (
            "Devolvió con demora y la ropa muy sucia."
        )

        actualizado = servicio.actualizar_cliente(
            cliente_id,
            _datos(suf, "  Descuidado con la ropa alquilada.  "),
        )
        assert actualizado["data"]["notas"] == "Descuidado con la ropa alquilada."

        with db_session:
            cliente = Cliente.get(id=cliente_id)
            assert cliente is not None
            assert cliente.notas == "Descuidado con la ropa alquilada."
    finally:
        if cliente_id:
            _borrar_cliente(cliente_id)


def test_observacion_interna_se_puede_vaciar():
    suf = uuid.uuid4().hex[:10]
    servicio = ClientServices()
    cliente_id = 0
    try:
        creado = servicio.crear_cliente(_datos(suf, "Devolución tardía"))
        cliente_id = creado["data"]["id"]

        actualizado = servicio.actualizar_cliente(cliente_id, _datos(suf, "   "))
        assert actualizado["data"]["notas"] == ""
        assert servicio.buscar_cliente_por_id(cliente_id)["notas"] == ""
    finally:
        if cliente_id:
            _borrar_cliente(cliente_id)
