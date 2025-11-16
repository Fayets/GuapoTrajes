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
<<<<<<< HEAD
                
                presupuesto = Presupuesto.get(id=data.presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                if not presupuesto.orden_trabajo:
                    raise HTTPException(status_code=404, detail="Presupuesto no tiene orden de trabajo")
                
=======
                print(f"🔍 Iniciando registro de pago adicional...")
                print(f"   Presupuesto ID: {data.presupuesto_id}")
                print(f"   Monto: {data.monto}")
                print(f"   Método: {data.metodo_pago}")
                print(f"   Concepto: {data.concepto}")
                
                presupuesto = Presupuesto.get(id=data.presupuesto_id)
                if not presupuesto:
                    print(f"❌ Presupuesto no encontrado: {data.presupuesto_id}")
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                if not presupuesto.orden_trabajo:
                    print(f"❌ Presupuesto no tiene orden de trabajo: {data.presupuesto_id}")
                    raise HTTPException(status_code=404, detail="Presupuesto no tiene orden de trabajo")
                
                print(f"✅ Presupuesto encontrado: {presupuesto.numero}")
                print(f"✅ Orden de trabajo encontrada: {presupuesto.orden_trabajo.id}")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

                orden = presupuesto.orden_trabajo
                cliente = presupuesto.cliente

<<<<<<< HEAD
=======
                print(f"💰 Seña actual: {orden.seña_pagada}")
                print(f"💰 Saldo pendiente actual: {orden.saldo_pendiente}")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

                # Actualizamos seña y saldo
                orden.seña_pagada += data.monto
                orden.saldo_pendiente = max(presupuesto.total - orden.seña_pagada, 0)
                if orden.saldo_pendiente == 0:
                    orden.estado = "Pagado"

<<<<<<< HEAD
=======
                print(f"💰 Nueva seña: {orden.seña_pagada}")
                print(f"💰 Nuevo saldo pendiente: {orden.saldo_pendiente}")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

                # Obtenemos último saldo registrado
                ultimo_mov = CuentaCorriente.select(lambda m: m.cliente.id == cliente.id).order_by(desc(CuentaCorriente.fecha)).first()
                saldo_anterior = ultimo_mov.saldo_post if ultimo_mov else 0
<<<<<<< HEAD

                # Creamos movimiento
=======
                print(f"💰 Saldo anterior en cuenta corriente: {saldo_anterior}")

                # Creamos movimiento
                print(f"📝 Creando movimiento en cuenta corriente...")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                movimiento = CuentaCorriente(
                    cliente=cliente,
                    concepto=data.concepto,
                    tipo="credito",
                    monto=data.monto,
                    saldo_post=saldo_anterior + data.monto,
                    referencia_orden=orden.id,
                    fecha=datetime.now()
                )
<<<<<<< HEAD
=======
                print(f"✅ Movimiento creado con ID: {movimiento.id}")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

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