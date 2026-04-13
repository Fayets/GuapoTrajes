"""Datos mínimos para pruebas funcionales (Pony ORM)."""
from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace

import bcrypt
from pony.orm import db_session

from src.models import (
    Cliente,
    CuentaDestino,
    EstadoProducto,
    Producto,
    Roles,
    Sucursal,
    Usuario,
)


def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@db_session
def seed_base_world():
    """Sucursal, usuario ADMIN, cuenta destino, cliente, dos productos en SALON."""
    suf = uuid.uuid4().hex[:12]
    s = Sucursal(nombre=f"Suc Test {suf[:6]}", direccion="Dir 1", provincia="BA")
    u = Usuario(
        username=f"pytest_ad_{suf}",
        email=f"u{suf}@test.local",
        password=_hash_pw("testpass"),
        nombre="Py",
        apellido="Test",
        rol=Roles.ADMIN,
        sucursal=s,
    )
    cd = CuentaDestino(sucursal=s, nombre_titular="Caja test", activa=True)
    c = Cliente(
        nombre="Ana",
        apellido="Gomez",
        dni=f"D{suf}"[:12],
        direccion="Calle Falsa 123",
        celular="5491100000000",
    )
    base = date(2025, 1, 1)
    common = dict(
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
        fecha_alta=base,
        estado=EstadoProducto.SALON,
        sucursal=s,
    )
    pa = Producto(
        codigo_barra=f"PY-A-{suf}",
        descripcion="Producto A test",
        **common,
    )
    pb = Producto(
        codigo_barra=f"PY-B-{suf}",
        descripcion="Producto B test",
        **common,
    )
    return SimpleNamespace(
        sucursal=s,
        usuario=u,
        cuenta_destino=cd,
        cliente=c,
        producto_a=pa,
        producto_b=pb,
    )


def fake_current_user(user_id: int):
    class _U:
        id = user_id

    return _U()
