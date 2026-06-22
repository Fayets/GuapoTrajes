"""
Cuenta corriente: saldo y filtros por cliente no deben mezclar movimientos.

Regresión (PostgreSQL, FK columna "cliente"): Pony generaba SQL erróneo para
`select(lambda m: m.cliente.id == X)`. Los servicios usan `.filter(cliente=...)`.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pony.orm import db_session, flush

from src.models import Cliente, CuentaCorriente
from src.services.pagos_services import PagosServices


def test_obtener_saldo_solo_cuenta_movimientos_de_ese_cliente():
    with db_session:
        suf = uuid.uuid4().hex[:8]
        ca = Cliente(
            nombre="Alfa",
            apellido=f"Ap{suf}",
            dni=f"DNIA{suf}"[:12],
            direccion="d",
            celular="5491100000001",
        )
        cb = Cliente(
            nombre="Beta",
            apellido=f"Bp{suf}",
            dni=f"DNIB{suf}"[:12],
            direccion="d",
            celular="5491100000002",
        )
        CuentaCorriente(
            cliente=cb,
            concepto="Crédito test",
            tipo="credito",
            monto=100.0,
            saldo_post=100.0,
            fecha=datetime.now(),
        )
        flush()
        svc = PagosServices()
        saldo_a = svc.obtener_saldo_actual_cliente(ca.id)["saldo_actual"]
        saldo_b = svc.obtener_saldo_actual_cliente(cb.id)["saldo_actual"]
        assert float(saldo_a) == 0.0
        assert float(saldo_b) == 100.0


def test_filter_cliente_excluye_movimiento_de_otro():
    with db_session:
        suf = uuid.uuid4().hex[:8]
        ca = Cliente(
            nombre="Uno",
            apellido=f"U{suf}",
            dni=f"U1{suf}"[:12],
            direccion="d",
            celular="5491100000003",
        )
        cb = Cliente(
            nombre="Dos",
            apellido=f"D{suf}",
            dni=f"U2{suf}"[:12],
            direccion="d",
            celular="5491100000004",
        )
        m = CuentaCorriente(
            cliente=cb,
            concepto="Solo B",
            tipo="credito",
            monto=50.0,
            saldo_post=50.0,
            fecha=datetime.now(),
        )
        lista_a = list(CuentaCorriente.select().filter(cliente=ca))
        lista_b = list(CuentaCorriente.select().filter(cliente=cb))
        assert m.id not in {x.id for x in lista_a}
        assert m.id in {x.id for x in lista_b}
