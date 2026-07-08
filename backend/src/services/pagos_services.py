from pony.orm import db_session
from fastapi import HTTPException
from datetime import datetime
from typing import Optional

from src.models import Presupuesto, CuentaCorriente, Cliente, CuentaDestino
from src.money import round_pesos
from src.fechas_ar import ahora_ar
from src.schemas import PagoAdicionalRequest, CreditoManualRequest


class PagosServices:
    """Servicio de pagos y cuenta corriente. La cadena saldo_post se calcula siempre aquí."""

    def __init__(self):
        pass

    def saldo_actual_para_cliente_objeto(self, cliente: Cliente) -> float:
        """Saldo vigente del cliente (último saldo_post). Debe ejecutarse dentro de db_session."""
        # Evitar rutas de traducción de consultas de Pony que fallan en Python 3.14.
        movimientos = list(cliente.cuentas_corrientes)
        ultimo_mov = max(movimientos, key=lambda m: m.fecha) if movimientos else None
        return float(ultimo_mov.saldo_post) if ultimo_mov else 0.0

    def append_movimiento_cuenta_corriente(
        self,
        cliente: Cliente,
        tipo: str,
        monto: float,
        concepto: str,
        referencia_orden: Optional[int] = None,
        metodo_pago_configurable=None,
        submetodo_pago=None,
    ) -> CuentaCorriente:
        """
        Registra un movimiento y recalcula saldo_post en base al último movimiento.
        tipo: 'credito' suma al saldo, 'debito' resta (usa saldo a favor).
        """
        if monto <= 0:
            raise HTTPException(
                status_code=400, detail="El monto del movimiento en cuenta corriente debe ser mayor a cero"
            )
        saldo_ant = self.saldo_actual_para_cliente_objeto(cliente)
        if tipo == "credito":
            saldo_post = saldo_ant + monto
        elif tipo == "debito":
            if saldo_ant + 1e-9 < monto:
                raise HTTPException(
                    status_code=400,
                    detail="Saldo a favor insuficiente para aplicar el monto indicado",
                )
            saldo_post = saldo_ant - monto
        else:
            raise HTTPException(status_code=400, detail="Tipo de movimiento de cuenta corriente inválido")

        return CuentaCorriente(
            cliente=cliente,
            concepto=concepto,
            tipo=tipo,
            monto=monto,
            saldo_post=saldo_post,
            referencia_orden=referencia_orden,
            fecha=ahora_ar(),
            metodo_pago_configurable=metodo_pago_configurable,
            submetodo_pago=submetodo_pago,
        )

    def registrar_credito_manual(self, data: CreditoManualRequest, usuario_id: int) -> dict:
        """
        Alta de saldo a favor en cuenta corriente.
        Si registrar_en_caja=True (pago real del cliente), también ingresa en caja diaria.
        Si registrar_en_caja=False (ajuste comercial sin dinero), solo mueve cuenta corriente.
        """
        with db_session:
            try:
                from src.models import Usuario, CuentaDestino
                from src.services.caja_services import CajaServices

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                if not usuario.sucursal:
                    raise HTTPException(
                        status_code=400,
                        detail="El usuario no tiene sucursal asignada",
                    )

                cliente = Cliente.get(id=data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                monto = float(data.monto)
                texto = (data.concepto or "").strip() or "Crédito manual"
                metodo_pago_configurable = None
                submetodo_pago = None
                movimiento_caja_id = None

                if data.registrar_en_caja:
                    cuenta_destino = CuentaDestino.get(id=data.cuenta_destino_id)
                    if not cuenta_destino:
                        raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                    if cuenta_destino.sucursal.id != usuario.sucursal.id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino debe pertenecer a la sucursal del usuario",
                        )
                    if not cuenta_destino.activa:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino seleccionada está inactiva",
                        )

                    from src.services.metodos_pago_services import MetodosPagoServices

                    metodos_pago_service = MetodosPagoServices()
                    metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                        data.metodo_pago_id,
                        data.submetodo_pago_id,
                        usuario.sucursal.id,
                    )

                    caja_service = CajaServices()
                    movimiento_caja = caja_service.create_movimiento(
                        {
                            "tipo": "INGRESO",
                            "monto": monto,
                            "metodo_pago_id": data.metodo_pago_id,
                            "submetodo_pago_id": data.submetodo_pago_id,
                            "origen": f"PAGO_CUENTA_CORRIENTE:{cliente.id}",
                            "categoria": "CUENTA_CORRIENTE",
                            "sucursal_id": usuario.sucursal.id,
                            "cuenta_destino_id": data.cuenta_destino_id,
                        },
                        usuario_id,
                    )
                    movimiento_caja_id = movimiento_caja.id

                mov = self.append_movimiento_cuenta_corriente(
                    cliente,
                    "credito",
                    monto,
                    texto,
                    None,
                    metodo_pago_configurable,
                    submetodo_pago,
                )

                return {
                    "mensaje": "Crédito registrado correctamente",
                    "movimiento_id": mov.id,
                    "saldo_post": mov.saldo_post,
                    "cliente_id": data.cliente_id,
                    "movimiento_caja_id": movimiento_caja_id,
                    "registrado_en_caja": bool(data.registrar_en_caja),
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Error al registrar crédito manual: {str(e)}"
                )

    def registrar_pago_adicional(self, data: PagoAdicionalRequest, usuario_id: int) -> dict:
        with db_session:
            try:
                from src.models import Usuario
                from src.services.caja_services import CajaServices

                presupuesto = Presupuesto.get(id=data.presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if not presupuesto.orden_trabajo:
                    raise HTTPException(status_code=404, detail="Presupuesto no tiene orden de trabajo")

                usuario = Usuario.get(id=usuario_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                sucursal = None
                if presupuesto.items:
                    primer_item = list(presupuesto.items)[0]
                    if primer_item.producto:
                        sucursal = primer_item.producto.sucursal

                if not sucursal and usuario.sucursal:
                    sucursal = usuario.sucursal

                if not sucursal:
                    raise HTTPException(status_code=400, detail="No se pudo determinar la sucursal")

                orden = presupuesto.orden_trabajo
                cliente = presupuesto.cliente
                credito_aplicado = round_pesos(data.credito_aplicado or 0)
                monto_total = round_pesos(data.monto)
                monto_efectivo = round_pesos(max(monto_total - credito_aplicado, 0))

                if credito_aplicado > 1e-9 and not cliente:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede aplicar saldo a favor sin cliente en el presupuesto",
                    )

                if credito_aplicado > monto_total + 1e-9:
                    raise HTTPException(
                        status_code=400,
                        detail="El crédito aplicado no puede superar el monto total del pago",
                    )

                if monto_efectivo > 1e-9:
                    cuenta_destino_id = data.cuenta_destino_id
                    if not cuenta_destino_id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino es obligatoria cuando hay importe registrado en caja",
                        )
                    cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
                    if not cuenta_destino:
                        raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                    if cuenta_destino.sucursal.id != sucursal.id:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino debe pertenecer a la sucursal",
                        )
                    if not cuenta_destino.activa:
                        raise HTTPException(
                            status_code=400,
                            detail="La cuenta destino seleccionada está inactiva",
                        )
                else:
                    cuenta_destino_id = None

                orden.seña_pagada = round_pesos(orden.seña_pagada + monto_total)
                orden.saldo_pendiente = max(
                    0, round_pesos(round_pesos(presupuesto.total) - orden.seña_pagada)
                )
                if orden.saldo_pendiente == 0:
                    orden.estado = "Pagada"

                metodo_pago_configurable = None
                submetodo_pago = None

                if monto_efectivo > 1e-9:
                    if data.metodo_pago_id:
                        from src.services.metodos_pago_services import MetodosPagoServices

                        metodos_pago_service = MetodosPagoServices()
                        metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                            data.metodo_pago_id,
                            data.submetodo_pago_id,
                            sucursal.id,
                        )
                        orden.metodo_pago_configurable = metodo_pago_configurable
                        orden.submetodo_pago = submetodo_pago
                    elif data.metodo_pago:
                        pass
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Debe indicar método de pago cuando hay importe en caja",
                        )

                if cliente and credito_aplicado > 1e-9:
                    self.append_movimiento_cuenta_corriente(
                        cliente,
                        "debito",
                        credito_aplicado,
                        f"Uso saldo a favor — {data.concepto or 'Pago adicional'}",
                        orden.id,
                        None,
                        None,
                    )

                if monto_efectivo > 1e-9:
                    caja_service = CajaServices()
                    movimiento_caja_data = {
                        "tipo": "INGRESO",
                        "monto": monto_efectivo,
                        "metodo_pago_id": data.metodo_pago_id,
                        "submetodo_pago_id": data.submetodo_pago_id,
                        "payment_method": data.metodo_pago or None,
                        "origen": f"PAGO_ADICIONAL:{orden.id}",
                        "categoria": "PAGOS_ADICIONALES",
                        "sucursal_id": sucursal.id,
                        "cuenta_destino_id": cuenta_destino_id,
                    }
                    caja_service.create_movimiento(movimiento_caja_data, usuario_id)

                saldo_cc = self.saldo_actual_para_cliente_objeto(cliente) if cliente else 0.0

                return {
                    "mensaje": "Pago registrado correctamente",
                    "nuevo_saldo": saldo_cc,
                    "saldo_pendiente": orden.saldo_pendiente,
                    "credito_aplicado": credito_aplicado,
                    "monto_caja": max(monto_efectivo, 0),
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

                movimientos = list(cliente.cuentas_corrientes)
                movimientos.sort(key=lambda mov: mov.fecha, reverse=True)

                return [
                    {
                        "id": mov.id,
                        "fecha": mov.fecha.isoformat() if mov.fecha else None,
                        "concepto": mov.concepto,
                        "tipo": mov.tipo,
                        "monto": mov.monto,
                        "saldo_post": mov.saldo_post,
                        "referencia_orden": mov.referencia_orden,
                    }
                    for mov in movimientos
                ]
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener movimientos: {str(e)}")

    def recalcular_saldo_cliente(self, cliente_id: int) -> dict:
        """
        Recalcula saldo_post de todos los movimientos del cliente en orden cronológico.
        Útil tras corregir movimientos erróneos en base de datos.
        """
        with db_session:
            cliente = Cliente.get(id=cliente_id)
            if not cliente:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            movimientos = sorted(cliente.cuentas_corrientes, key=lambda m: (m.fecha, m.id))
            saldo = 0.0
            for mov in movimientos:
                if mov.tipo == "credito":
                    saldo += float(mov.monto)
                elif mov.tipo == "debito":
                    saldo -= float(mov.monto)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Movimiento {mov.id} con tipo inválido: {mov.tipo}",
                    )
                mov.saldo_post = saldo
            return {
                "cliente_id": cliente_id,
                "saldo_actual": round(saldo, 2),
                "movimientos_actualizados": len(movimientos),
            }

    def obtener_saldo_actual_cliente(self, cliente_id: int) -> dict:
        with db_session:
            try:
                cliente = Cliente.get(id=cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                saldo_actual = self.saldo_actual_para_cliente_objeto(cliente)
                movimientos = list(cliente.cuentas_corrientes)
                ultimo_mov = max(movimientos, key=lambda m: m.fecha) if movimientos else None

                return {
                    "cliente_id": int(cliente.id),
                    "cliente_nombre": f"{cliente.apellido} {cliente.nombre}".strip(),
                    "saldo_actual": round(saldo_actual, 2),
                    "ultimo_movimiento": ultimo_mov.fecha.isoformat()
                    if ultimo_mov and ultimo_mov.fecha
                    else None,
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al obtener saldo: {str(e)}")
