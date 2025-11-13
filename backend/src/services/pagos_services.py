from pony.orm import db_session, select, desc
from fastapi import HTTPException
from datetime import datetime
from src.models import Presupuesto, CuentaCorriente, OrdenTrabajo, Cliente
from src.schemas import PagoAdicionalRequest

class PagosServices:
    def __init__(self):
        pass

    def registrar_pago_adicional(self, data: PagoAdicionalRequest) -> dict:
        with db_session:
            try:
                
                presupuesto = Presupuesto.get(id=data.presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                if not presupuesto.orden_trabajo:
                    raise HTTPException(status_code=404, detail="Presupuesto no tiene orden de trabajo")
                

                orden = presupuesto.orden_trabajo
                cliente = presupuesto.cliente


                # Actualizamos seña y saldo
                orden.seña_pagada += data.monto
                orden.saldo_pendiente = max(presupuesto.total - orden.seña_pagada, 0)
                if orden.saldo_pendiente == 0:
                    orden.estado = "Pagado"


                # Obtenemos último saldo registrado
                ultimo_mov = CuentaCorriente.select(lambda m: m.cliente.id == cliente.id).order_by(desc(CuentaCorriente.fecha)).first()
                saldo_anterior = ultimo_mov.saldo_post if ultimo_mov else 0

                # Creamos movimiento
                movimiento = CuentaCorriente(
                    cliente=cliente,
                    concepto=data.concepto,
                    tipo="credito",
                    monto=data.monto,
                    saldo_post=saldo_anterior + data.monto,
                    referencia_orden=orden.id,
                    fecha=datetime.now()
                )

                return {
                    "mensaje": "Pago registrado correctamente",
                    "nuevo_saldo": movimiento.saldo_post,
                    "saldo_pendiente": orden.saldo_pendiente
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en registrar_pago_adicional: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al registrar pago: {str(e)}")

    def obtener_movimientos_cliente(self, cliente_id: int) -> list:
        with db_session:
            try:
                cliente = Cliente.get(id=cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                movimientos = list(CuentaCorriente.select(lambda m: m.cliente.id == cliente.id).order_by(desc(CuentaCorriente.fecha)))

                return [
                    {
                        "id": mov.id,
                        "fecha": mov.fecha.isoformat() if mov.fecha else None,
                        "concepto": mov.concepto,
                        "tipo": mov.tipo,
                        "monto": mov.monto,
                        "saldo_post": mov.saldo_post,
                        "referencia_orden": mov.referencia_orden
                    }
                    for mov in movimientos
                ]
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener movimientos: {str(e)}")

    def obtener_saldo_actual_cliente(self, cliente_id: int) -> dict:
        with db_session:
            try:
                cliente = Cliente.get(id=cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                ultimo_mov = CuentaCorriente.select(lambda m: m.cliente.id == cliente.id).order_by(desc(CuentaCorriente.fecha)).first()
                saldo_actual = ultimo_mov.saldo_post if ultimo_mov else 0

                return {
                    "cliente_id": cliente_id,
                    "cliente_nombre": f"{cliente.nombre} {cliente.apellido}",
                    "saldo_actual": saldo_actual,
                    "ultimo_movimiento": ultimo_mov.fecha.isoformat() if ultimo_mov and ultimo_mov.fecha else None
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener saldo: {str(e)}") 