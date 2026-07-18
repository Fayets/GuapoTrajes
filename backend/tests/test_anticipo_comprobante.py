"""Anticipo/crédito manual debe devolver comprobante e incluirse en recibos por fecha."""
from __future__ import annotations

from datetime import date

from pony.orm import db_session, flush

from src.models import CajaMovimiento, CuentaCorriente, MetodoPagoConfigurable, Sucursal
from src.schemas import CreditoManualRequest
from src.services.pagos_services import PagosServices
from src.services.reportes_services import ReportesServices
from tests.factories import seed_base_world


def _cleanup(ids: dict) -> None:
    with db_session:
        origen = f"PAGO_CUENTA_CORRIENTE:{ids['cliente_id']}"
        for cm in list(CajaMovimiento.select()):
            if cm.origen == origen or cm.id == ids.get("movimiento_caja_id"):
                cm.delete()
        for cc in list(CuentaCorriente.select()):
            if cc.cliente.id == ids["cliente_id"]:
                cc.delete()
        if ids.get("metodo_id"):
            m = MetodoPagoConfigurable.get(id=ids["metodo_id"])
            if m:
                m.delete()


def test_anticipo_devuelve_recibo_y_aparece_en_reporte():
    world = seed_base_world()
    ids: dict = {"cliente_id": world.cliente_id, "metodo_id": None, "movimiento_caja_id": None}
    try:
        with db_session:
            sucursal = Sucursal.get(id=world.sucursal_id)
            metodo = MetodoPagoConfigurable(
                sucursal=sucursal,
                nombre="Efectivo anticipo test",
                activo=True,
                tiene_submetodos=False,
                orden=1,
            )
            flush()
            ids["metodo_id"] = metodo.id

        svc = PagosServices()
        data = CreditoManualRequest(
            cliente_id=world.cliente_id,
            monto=12000.0,
            concepto="Anticipo cliente prueba",
            registrar_en_caja=True,
            metodo_pago_id=ids["metodo_id"],
            cuenta_destino_id=world.cuenta_destino_id,
        )
        resultado = svc.registrar_credito_manual(data, world.usuario_id)

        assert resultado["registrado_en_caja"] is True
        assert resultado["movimiento_caja_id"] is not None
        ids["movimiento_caja_id"] = resultado["movimiento_caja_id"]

        recibo = resultado.get("recibo")
        assert recibo is not None, "El anticipo con caja debe devolver comprobante"
        assert recibo["concepto"] == "anticipo"
        assert recibo["monto"] == 12000.0
        assert recibo["motivo"] == "Anticipo cliente prueba"
        assert "Ana" in recibo["cliente_nombre"]
        assert recibo["movimiento_caja_id"] == resultado["movimiento_caja_id"]
        assert str(recibo["presupuesto_numero"]).startswith("ANTICIPO-")

        hoy = date.today()
        recibos = ReportesServices().obtener_recibos_por_fecha(
            fecha_desde=hoy,
            fecha_hasta=hoy,
            sucursal_id=world.sucursal_id,
        )
        anticipos = [
            r
            for r in recibos
            if r.get("concepto") == "anticipo"
            and r.get("movimiento_id") == resultado["movimiento_caja_id"]
        ]
        assert len(anticipos) == 1
        assert anticipos[0]["monto"] == 12000.0
        assert "Ana" in anticipos[0]["cliente_nombre"]
    finally:
        _cleanup(ids)


def test_ajuste_sin_caja_no_genera_recibo():
    world = seed_base_world()
    ids: dict = {"cliente_id": world.cliente_id, "metodo_id": None}
    try:
        svc = PagosServices()
        data = CreditoManualRequest(
            cliente_id=world.cliente_id,
            monto=500.0,
            concepto="Ajuste comercial sin dinero",
            registrar_en_caja=False,
        )
        resultado = svc.registrar_credito_manual(data, world.usuario_id)
        assert resultado["registrado_en_caja"] is False
        assert resultado.get("recibo") is None
    finally:
        _cleanup(ids)
