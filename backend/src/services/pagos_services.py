from pony.orm import db_session, select, desc
from fastapi import HTTPException
from datetime import datetime
from src.models import Presupuesto, CuentaCorriente, OrdenTrabajo, Cliente, CuentaDestino
from src.schemas import PagoAdicionalRequest

class PagosServices:
    def __init__(self):
        pass

    def registrar_pago_adicional(self, data: PagoAdicionalRequest, usuario_id: int) -> dict:
        with db_session:
            try:
                from src.models import Usuario, Sucursal
                from src.services.caja_services import CajaServices
                
                presupuesto = Presupuesto.get(id=data.presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                if not presupuesto.orden_trabajo:
                    raise HTTPException(status_code=404, detail="Presupuesto no tiene orden de trabajo")
                
                # Obtener usuario y sucursal
                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                # Obtener sucursal del primer producto del presupuesto o del usuario
                sucursal = None
                if presupuesto.items:
                    primer_item = list(presupuesto.items)[0]
                    if primer_item.producto:
                        sucursal = primer_item.producto.sucursal
                
                if not sucursal and usuario.sucursal:
                    sucursal = usuario.sucursal
                
                if not sucursal:
                    raise HTTPException(status_code=400, detail="No se pudo determinar la sucursal")

                # Validar cuenta destino obligatoria
                cuenta_destino_id = data.cuenta_destino_id
                if not cuenta_destino_id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino es obligatoria para los pagos adicionales"
                    )
                
                cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                if not cuenta_destino:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Verificar que la cuenta destino pertenece a la sucursal
                if cuenta_destino.sucursal.id != sucursal.id:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino debe pertenecer a la sucursal"
                    )
                
                # Verificar que la cuenta destino está activa
                if not cuenta_destino.activa:
                    raise HTTPException(
                        status_code=400,
                        detail="La cuenta destino seleccionada está inactiva"
                    )

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

                # Creamos movimiento de cuenta corriente
                movimiento = CuentaCorriente(
                    cliente=cliente,
                    concepto=data.concepto,
                    tipo="credito",
                    monto=data.monto,
                    saldo_post=saldo_anterior + data.monto,
                    referencia_orden=orden.id,
                    fecha=datetime.now()
                )
                
                # Validar y obtener método de pago (nuevo sistema o compatibilidad)
                metodo_pago_configurable = None
                submetodo_pago = None
                
                if data.metodo_pago_id:
                    # Usar nuevo sistema de métodos configurables
                    from src.services.metodos_pago_services import MetodosPagoServices
                    metodos_pago_service = MetodosPagoServices()
                    metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                        data.metodo_pago_id,
                        data.submetodo_pago_id,
                        sucursal.id
                    )
                    # Actualizar método de pago en la orden si corresponde
                    orden.metodo_pago_configurable = metodo_pago_configurable
                    orden.submetodo_pago = submetodo_pago
                
                # Crear movimiento de caja
                caja_service = CajaServices()
                movimiento_caja_data = {
                    "tipo": "INGRESO",
                    "monto": data.monto,
                    "metodo_pago_id": data.metodo_pago_id,  # Nuevo sistema
                    "submetodo_pago_id": data.submetodo_pago_id,  # Nuevo sistema
                    "payment_method": data.metodo_pago or None,  # Compatibilidad hacia atrás
                    "origen": f"PAGO_ADICIONAL:{orden.id}",
                    "categoria": "PAGOS_ADICIONALES",
                    "sucursal_id": sucursal.id,
                    "cuenta_destino_id": cuenta_destino_id
                }
                caja_service.create_movimiento(movimiento_caja_data, usuario_id)
                
                # Actualizar movimiento de cuenta corriente con método de pago si se usa nuevo sistema
                if metodo_pago_configurable:
                    movimiento.metodo_pago_configurable = metodo_pago_configurable
                    movimiento.submetodo_pago = submetodo_pago

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