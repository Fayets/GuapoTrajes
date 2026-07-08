"""Datos del titular (cliente/precliente) de un presupuesto y reparación de huérfanos."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

from pony.orm import db_session, flush

from src.models import Cliente, Presupuesto


def _norm_nombre(texto: str) -> str:
    t = unicodedata.normalize("NFD", (texto or "").strip().upper())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t).strip()


def titular_presupuesto(presupuesto) -> dict:
    """Devuelve datos de contacto del titular del presupuesto (cliente, precliente o huérfano)."""
    if presupuesto is None:
        return {
            "cliente_id": None,
            "precliente_id": None,
            "cliente_nombre": "Sin titular",
            "es_precliente": False,
            "cliente_dni": None,
            "cliente_direccion": None,
            "cliente_celular": None,
            "titular_huerfano": True,
        }
    if presupuesto.precliente:
        pc = presupuesto.precliente
        return {
            "cliente_id": None,
            "precliente_id": pc.id,
            "cliente_nombre": f"{pc.apellido} {pc.nombre}".strip(),
            "es_precliente": True,
            "cliente_dni": None,
            "cliente_direccion": None,
            "cliente_celular": pc.celular or None,
            "titular_huerfano": False,
        }
    c = presupuesto.cliente
    if c:
        return {
            "cliente_id": c.id,
            "precliente_id": None,
            "cliente_nombre": f"{c.apellido} {c.nombre}".strip(),
            "es_precliente": False,
            "cliente_dni": c.dni or None,
            "cliente_direccion": c.direccion or None,
            "cliente_celular": c.celular or None,
            "titular_huerfano": False,
        }
    return {
        "cliente_id": None,
        "precliente_id": None,
        "cliente_nombre": "Sin titular asignado",
        "es_precliente": False,
        "cliente_dni": None,
        "cliente_direccion": None,
        "cliente_celular": None,
        "titular_huerfano": True,
    }


def buscar_cliente_por_nombre(nombre: str) -> Optional[Cliente]:
    """Busca un cliente por nombre (tolera orden apellido/nombre y nombre parcial)."""
    buscado = _norm_nombre(nombre)
    if not buscado or buscado in {"CLIENTE", "SIN TITULAR", "SIN TITULAR ASIGNADO", "N/A"}:
        return None

    buscado_tokens = set(buscado.split())
    candidatos: list[Cliente] = []
    for cliente in Cliente.select():
        variantes = (
            _norm_nombre(f"{cliente.apellido} {cliente.nombre}"),
            _norm_nombre(f"{cliente.nombre} {cliente.apellido}"),
        )
        for variante in variantes:
            if not variante:
                continue
            if variante == buscado or variante.startswith(buscado) or buscado.startswith(variante):
                candidatos.append(cliente)
                break
            tokens = set(variante.split())
            if buscado_tokens and tokens and buscado_tokens == tokens:
                candidatos.append(cliente)
                break

    if not candidatos:
        return None
    if len(candidatos) == 1:
        return candidatos[0]
    candidatos.sort(key=lambda c: c.id, reverse=True)
    return candidatos[0]


def _resolver_cliente_para_presupuesto_huerfano(presupuesto: Presupuesto) -> Optional[Cliente]:
    orden = presupuesto.orden_trabajo
    if orden:
        for recibo in list(orden.recibos):
            nombre = (recibo.cliente_nombre or "").strip()
            if nombre:
                encontrado = buscar_cliente_por_nombre(nombre)
                if encontrado:
                    return encontrado
    return None


def reparar_presupuestos_huerfanos() -> int:
    """Vincula presupuestos sin cliente/precliente a un cliente existente cuando es posible."""
    reparados = 0
    with db_session:
        for presupuesto in list(Presupuesto.select()):
            if presupuesto.cliente or presupuesto.precliente:
                continue
            cliente = _resolver_cliente_para_presupuesto_huerfano(presupuesto)
            if not cliente:
                continue
            presupuesto.cliente = cliente
            presupuesto.precliente = None
            reparados += 1
        if reparados:
            flush()
    return reparados
