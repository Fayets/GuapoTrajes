"""Crédito manual: abono a cuenta corriente con/sin movimiento de caja diaria."""
from __future__ import annotations

from pony.orm import db_session, flush

from src.models import CajaMovimiento, Cliente, CuentaCorriente, MetodoPagoConfigurable, Sucursal
from src.schemas import CreditoManualRequest
from src.services.pagos_services import PagosServices
from tests.factories import seed_base_world


def _count_caja_movimientos() -> int:
    return CajaMovimiento.select().count()


@db_session
def test_credito_manual_con_caja_registra_ingreso_y_saldo():
    world = seed_base_world()
    sucursal = Sucursal.get(id=world.sucursal_id)
    cliente = Cliente.get(id=world.cliente_id)
    metodo = MetodoPagoConfigurable(
        sucursal=sucursal,
        nombre="Efectivo test",
        activo=True,
        tiene_submetodos=False,
        orden=1,
    )
    flush()
    svc = PagosServices()
    data = CreditoManualRequest(
        cliente_id=world.cliente_id,
        monto=5000.0,
        concepto="Anticipo cliente",
        registrar_en_caja=True,
        metodo_pago_id=metodo.id,
        cuenta_destino_id=world.cuenta_destino_id,
    )
    resultado = svc.registrar_credito_manual(data, world.usuario_id)

    assert resultado["registrado_en_caja"] is True
    assert resultado["movimiento_caja_id"] is not None
    assert resultado["saldo_post"] == 5000.0

    origen_esperado = f"PAGO_CUENTA_CORRIENTE:{world.cliente_id}"
    movs_caja = [cm for cm in CajaMovimiento.select() if cm.origen == origen_esperado]
    assert len(movs_caja) == 1
    assert movs_caja[0].monto == 5000.0
    assert movs_caja[0].categoria == "CUENTA_CORRIENTE"

    movs_cc = [
        cc for cc in CuentaCorriente.select() if cc.cliente.id == world.cliente_id
    ]
    assert len(movs_cc) == 1
    assert movs_cc[0].tipo == "credito"
    assert movs_cc[0].monto == 5000.0


@db_session
def test_credito_manual_sin_caja_solo_cuenta_corriente():
    world = seed_base_world()
    antes = _count_caja_movimientos()
    svc = PagosServices()
    data = CreditoManualRequest(
        cliente_id=world.cliente_id,
        monto=1500.0,
        concepto="Ajuste comercial",
        registrar_en_caja=False,
    )
    resultado = svc.registrar_credito_manual(data, world.usuario_id)

    assert resultado["registrado_en_caja"] is False
    assert resultado["movimiento_caja_id"] is None
    assert resultado["saldo_post"] == 1500.0
    assert _count_caja_movimientos() == antes
