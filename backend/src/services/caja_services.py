from decimal import Decimal, InvalidOperation
from pony.orm import db_session, select, sum, count, flush
from datetime import date, datetime
from src.models import CajaMovimiento, Venta, Usuario, Sucursal, TipoMovimiento, MetodoPago, CuentaDestino
from fastapi import HTTPException
from typing import List, Dict, Optional
from src.services.caja_chica_services import CajaChicaService
from src.services.caja_concentradora_services import CajaConcentradoraServices

class CajaServices:
    
    def __init__(self):
        self._caja_chica_service = CajaChicaService()
        self._caja_concentradora_service = CajaConcentradoraServices()

    @db_session
    def create_movimiento(self, movimiento_data: dict, usuario_id: int) -> CajaMovimiento:
        """Crear un movimiento de caja"""
        # Obtener usuario y sucursal
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        sucursal = Sucursal.get(id=movimiento_data["sucursal_id"])
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        # Validar cuenta destino obligatoria para INGRESO
        tipo_movimiento = movimiento_data.get("tipo")
        if tipo_movimiento in (TipoMovimiento.INGRESO.value, TipoMovimiento.AJUSTE_POSITIVO.value):
            cuenta_destino_id = movimiento_data.get("cuenta_destino_id")
            if not cuenta_destino_id:
                raise HTTPException(
                    status_code=400,
                    detail="La cuenta destino es obligatoria para ingresos"
                )
            
            cuenta_destino = CuentaDestino.get(id=cuenta_destino_id)
            if not cuenta_destino:
                raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
            
            # Verificar que la cuenta destino pertenece a la sucursal
            if cuenta_destino.sucursal.id != sucursal.id:
                raise HTTPException(
                    status_code=400,
                    detail="La cuenta destino debe pertenecer a la sucursal del movimiento"
                )
            
            # Verificar que la cuenta destino está activa
            if not cuenta_destino.activa:
                raise HTTPException(
                    status_code=400,
                    detail="La cuenta destino seleccionada está inactiva"
                )
        else:
            cuenta_destino = None
        
        # Crear el movimiento
        venta = None
        if movimiento_data.get("venta_id"):
            venta = Venta.get(id=movimiento_data["venta_id"])
        
        # Usar la categoría proporcionada o determinar automáticamente
        categoria = movimiento_data.get("categoria")
        if not categoria:
            categoria = self._determinar_categoria_automatica(
                movimiento_data["tipo"], 
                movimiento_data["origen"]
            )
        
        # Validar y obtener método de pago (nuevo sistema o compatibilidad)
        metodo_pago_configurable = None
        submetodo_pago = None
        payment_method_enum = None
        
        if movimiento_data.get("metodo_pago_id"):
            # Usar nuevo sistema de métodos configurables
            from src.services.metodos_pago_services import MetodosPagoServices
            metodos_pago_service = MetodosPagoServices()
            metodo_pago_configurable, submetodo_pago = metodos_pago_service.validar_metodo_pago(
                movimiento_data["metodo_pago_id"],
                movimiento_data.get("submetodo_pago_id"),
                sucursal.id
            )
        elif movimiento_data.get("payment_method"):
            # Sistema antiguo - mantener compatibilidad
            from src.models import MetodoPago
            try:
                payment_method_enum = MetodoPago(movimiento_data["payment_method"])
            except ValueError:
                # Si no es un enum válido, dejarlo como None
                pass
        
        movimiento_kwargs = {
            "fecha_hora": datetime.now(),
            "tipo": movimiento_data["tipo"],
            "monto": float(movimiento_data["monto"]),
            "payment_method": payment_method_enum,  # Para compatibilidad (opcional)
            "metodo_pago_configurable": metodo_pago_configurable,  # Nueva relación
            "submetodo_pago": submetodo_pago,  # Nueva relación
            "origen": movimiento_data["origen"],
            "categoria": categoria,
            "venta": venta,
            "usuario": usuario,
            "sucursal": sucursal,
            "cuenta_destino": cuenta_destino,
        }

        destino = movimiento_data.get("destino")
        if destino:
            movimiento_kwargs["destino"] = destino

        movimiento = CajaMovimiento(**movimiento_kwargs)
        flush()
        
        return movimiento

    @db_session
    def transferir_a_caja_chica(self, transferencia_data: dict, usuario_id: int) -> Dict:
        """Registrar transferencia en efectivo desde Caja Diaria hacia Caja Chica."""
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        sucursal_id = transferencia_data.get("sucursal_id") or (usuario.sucursal.id if usuario.sucursal else None)
        if not sucursal_id:
            raise HTTPException(status_code=400, detail="Debe indicar una sucursal")

        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")

        monto_raw = transferencia_data.get("monto")
        if monto_raw in (None, "", 0):
            raise HTTPException(status_code=400, detail="El monto es requerido")

        try:
            monto = Decimal(str(monto_raw))
        except (InvalidOperation, TypeError):
            raise HTTPException(status_code=400, detail="El monto debe ser numérico")

        if monto <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")

        descripcion = transferencia_data.get("descripcion") or "Transferencia a Caja Chica"

        movimiento = CajaMovimiento(
            fecha_hora=datetime.now(),
            tipo=TipoMovimiento.EGRESO,
            monto=float(monto),
            payment_method=MetodoPago.EFECTIVO,
            origen="TRANSFERENCIA_CAJA_CHICA",
            categoria="TRANSFERENCIA_INTERNA",
            destino="CAJA_CHICA",
            usuario=usuario,
            sucursal=sucursal,
        )
        flush()
        movimiento_id = movimiento.id

        ingreso_caja_chica = self._caja_chica_service.registrar_ingreso_desde_caja_diaria(
            sucursal_id=sucursal.id,
            usuario_id=usuario.id,
            monto=monto,
            descripcion=descripcion,
            caja_movimiento_id=movimiento_id,
        )

        tipo_movimiento = movimiento.tipo.value if hasattr(movimiento.tipo, "value") else str(movimiento.tipo)
        metodo_pago_mov = (
            movimiento.payment_method.value
            if movimiento.payment_method and hasattr(movimiento.payment_method, "value")
            else str(movimiento.payment_method) if movimiento.payment_method else "EFECTIVO"
        )

        estado_ingreso = (
            ingreso_caja_chica.estado.value
            if hasattr(ingreso_caja_chica.estado, "value")
            else str(ingreso_caja_chica.estado)
        )
        metodo_pago_ingreso = (
            ingreso_caja_chica.metodo_pago.value
            if ingreso_caja_chica.metodo_pago and hasattr(ingreso_caja_chica.metodo_pago, "value")
            else str(ingreso_caja_chica.metodo_pago)
        )

        return {
            "message": "Dinero transferido a Caja Chica correctamente",
            "success": True,
            "data": {
                "caja_diaria": {
                    "movimiento_id": movimiento_id,
                    "fecha_hora": movimiento.fecha_hora,
                    "tipo": tipo_movimiento,
                    "metodo_pago": metodo_pago_mov,
                    "destino": movimiento.destino,
                    "monto": float(movimiento.monto),
                    "descripcion": descripcion,
                    "sucursal_id": movimiento.sucursal.id,
                    "usuario_id": movimiento.usuario.id,
                },
                "caja_chica": {
                    "movimiento_id": ingreso_caja_chica.id,
                    "fecha": ingreso_caja_chica.fecha,
                    "monto": float(ingreso_caja_chica.monto),
                    "descripcion": ingreso_caja_chica.descripcion,
                    "estado": estado_ingreso,
                    "metodo_pago": metodo_pago_ingreso,
                    "referencia": ingreso_caja_chica.referencia,
                },
            },
        }

    @db_session
    def transferir_a_caja_concentradora(self, transferencia_data: dict, usuario_id: int) -> Dict:
        """Registrar transferencia en efectivo desde Caja Diaria hacia Caja Concentradora."""
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        sucursal_id = transferencia_data.get("sucursal_id") or (usuario.sucursal.id if usuario.sucursal else None)
        if not sucursal_id:
            raise HTTPException(status_code=400, detail="Debe indicar una sucursal")

        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")

        monto_raw = transferencia_data.get("monto")
        if monto_raw in (None, "", 0):
            raise HTTPException(status_code=400, detail="El monto es requerido")

        try:
            monto = Decimal(str(monto_raw))
        except (InvalidOperation, TypeError):
            raise HTTPException(status_code=400, detail="El monto debe ser numérico")

        if monto <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")

        descripcion = transferencia_data.get("descripcion") or "Transferencia a Caja Concentradora"

        movimiento = CajaMovimiento(
            fecha_hora=datetime.now(),
            tipo=TipoMovimiento.EGRESO,
            monto=float(monto),
            payment_method=MetodoPago.EFECTIVO,
            origen="TRANSFERENCIA_CAJA_CONCENTRADORA",
            categoria="TRANSFERENCIA_INTERNA",
            destino="CAJA_CONCENTRADORA",
            usuario=usuario,
            sucursal=sucursal,
        )
        flush()
        movimiento_id = movimiento.id

        ingreso_concentradora = self._caja_concentradora_service.registrar_ingreso_desde_caja_diaria(
            sucursal_id=sucursal.id,
            usuario_id=usuario.id,
            monto=monto,
            descripcion=descripcion,
            caja_movimiento_id=movimiento_id,
        )

        tipo_movimiento = movimiento.tipo.value if hasattr(movimiento.tipo, "value") else str(movimiento.tipo)
        metodo_pago_mov = (
            movimiento.payment_method.value
            if movimiento.payment_method and hasattr(movimiento.payment_method, "value")
            else str(movimiento.payment_method) if movimiento.payment_method else "EFECTIVO"
        )

        estado_ingreso = (
            ingreso_concentradora.estado.value
            if hasattr(ingreso_concentradora.estado, "value")
            else str(ingreso_concentradora.estado)
        )

        return {
            "message": "Dinero transferido a Caja Concentradora correctamente",
            "success": True,
            "data": {
                "caja_diaria": {
                    "movimiento_id": movimiento_id,
                    "fecha_hora": movimiento.fecha_hora,
                    "tipo": tipo_movimiento,
                    "metodo_pago": metodo_pago_mov,
                    "destino": movimiento.destino,
                    "monto": float(movimiento.monto),
                    "descripcion": descripcion,
                    "sucursal_id": movimiento.sucursal.id,
                    "usuario_id": movimiento.usuario.id,
                },
                "caja_concentradora": {
                    "movimiento_id": ingreso_concentradora.id,
                    "fecha": ingreso_concentradora.fecha.isoformat() if ingreso_concentradora.fecha else None,
                    "monto": float(ingreso_concentradora.monto),
                    "descripcion": ingreso_concentradora.descripcion,
                    "estado": estado_ingreso,
                    "origen": ingreso_concentradora.origen.value if hasattr(ingreso_concentradora.origen, "value") else str(ingreso_concentradora.origen) if ingreso_concentradora.origen else None,
                },
            },
        }

    def _determinar_categoria_automatica(self, tipo: str, origen: str) -> str:
        """Determinar categoría automáticamente basada en el tipo y origen"""
        if tipo == "INGRESO":
            if origen.startswith("VENTA:"):
                return "VENTAS"
            elif origen.startswith("SEÑA_PRESUPUESTO:"):
                return "SEÑAS"
            elif origen.startswith("PAGO_ADICIONAL_ORDEN:"):
                return "PAGOS_ADICIONALES"
            elif any(palabra in origen.upper() for palabra in ["SERVICIO", "SERVICIOS"]):
                return "SERVICIOS"
            else:
                return "OTROS_INGRESOS"
        elif tipo == "EGRESO":
            origen_upper = origen.upper()
            if any(palabra in origen_upper for palabra in ["ADMINISTRATIVO", "ADMINISTRACION", "OFICINA", "ADMIN"]):
                return "ADMINISTRATIVOS"
            elif any(palabra in origen_upper for palabra in ["OPERATIVO", "OPERACION", "PRODUCCION", "FABRICA"]):
                return "OPERATIVOS"
            elif any(palabra in origen_upper for palabra in ["COMERCIAL", "VENTA", "MARKETING", "PUBLICIDAD"]):
                return "COMERCIALES"
            else:
                return "OTROS_EGRESOS"
        else:
            return "OTROS_EGRESOS" if tipo in ["EGRESO", "AJUSTE_NEGATIVO"] else "OTROS_INGRESOS"

    @db_session
    def get_movimientos_diarios(self, fecha: date, sucursal_id: int, payment_method: Optional[str] = None, cuenta_destino_id: Optional[int] = None) -> List[Dict]:
        """Obtener movimientos de caja del día"""
        try:
            # Obtener todos los movimientos y filtrar en Python para evitar problemas de compatibilidad
            all_movimientos = list(CajaMovimiento.select())

            # Helper interno para mapear métodos configurables / strings al enum antiguo
            def _mapear_metodo_a_enum(metodo: Optional[str]) -> Optional[str]:
                if not metodo:
                    return None
                metodo_lower = metodo.lower()
                
                if "efectivo" in metodo_lower:
                    return "EFECTIVO"
                if "debito" in metodo_lower or "débito" in metodo_lower:
                    return "DEBITO"
                if "credito" in metodo_lower or "crédito" in metodo_lower:
                    return "CREDITO"
                if (
                    "billetera" in metodo_lower 
                    or "mercado pago" in metodo_lower 
                    or "naranja" in metodo_lower 
                    or "uala" in metodo_lower
                ):
                    return "BILLETERA_VIRTUAL"
                if "transferencia" in metodo_lower:
                    return "TRANSFERENCIA"
                
                # Si no coincide, devolver el original (para compatibilidad)
                return metodo
            
            # Filtrar por fecha y sucursal
            movimientos_filtrados = []
            for cm in all_movimientos:
                if cm.fecha_hora.date() != fecha or cm.sucursal.id != sucursal_id:
                    continue

                # Determinar método de pago del movimiento (display)
                metodo_movimiento_display = None
                if cm.metodo_pago_configurable:
                    metodo_movimiento_display = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo_movimiento_display = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, "value"):
                        metodo_movimiento_display = cm.payment_method.value
                    else:
                        metodo_movimiento_display = str(cm.payment_method)

                # Aplicar filtro por método, si existe
                if payment_method:
                    metodo_enum_mov = _mapear_metodo_a_enum(metodo_movimiento_display)
                    # Normalizar ambos para comparar
                    if not metodo_enum_mov or metodo_enum_mov.lower() != payment_method.lower():
                        continue

                # Verificar filtro de cuenta destino
                if cuenta_destino_id:
                    if not (cm.cuenta_destino and cm.cuenta_destino.id == cuenta_destino_id):
                        continue

                movimientos_filtrados.append(cm)
            
            # Ordenar por hora descendente (más reciente primero)
            movimientos_filtrados.sort(key=lambda x: x.fecha_hora, reverse=True)
            
            movimientos = []
            for cm in movimientos_filtrados:
                # Determinar método de pago a mostrar (nuevo sistema o compatibilidad)
                metodo_pago_display = None
                if cm.metodo_pago_configurable:
                    metodo_pago_display = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo_pago_display = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo_pago_display = cm.payment_method.value
                    else:
                        metodo_pago_display = str(cm.payment_method)
                
                # Usar la categoría del modelo si existe, sino determinar automáticamente
                categoria = cm.categoria if cm.categoria else self._determinar_categoria_automatica(cm.tipo, cm.origen)
                
                # Obtener nombre de cuenta destino si existe
                cuenta_destino_nombre = None
                if cm.cuenta_destino:
                    cuenta_destino_nombre = cm.cuenta_destino.nombre_titular
                
                movimientos.append({
                    "id": cm.id,
                    "hora": cm.fecha_hora.strftime("%H:%M"),
                    "origen": cm.origen,
                    "tipo": cm.tipo,
                    "payment_method": metodo_pago_display or "SIN_METODO",
                    "categoria": categoria,
                    "monto": cm.monto,
                    "usuario_nombre": f"{cm.usuario.nombre} {cm.usuario.apellido}",
                    "cuenta_destino_nombre": cuenta_destino_nombre
                })
            
            return movimientos
            
        except Exception as e:
            print(f"❌ Error al obtener movimientos diarios: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener movimientos diarios")
    
    @db_session
    def get_totales_diarios(self, fecha: date, sucursal_id: int) -> Dict:
        """Obtener totales del día por método de pago"""
        try:
            # Obtener todos los movimientos y filtrar en Python para evitar problemas de compatibilidad
            all_movimientos = list(CajaMovimiento.select())
            
            # Filtrar por fecha y sucursal
            movimientos_filtrados = []
            for cm in all_movimientos:
                if (cm.fecha_hora.date() == fecha and cm.sucursal.id == sucursal_id):
                    movimientos_filtrados.append(cm)
            
            # Agrupar por método de pago
            totales_por_metodo = {}
            total_general = 0
            
            for cm in movimientos_filtrados:
                # Determinar método de pago (nuevo sistema o compatibilidad)
                metodo = "SIN_METODO"
                if cm.metodo_pago_configurable:
                    metodo = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo = cm.payment_method.value
                    else:
                        metodo = str(cm.payment_method)
                
                if metodo not in totales_por_metodo:
                    totales_por_metodo[metodo] = 0
                
                # Sumar ingresos, restar egresos
                if cm.tipo == "INGRESO":
                    totales_por_metodo[metodo] += cm.monto
                    total_general += cm.monto
                elif cm.tipo == "EGRESO":
                    totales_por_metodo[metodo] -= cm.monto
                    total_general -= cm.monto
            
            return {
                "totales_por_metodo": totales_por_metodo,
                "total_general": total_general
            }
            
        except Exception as e:
            print(f"❌ Error al obtener totales diarios: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener totales diarios")
    
    @db_session
    def get_reporte_ingresos(self, fecha_desde: date, fecha_hasta: date, 
                           payment_method: Optional[str] = None, 
                           sucursal_id: Optional[int] = None) -> Dict:
        """Obtener reporte de ingresos por rango de fechas"""
        try:
            # Construir la consulta base
            query = select(
                cm for cm in CajaMovimiento 
                if cm.fecha_hora.date() >= fecha_desde 
                and cm.fecha_hora.date() <= fecha_hasta
                and cm.tipo == "INGRESO"
            )
            
            # Filtrar por sucursal si se especifica
            if sucursal_id:
                query = query.filter(lambda cm: cm.sucursal.id == sucursal_id)
            
            # Filtrar por método de pago si se especifica
            if payment_method:
                query = query.filter(lambda cm: cm.payment_method == payment_method)
            
            # Obtener movimientos
            movimientos = []
            total_general = 0
            resumen_por_metodo = {}
            
            for cm in query:
                # Determinar método de pago a mostrar (nuevo sistema o compatibilidad)
                metodo = "SIN_METODO"
                if cm.metodo_pago_configurable:
                    metodo = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo = cm.payment_method.value
                    else:
                        metodo = str(cm.payment_method)
                
                # Acumular en resumen
                if metodo not in resumen_por_metodo:
                    resumen_por_metodo[metodo] = 0
                resumen_por_metodo[metodo] += cm.monto
                total_general += cm.monto
                
                # Agregar a movimientos
                movimientos.append({
                    "id": cm.id,
                    "fecha_hora": cm.fecha_hora,
                    "tipo": cm.tipo,  # Ya es string
                    "monto": cm.monto,
                    "payment_method": metodo,  # Método formateado
                    "origen": cm.origen,
                    "venta_id": cm.venta.id if cm.venta else None,  # Usar objeto venta
                    "usuario_id": cm.usuario.id,
                    "usuario_nombre": f"{cm.usuario.nombre} {cm.usuario.apellido}",
                    "sucursal_id": cm.sucursal.id,
                    "sucursal_nombre": cm.sucursal.nombre
                })
            
            return {
                "resumen_por_metodo": resumen_por_metodo,
                "total_general": total_general,
                "movimientos": movimientos
            }
            
        except Exception as e:
            print(f"❌ Error al obtener reporte de ingresos: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener reporte de ingresos")
    
    @db_session
    def create_movimiento_venta(self, venta: Venta, usuario_id: int) -> CajaMovimiento:
        """Crear movimiento de caja automáticamente para una venta"""
        try:
            movimiento_data = {
                "tipo": "INGRESO",
                "monto": venta.total,
                "metodo_pago_id": venta.metodo_pago_configurable.id if venta.metodo_pago_configurable else None,
                "submetodo_pago_id": venta.submetodo_pago.id if venta.submetodo_pago else None,
                "payment_method": None,  # Ya no se usa, pero mantenido para compatibilidad
                "origen": f"VENTA:{venta.id}",
                "venta_id": venta.id,
                "sucursal_id": venta.sucursal.id,
                "cuenta_destino_id": venta.cuenta_destino.id if venta.cuenta_destino else None
            }
            
            return self.create_movimiento(movimiento_data, usuario_id)
            
        except Exception as e:
            print(f"❌ Error al crear movimiento de venta: {e}")
            raise HTTPException(status_code=500, detail="Error al crear movimiento de venta")
    
    @db_session
    def revertir_movimiento_venta(self, venta_id: int, usuario_id: int) -> CajaMovimiento:
        """Crear movimiento de ajuste negativo para revertir una venta"""
        try:
            # Buscar el movimiento original de la venta
            movimiento_original = CajaMovimiento.get(
                venta=venta_id,  # Usar objeto venta
                tipo="INGRESO"
            )
            
            if not movimiento_original:
                raise HTTPException(status_code=404, detail="Movimiento de venta no encontrado")
            
            # Crear movimiento de ajuste negativo
            movimiento_data = {
                "tipo": "AJUSTE_NEGATIVO",
                "monto": movimiento_original.monto,
                "metodo_pago_id": movimiento_original.metodo_pago_configurable.id if movimiento_original.metodo_pago_configurable else None,
                "submetodo_pago_id": movimiento_original.submetodo_pago.id if movimiento_original.submetodo_pago else None,
                "payment_method": None,  # Ya no se usa
                "origen": f"REVERSION_VENTA:{venta_id}",
                "venta_id": venta_id,
                "sucursal_id": movimiento_original.sucursal.id
            }
            
            return self.create_movimiento(movimiento_data, usuario_id)
            
        except Exception as e:
            print(f"❌ Error al revertir movimiento de venta: {e}")
            raise HTTPException(status_code=500, detail="Error al revertir movimiento de venta")

    @db_session
    def get_movimientos_presupuestos(self, fecha: date, sucursal_id: int, payment_method: Optional[str] = None) -> List[Dict]:
        """Obtener movimientos de caja relacionados con presupuestos y órdenes de trabajo"""
        try:
            # Construir la consulta base
            query = CajaMovimiento.select(
                lambda cm: (cm.fecha_hora.date() == fecha and 
                           cm.sucursal.id == sucursal_id and
                           (cm.origen.startswith("SEÑA_PRESUPUESTO:") or 
                            cm.origen.startswith("PAGO_ADICIONAL_ORDEN:")))
            )
            
            # Filtrar por método de pago si se especifica
            if payment_method:
                query = query.filter(lambda cm: cm.payment_method == payment_method)
            
            movimientos_presupuestos = list(query.order_by(CajaMovimiento.fecha_hora))
            
            movimientos = []
            for cm in movimientos_presupuestos:
                # Determinar método de pago (nuevo sistema o compatibilidad)
                metodo_pago_display = None
                if cm.metodo_pago_configurable:
                    metodo_pago_display = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo_pago_display = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo_pago_display = cm.payment_method.value
                    else:
                        metodo_pago_display = str(cm.payment_method)
                
                movimientos.append({
                    "id": cm.id,
                    "hora": cm.fecha_hora.strftime("%H:%M"),
                    "origen": cm.origen,
                    "tipo": cm.tipo,
                    "payment_method": metodo_pago_display,
                    "monto": cm.monto,
                    "usuario_nombre": f"{cm.usuario.nombre} {cm.usuario.apellido}",
                    "descripcion": self._get_descripcion_movimiento_presupuesto(cm.origen)
                })
            
            return movimientos
            
        except Exception as e:
            print(f"❌ Error al obtener movimientos de presupuestos: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener movimientos de presupuestos")

    def _get_descripcion_movimiento_presupuesto(self, origen: str) -> str:
        """Obtener descripción legible del movimiento de presupuesto"""
        if origen.startswith("SEÑA_PRESUPUESTO:"):
            numero_presupuesto = origen.replace("SEÑA_PRESUPUESTO:", "")
            return f"Seña inicial - Presupuesto {numero_presupuesto}"
        elif origen.startswith("PAGO_ADICIONAL_ORDEN:"):
            numero_presupuesto = origen.replace("PAGO_ADICIONAL_ORDEN:", "")
            return f"Pago adicional - Presupuesto {numero_presupuesto}"
        else:
            return origen

    @db_session
    def buscar_movimientos_por_texto(self, texto_busqueda: str, sucursal_id: int, 
                                   fecha_desde: Optional[date] = None, 
                                   fecha_hasta: Optional[date] = None) -> List[Dict]:
        """Buscar movimientos por texto en concepto o referencia"""
        try:
            texto_busqueda = texto_busqueda.upper().strip()
            if not texto_busqueda:
                return []
            
            # Obtener todos los movimientos y filtrar en Python
            all_movimientos = list(CajaMovimiento.select())
            
            movimientos_filtrados = []
            for cm in all_movimientos:
                # Verificar que pertenezca a la sucursal
                if cm.sucursal.id != sucursal_id:
                    continue
                
                # Verificar fechas si se especifican
                if fecha_desde and cm.fecha_hora.date() < fecha_desde:
                    continue
                if fecha_hasta and cm.fecha_hora.date() > fecha_hasta:
                    continue
                
                # Buscar en el origen (concepto/referencia)
                if texto_busqueda in cm.origen.upper():
                    movimientos_filtrados.append(cm)
                    continue
                
                # Buscar en la descripción del movimiento si es de presupuesto
                if cm.origen.startswith(("SEÑA_PRESUPUESTO:", "PAGO_ADICIONAL_ORDEN:")):
                    descripcion = self._get_descripcion_movimiento_presupuesto(cm.origen)
                    if texto_busqueda in descripcion.upper():
                        movimientos_filtrados.append(cm)
                        continue
                
                # Buscar en información de venta si existe
                if cm.venta and cm.venta.cliente:
                    nombre_cliente = f"{cm.venta.cliente.nombre} {cm.venta.cliente.apellido}".upper()
                    if texto_busqueda in nombre_cliente:
                        movimientos_filtrados.append(cm)
                        continue
            
            # Ordenar por fecha y hora
            movimientos_filtrados.sort(key=lambda x: x.fecha_hora, reverse=True)
            
            movimientos = []
            for cm in movimientos_filtrados:
                # Obtener nombre de cuenta destino si existe
                cuenta_destino_nombre = None
                if cm.cuenta_destino:
                    cuenta_destino_nombre = cm.cuenta_destino.nombre_titular
                
                # Determinar método de pago a mostrar (nuevo sistema o compatibilidad)
                metodo_pago_display = "SIN_METODO"
                if cm.metodo_pago_configurable:
                    metodo_pago_display = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo_pago_display = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo_pago_display = cm.payment_method.value
                    else:
                        metodo_pago_display = str(cm.payment_method)
                
                movimientos.append({
                    "id": cm.id,
                    "fecha_hora": cm.fecha_hora,
                    "fecha": cm.fecha_hora.strftime("%Y-%m-%d"),
                    "hora": cm.fecha_hora.strftime("%H:%M"),
                    "origen": cm.origen,
                    "tipo": cm.tipo,
                    "payment_method": metodo_pago_display,
                    "monto": cm.monto,
                    "usuario_nombre": f"{cm.usuario.nombre} {cm.usuario.apellido}",
                    "sucursal_nombre": cm.sucursal.nombre,
                    "cuenta_destino_nombre": cuenta_destino_nombre,
                    "descripcion": self._get_descripcion_movimiento_presupuesto(cm.origen) if cm.origen.startswith(("SEÑA_PRESUPUESTO:", "PAGO_ADICIONAL_ORDEN:")) else cm.origen
                })
            
            return movimientos
            
        except Exception as e:
            print(f"❌ Error al buscar movimientos por texto: {e}")
            raise HTTPException(status_code=500, detail="Error al buscar movimientos por texto")

    @db_session
    def get_reporte_egresos(self, fecha_desde: date, fecha_hasta: date, 
                           sucursal_id: Optional[int] = None) -> Dict:
        """Obtener reporte de egresos por rango de fechas"""
        try:
            # Construir la consulta base
            query = select(
                cm for cm in CajaMovimiento 
                if cm.fecha_hora.date() >= fecha_desde 
                and cm.fecha_hora.date() <= fecha_hasta
                and cm.tipo == "EGRESO"
            )
            
            # Filtrar por sucursal si se especifica
            if sucursal_id:
                query = query.filter(lambda cm: cm.sucursal.id == sucursal_id)
            
            # Obtener movimientos
            movimientos = []
            total_general = 0
            resumen_por_categoria = {}
            
            for cm in query:
                # Categorizar egresos por origen
                categoria = self._categorizar_egreso(cm.origen)
                
                # Determinar método de pago a mostrar (nuevo sistema o compatibilidad)
                metodo_pago_display = "SIN_METODO"
                if cm.metodo_pago_configurable:
                    metodo_pago_display = cm.metodo_pago_configurable.nombre
                    if cm.submetodo_pago:
                        metodo_pago_display = f"{cm.metodo_pago_configurable.nombre} - {cm.submetodo_pago.nombre}"
                elif cm.payment_method:
                    if hasattr(cm.payment_method, 'value'):
                        metodo_pago_display = cm.payment_method.value
                    else:
                        metodo_pago_display = str(cm.payment_method)
                
                # Acumular en resumen por categoría
                if categoria not in resumen_por_categoria:
                    resumen_por_categoria[categoria] = 0
                resumen_por_categoria[categoria] += cm.monto
                total_general += cm.monto
                
                # Agregar a movimientos
                movimientos.append({
                    "id": cm.id,
                    "fecha_hora": cm.fecha_hora,
                    "fecha": cm.fecha_hora.strftime("%Y-%m-%d"),
                    "hora": cm.fecha_hora.strftime("%H:%M"),
                    "tipo": cm.tipo,
                    "monto": cm.monto,
                    "payment_method": metodo_pago_display,
                    "origen": cm.origen,
                    "categoria": categoria,
                    "usuario_nombre": f"{cm.usuario.nombre} {cm.usuario.apellido}",
                    "sucursal_nombre": cm.sucursal.nombre
                })
            
            return {
                "resumen_por_categoria": resumen_por_categoria,
                "total_general": total_general,
                "movimientos": movimientos
            }
            
        except Exception as e:
            print(f"❌ Error al obtener reporte de egresos: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener reporte de egresos")

    def _categorizar_egreso(self, origen: str) -> str:
        """Categorizar un egreso basado en su origen"""
        origen_upper = origen.upper()
        
        # Categorías principales
        if any(palabra in origen_upper for palabra in ["ADMINISTRATIVO", "ADMINISTRACION", "OFICINA", "ADMIN", "CONTABILIDAD", "RECURSOS_HUMANOS"]):
            return "ADMINISTRATIVOS"
        elif any(palabra in origen_upper for palabra in ["OPERATIVO", "OPERACION", "PRODUCCION", "FABRICA", "TALLER", "MAQUINARIA"]):
            return "OPERATIVOS"
        elif any(palabra in origen_upper for palabra in ["COMERCIAL", "VENTA", "MARKETING", "PUBLICIDAD", "PROMOCION", "CLIENTES"]):
            return "COMERCIALES"
        # Categorías secundarias
        elif any(palabra in origen_upper for palabra in ["SERVICIOS", "SERVICIO", "MANTENIMIENTO"]):
            return "OPERATIVOS"
        elif any(palabra in origen_upper for palabra in ["SUMINISTROS", "MATERIALES", "PRODUCTOS"]):
            return "OPERATIVOS"
        elif any(palabra in origen_upper for palabra in ["ALQUILER", "RENTA", "LOCAL"]):
            return "ADMINISTRATIVOS"
        elif any(palabra in origen_upper for palabra in ["SALARIOS", "SUELDOS", "PAGOS"]):
            return "ADMINISTRATIVOS"
        elif any(palabra in origen_upper for palabra in ["UTILIDADES", "LUZ", "AGUA", "GAS", "INTERNET"]):
            return "ADMINISTRATIVOS"
        elif any(palabra in origen_upper for palabra in ["TRANSPORTE", "COMBUSTIBLE", "VIATICOS"]):
            return "OPERATIVOS"
        elif any(palabra in origen_upper for palabra in ["IMPUESTOS", "TRIBUTOS", "CONTRIBUCIONES"]):
            return "ADMINISTRATIVOS"
        else:
            return "OTROS_EGRESOS"

    @db_session
    def get_balance_financiero(self, fecha_desde: date, fecha_hasta: date, 
                              sucursal_id: Optional[int] = None) -> Dict:
        """Obtener balance financiero (ingresos - egresos) entre fechas"""
        try:
            # Obtener ingresos
            ingresos_data = self.get_reporte_ingresos(fecha_desde, fecha_hasta, None, sucursal_id)
            total_ingresos = ingresos_data["total_general"]
            
            # Obtener egresos
            egresos_data = self.get_reporte_egresos(fecha_desde, fecha_hasta, sucursal_id)
            total_egresos = egresos_data["total_general"]
            
            # Calcular balance
            balance = total_ingresos - total_egresos
            
            return {
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "total_ingresos": total_ingresos,
                "total_egresos": total_egresos,
                "balance": balance,
                "balance_porcentual": (balance / total_ingresos * 100) if total_ingresos > 0 else 0,
                "resumen_ingresos": ingresos_data["resumen_por_metodo"],
                "resumen_egresos": egresos_data["resumen_por_categoria"]
            }
            
        except Exception as e:
            print(f"❌ Error al obtener balance financiero: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener balance financiero")

    @db_session
    def get_saldos_pendientes_clientes(self, fecha_desde: date, fecha_hasta: date, 
                                     sucursal_id: Optional[int] = None) -> List[Dict]:
        """Obtener saldos pendientes de clientes entre fechas"""
        try:
            from src.models import Presupuesto, Cliente
            
            # Obtener presupuestos con saldos pendientes en el rango de fechas
            query = select(
                p for p in Presupuesto 
                if p.fecha_creacion.date() >= fecha_desde 
                and p.fecha_creacion.date() <= fecha_hasta
                and p.saldo_pendiente > 0
            )
            
            # Filtrar por sucursal si se especifica
            if sucursal_id:
                query = query.filter(lambda p: p.sucursal.id == sucursal_id)
            
            saldos_pendientes = []
            for presupuesto in query:
                # Obtener pagos realizados buscando en movimientos de caja por origen
                pagos_realizados = sum(
                    cm.monto for cm in CajaMovimiento.select(
                        lambda cm: (cm.origen.startswith(f"SEÑA_PRESUPUESTO:{presupuesto.id}") or 
                                  cm.origen.startswith(f"PAGO_ADICIONAL_ORDEN:{presupuesto.id}")) and
                                  cm.tipo == "INGRESO"
                    )
                )
                
                cliente_id = presupuesto.cliente.id if presupuesto.cliente else None
                cliente_nombre = (
                    f"{presupuesto.precliente.apellido} {presupuesto.precliente.nombre}".strip()
                    if presupuesto.precliente
                    else (f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}" if presupuesto.cliente else "N/A")
                )
                cliente_dni = presupuesto.cliente.dni if presupuesto.cliente else None
                saldos_pendientes.append({
                    "presupuesto_id": presupuesto.id,
                    "cliente_id": cliente_id,
                    "cliente_nombre": cliente_nombre,
                    "cliente_dni": cliente_dni,
                    "fecha_creacion": presupuesto.fecha_creacion,
                    "total_presupuesto": presupuesto.total,
                    "pagos_realizados": pagos_realizados,
                    "saldo_pendiente": presupuesto.saldo_pendiente,
                    "sucursal_nombre": presupuesto.sucursal.nombre,
                    "estado": presupuesto.estado
                })
            
            # Ordenar por saldo pendiente descendente
            saldos_pendientes.sort(key=lambda x: x["saldo_pendiente"], reverse=True)
            
            return saldos_pendientes
            
        except Exception as e:
            print(f"❌ Error al obtener saldos pendientes: {e}")
            raise HTTPException(status_code=500, detail="Error al obtener saldos pendientes")
