from fastapi import APIRouter, HTTPException
from pony.orm import db_session, select, desc
from datetime import datetime
from src.models import Presupuesto, CuentaCorriente, OrdenTrabajo
from pydantic import BaseModel


class PagoAdicionalRequest(BaseModel):
    presupuesto_id: int
    monto: float
    metodo_pago: str
    concepto: str = "Pago adicional"


router = APIRouter()

@router.post("/adicional")
@db_session
def registrar_pago_adicional(data: PagoAdicionalRequest):
    presupuesto = Presupuesto.get(id=data.presupuesto_id)
    if not presupuesto or not presupuesto.orden_trabajo:
        raise HTTPException(status_code=404, detail="Presupuesto u orden de trabajo no encontrada")

    orden = presupuesto.orden_trabajo
    cliente = presupuesto.cliente

    # Actualizamos seña y saldo
    orden.seña_pagada += data.monto
    orden.saldo_pendiente = max(presupuesto.total - orden.seña_pagada, 0)
    if orden.saldo_pendiente == 0:
        orden.estado = "Pagado"

    # Obtenemos último saldo registrado
    ultimo_mov = select(m for m in CuentaCorriente if m.cliente == cliente).order_by(desc(CuentaCorriente.fecha)).first()
    saldo_anterior = ultimo_mov.saldo_post if ultimo_mov else 0

    # Creamos movimiento
    movimiento = CuentaCorriente(
        cliente=cliente,
        concepto=data.concepto,
        tipo="credito",
        monto=data.monto,
        saldo_post=saldo_anterior + data.monto,
        referencia_orden=orden.id
    )

    return {
        "mensaje": "Pago registrado correctamente",
        "nuevo_saldo": movimiento.saldo_post,
        "saldo_pendiente": orden.saldo_pendiente
    }
