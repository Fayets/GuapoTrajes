"""Crédito manual: abono a cuenta corriente con/sin movimiento de caja diaria."""
from __future__ import annotations

from pony.orm import db_session, flush

from src.models import CajaMovimiento, CuentaCorriente, MetodoPagoConfigurable, Sucursal
from src.schemas import CreditoManualRequest
from src.services.pagos_services import PagosServices
from tests.factories import seed_base_world


def _count_caja_movimientos() -> int:
    with db_session:
        return CajaMovimiento.select().count()


def _cleanup(cliente_id: int, metodo_id: int | None = None) -> None:
    with db_session:
        origen = f"PAGO_CUENTA_CORRIENTE:{cliente_id}"
        for cm in list(CajaMovimiento.select()):
            if cm.origen == origen:
                cm.delete()
        for cc in list(CuentaCorriente.select()):
            if cc.cliente.id == cliente_id:
                cc.delete()
        if metodo_id:
            m = MetodoPagoConfigurable.get(id=metodo_id)
            if m:
                m.delete()


def test_credito_manual_con_caja_registra_ingreso_y_saldo():
    world = seed_base_world()
    metodo_id = None
    try:
        with db_session:
            sucursal = Sucursal.get(id=world.sucursal_id)
            metodo = MetodoPagoConfigurable(
                sucursal=sucursal,
                nombre="Efectivo test",
                activo=True,
                tiene_submetodos=False,
                orden=1,
            )
            flush()
            metodo_id = metodo.id

        svc = PagosServices()
        data = CreditoManualRequest(
            cliente_id=world.cliente_id,
            monto=5000.0,
            concepto="Anticipo cliente",
            registrar_en_caja=True,
            metodo_pago_id=metodo_id,
            cuenta_destino_id=world.cuenta_destino_id,
        )
        resultado = svc.registrar_credito_manual(data, world.usuario_id)

        assert resultado["registrado_en_caja"] is True
        assert resultado["movimiento_caja_id"] is not None
        assert resultado["saldo_post"] == 5000.0
        assert resultado.get("recibo") is not None
        assert resultado["recibo"]["concepto"] == "anticipo"
        assert resultado["recibo"]["monto"] == 5000.0

        origen_esperado = f"PAGO_CUENTA_CORRIENTE:{world.cliente_id}"
        with db_session:
            movs_caja = [
                cm for cm in list(CajaMovimiento.select()) if cm.origen == origen_esperado
            ]
            assert len(movs_caja) == 1
            assert movs_caja[0].monto == 5000.0
            assert movs_caja[0].categoria == "CUENTA_CORRIENTE"

            movs_cc = [
                cc
                for cc in list(CuentaCorriente.select())
                if cc.cliente.id == world.cliente_id
            ]
            assert len(movs_cc) == 1
            assert movs_cc[0].tipo == "credito"
            assert movs_cc[0].monto == 5000.0
    finally:
        _cleanup(world.cliente_id, metodo_id)


def test_credito_manual_sin_caja_solo_cuenta_corriente():
    world = seed_base_world()
    try:
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
        assert resultado.get("recibo") is None
        assert _count_caja_movimientos() == antes
    finally:
        _cleanup(world.cliente_id)
