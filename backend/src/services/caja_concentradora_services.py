from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from pony.orm import db_session, flush, select

from src.models import (
    CajaConcentradora,
    CajaMovimiento,
    CajaChica,
    Roles,
    Sucursal,
    Usuario,
    TipoMovimientoConcentradora,
    OrigenConcentradora,
    DestinoConcentradora,
    EstadoConcentradora,
    TipoMovimientoCajaChica,
    MetodoPagoCajaChica,
    EstadoMovimientoCajaChica,
)


class CajaConcentradoraServices:
    """Servicios para la gestión de Caja Concentradora."""

    @staticmethod
    def _obtener_usuario(current_user) -> Usuario:
        usuario = Usuario.get(id=current_user.id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return usuario

    @staticmethod
    def _obtener_sucursal(sucursal_id: int) -> Sucursal:
        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        return sucursal

    def _validar_permisos(self, usuario: Usuario, sucursal: Sucursal) -> None:
        if usuario.rol == Roles.EMPLEADO and usuario.sucursal.id != sucursal.id:
            raise HTTPException(
                status_code=403,
                detail="No tenés permisos para operar en otra sucursal",
            )

    @staticmethod
    def _registrar_movimiento_diario(
        usuario: Usuario,
        sucursal: Sucursal,
        monto: Decimal,
        tipo: str,
        descripcion: str,
        etiqueta: str,
    ) -> None:
        texto = etiqueta
        if descripcion:
            texto = f"{etiqueta} {descripcion}"

        CajaMovimiento(
            fecha_hora=datetime.now(),
            tipo=tipo,
            monto=float(monto),
            payment_method="EFECTIVO",
            origen=texto,
            categoria="INTERNA",
            usuario=usuario,
            sucursal=sucursal,
        )

    def _parse_decimal(self, value: Any, field: str) -> Decimal:
        if value in (None, ""):
            raise HTTPException(status_code=400, detail=f"El campo '{field}' es requerido")
        try:
            monto = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise HTTPException(status_code=400, detail=f"El campo '{field}' debe ser numérico")
        if monto <= 0:
            raise HTTPException(status_code=400, detail=f"El campo '{field}' debe ser mayor a cero")
        return monto

    def _mapear_movimiento(self, movimiento: CajaConcentradora) -> Dict[str, Any]:
        # Manejar tipo_movimiento (por defecto INGRESO)
        try:
            if movimiento.tipo_movimiento:
                if hasattr(movimiento.tipo_movimiento, "value"):
                    tipo_val = movimiento.tipo_movimiento.value
                else:
                    tipo_val = str(movimiento.tipo_movimiento)
            else:
                tipo_val = "INGRESO"
        except:
            tipo_val = "INGRESO"

        # Manejar origen (por defecto "Caja Diaria")
        try:
            if movimiento.origen:
                if hasattr(movimiento.origen, "value"):
                    origen_val = movimiento.origen.value
                else:
                    origen_val = str(movimiento.origen)
            else:
                origen_val = "Caja Diaria"
        except:
            origen_val = "Caja Diaria"

        # Manejar destino (puede ser None)
        try:
            if movimiento.destino:
                if hasattr(movimiento.destino, "value"):
                    destino_val = movimiento.destino.value
                else:
                    destino_val = str(movimiento.destino)
            else:
                destino_val = None
        except:
            destino_val = None

        # Manejar estado (por defecto "Confirmado")
        try:
            if movimiento.estado:
                if hasattr(movimiento.estado, "value"):
                    estado_val = movimiento.estado.value
                else:
                    estado_val = str(movimiento.estado)
            else:
                estado_val = "Confirmado"
        except:
            estado_val = "Confirmado"

        # Obtener usuario (intentar usuario primero, luego usuario_envio)
        usuario_obj = None
        try:
            usuario_obj = movimiento.usuario
        except:
            pass
        
        if not usuario_obj:
            try:
                usuario_obj = movimiento.usuario_envio
            except:
                pass

        usuario_nombre = (
            f"{usuario_obj.nombre} {usuario_obj.apellido}" if usuario_obj else None
        )

        # Obtener fecha (intentar fecha primero, luego fecha_envio para compatibilidad)
        fecha_obj = None
        try:
            fecha_obj = movimiento.fecha
        except:
            pass
        
        if not fecha_obj:
            try:
                fecha_obj = getattr(movimiento, 'fecha_envio', None)
            except:
                pass

        fecha_str = fecha_obj.isoformat() if fecha_obj else None

        return {
            "id": movimiento.id,
            "sucursal_id": movimiento.sucursal.id,
            "usuario_id": usuario_obj.id if usuario_obj else None,
            "usuario_nombre": usuario_nombre,
            "fecha": fecha_str,
            "tipo_movimiento": tipo_val,
            "origen": origen_val,
            "destino": destino_val,
            "monto": float(movimiento.monto),
            "descripcion": movimiento.descripcion,
            "estado": estado_val,
            "caja_movimiento_id": movimiento.caja_movimiento_id,
        }

    @db_session
    def listar_movimientos(
        self,
        sucursal_id: int,
        current_user,
        tipo: Optional[str] = None,
        estado: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Listar todos los movimientos de caja concentradora."""
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)

        if usuario.rol == Roles.EMPLEADO and usuario.sucursal.id != sucursal.id:
            raise HTTPException(
                status_code=403, detail="No tienes permiso para ver otra sucursal"
            )

        # Obtener todos los movimientos y filtrar en Python (más confiable que la consulta de Pony)
        todos_los_movimientos = list(CajaConcentradora.select())
        
        # Filtrar por sucursal en Python (más confiable)
        movimientos = [
            mov for mov in todos_los_movimientos
            if mov.sucursal and mov.sucursal.id == sucursal.id
        ]

        # Filtrar por tipo si se especifica
        if tipo:
            try:
                tipo_enum = TipoMovimientoConcentradora(tipo.upper())
                movimientos = [m for m in movimientos if m.tipo_movimiento == tipo_enum]
            except (ValueError, AttributeError):
                # Si hay movimientos sin tipo_movimiento, filtrar por string
                movimientos = [
                    m for m in movimientos
                    if (m.tipo_movimiento and str(m.tipo_movimiento).upper() == tipo.upper()) or
                       (not m.tipo_movimiento and tipo.upper() == "INGRESO")
                ]

        # Filtrar por estado si se especifica
        if estado:
            try:
                estado_enum = EstadoConcentradora(estado)
                movimientos = [m for m in movimientos if m.estado == estado_enum]
            except (ValueError, AttributeError):
                # Si hay movimientos sin estado, filtrar por string
                movimientos = [
                    m for m in movimientos
                    if (m.estado and str(m.estado) == estado) or
                       (not m.estado and estado == "Confirmado")
                ]

        # Ordenar por fecha (usar fecha_envio si fecha no está disponible)
        def get_fecha(mov):
            if mov.fecha:
                return mov.fecha
            # Intentar acceder a fecha_envio si existe (para compatibilidad)
            try:
                return getattr(mov, 'fecha_envio', mov.fecha) if hasattr(mov, 'fecha_envio') else mov.fecha
            except:
                from datetime import datetime
                return datetime.now()

        movimientos.sort(key=get_fecha, reverse=True)

        total = Decimal("0")
        for mov in movimientos:
            # Determinar tipo de movimiento (por defecto INGRESO si no está definido)
            tipo_mov = mov.tipo_movimiento
            if not tipo_mov:
                tipo_mov = TipoMovimientoConcentradora.INGRESO
            
            # Determinar estado (por defecto CONFIRMADO si no está definido)
            estado_mov = mov.estado
            if not estado_mov:
                estado_mov = EstadoConcentradora.CONFIRMADO

            if tipo_mov == TipoMovimientoConcentradora.INGRESO:
                if estado_mov != EstadoConcentradora.RECHAZADO:
                    total += mov.monto
            elif tipo_mov == TipoMovimientoConcentradora.EGRESO:
                if estado_mov != EstadoConcentradora.RECHAZADO:
                    total -= mov.monto

        movimientos_mapeados = [self._mapear_movimiento(mov) for mov in movimientos]

        return {
            "message": "Movimientos obtenidos correctamente",
            "success": True,
            "data": {
                "movimientos": movimientos_mapeados,
                "total": float(total),
            },
        }

    @db_session
    def listar_envios(self, sucursal_id: int, current_user) -> Dict[str, Any]:
        """Método legacy - mantener compatibilidad."""
        return self.listar_movimientos(sucursal_id, current_user)

    @db_session
    def get_total_por_sucursal(self, sucursal_id: int) -> Decimal:
        """Obtener el total disponible en caja concentradora para una sucursal."""
        sucursal = self._obtener_sucursal(sucursal_id)
        total = Decimal("0")
        
        # Obtener todos y filtrar en Python (más confiable)
        todos = list(CajaConcentradora.select())
        movimientos = [
            mov for mov in todos
            if mov.sucursal and mov.sucursal.id == sucursal.id
        ]
        
        for mov in movimientos:
            if mov.tipo_movimiento == TipoMovimientoConcentradora.INGRESO:
                if mov.estado != EstadoConcentradora.RECHAZADO:
                    total += mov.monto
            elif mov.tipo_movimiento == TipoMovimientoConcentradora.EGRESO:
                if mov.estado != EstadoConcentradora.RECHAZADO:
                    total -= mov.monto
        
        return total

    @db_session
    def obtener_saldo(self, sucursal_id: int, current_user) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)

        if usuario.rol == Roles.EMPLEADO and usuario.sucursal.id != sucursal.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver otra sucursal")

        total = self.get_total_por_sucursal(sucursal_id)

        return {
            "message": "Saldo obtenido correctamente",
            "success": True,
            "data": {"sucursal_id": sucursal.id, "saldo": float(total)},
        }

    @db_session
    def vaciar_caja(self, sucursal_id: int, current_user) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)

        if usuario.rol != Roles.ADMIN:
            raise HTTPException(status_code=403, detail="Solo un administrador puede vaciar la caja concentradora")

        # Obtener todos y filtrar en Python (más confiable)
        todos = list(CajaConcentradora.select())
        envios_activos = [
            mov for mov in todos
            if mov.sucursal and mov.sucursal.id == sucursal.id and mov.activo
        ]

        if not envios_activos:
            raise HTTPException(status_code=400, detail="No hay fondos activos en la concentradora")

        total_vaciado = sum((envio.monto for envio in envios_activos), Decimal("0"))

        for envio in envios_activos:
            envio.activo = False
            envio.fecha_vaciado = datetime.now()
            envio.vaciado_por = usuario

        flush()

        descripcion = f"Vaciado concentradora sucursal {sucursal.nombre}"
        self._registrar_movimiento_diario(
            usuario=usuario,
            sucursal=sucursal,
            monto=total_vaciado,
            tipo="EGRESO",
            descripcion=descripcion,
            etiqueta="[CAJA_CONCENTRADORA_VACIADO]",
        )

        return {
            "message": "Caja concentradora vaciada correctamente",
            "success": True,
            "data": {
                "sucursal_id": sucursal.id,
                "monto_vaciado": float(total_vaciado),
                "fecha_vaciado": datetime.now(),
                "cantidad_movimientos": len(envios_activos),
            },
        }

    @db_session
    def registrar_ingreso_desde_caja_diaria(
        self,
        sucursal_id: int,
        usuario_id: int,
        monto: Decimal,
        descripcion: Optional[str],
        caja_movimiento_id: Optional[int],
    ) -> CajaConcentradora:
        """Registrar un ingreso automático desde Caja Diaria."""
        sucursal = self._obtener_sucursal(sucursal_id)
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        movimiento = CajaConcentradora(
            sucursal=sucursal,
            usuario=usuario,
            usuario_envio=usuario,
            fecha=datetime.now(),
            tipo_movimiento=TipoMovimientoConcentradora.INGRESO,
            origen=OrigenConcentradora.CAJA_DIARIA,
            destino=None,
            monto=Decimal(monto),
            descripcion=descripcion or "Transferencia desde Caja Diaria",
            estado=EstadoConcentradora.CONFIRMADO,
            activo=True,
            caja_movimiento_id=caja_movimiento_id,
        )
        flush()
        return movimiento

    @db_session
    def registrar_egreso(self, data: Dict[str, Any], current_user) -> Dict[str, Any]:
        """Registrar un egreso manual (solo administradores)."""
        usuario = self._obtener_usuario(current_user)
        
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(
                status_code=403, detail="Solo los administradores pueden registrar egresos"
            )

        sucursal_id = data.get("sucursal_id") or (usuario.sucursal.id if usuario.sucursal else None)
        sucursal = self._obtener_sucursal(sucursal_id)

        monto = self._parse_decimal(data.get("monto"), "monto")
        descripcion = data.get("descripcion") or "Egreso manual"

        # Verificar que haya suficiente saldo
        saldo_actual = self.get_total_por_sucursal(sucursal_id)
        if saldo_actual < monto:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Saldo disponible: ${float(saldo_actual):.2f}",
            )

        movimiento = CajaConcentradora(
            sucursal=sucursal,
            usuario=usuario,
            usuario_envio=None,
            fecha=datetime.now(),
            tipo_movimiento=TipoMovimientoConcentradora.EGRESO,
            origen=OrigenConcentradora.MANUAL,
            destino=DestinoConcentradora.OTRO,
            monto=monto,
            descripcion=descripcion,
            estado=EstadoConcentradora.CONFIRMADO,
            activo=True,
        )
        flush()

        return {
            "message": "Egreso registrado correctamente",
            "success": True,
            "data": self._mapear_movimiento(movimiento),
        }

    @db_session
    def enviar_a_caja_chica(
        self, data: Dict[str, Any], current_user
    ) -> Dict[str, Any]:
        """Enviar dinero desde Caja Concentradora a Caja Chica (solo administradores)."""
        from src.services.caja_chica_services import CajaChicaService

        usuario = self._obtener_usuario(current_user)

        if usuario.rol != Roles.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Solo los administradores pueden enviar dinero a Caja Chica",
            )

        sucursal_id = data.get("sucursal_id") or (usuario.sucursal.id if usuario.sucursal else None)
        sucursal = self._obtener_sucursal(sucursal_id)

        monto = self._parse_decimal(data.get("monto"), "monto")
        descripcion = data.get("descripcion") or "Transferencia desde Caja Concentradora"

        # Verificar que haya suficiente saldo
        saldo_actual = self.get_total_por_sucursal(sucursal_id)
        if saldo_actual < monto:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Saldo disponible: ${float(saldo_actual):.2f}",
            )

        # Registrar egreso en concentradora
        egreso_concentradora = CajaConcentradora(
            sucursal=sucursal,
            usuario=usuario,
            usuario_envio=None,
            fecha=datetime.now(),
            tipo_movimiento=TipoMovimientoConcentradora.EGRESO,
            origen=OrigenConcentradora.MANUAL,
            destino=DestinoConcentradora.CAJA_CHICA,
            monto=monto,
            descripcion=descripcion,
            estado=EstadoConcentradora.CONFIRMADO,
            activo=True,
        )
        flush()

        # Registrar ingreso en caja chica
        caja_chica_service = CajaChicaService()
        ingreso_caja_chica = caja_chica_service.registrar_ingreso_desde_caja_diaria(
            sucursal_id=sucursal.id,
            usuario_id=usuario.id,
            monto=monto,
            descripcion=descripcion,
            caja_movimiento_id=None,
        )

        return {
            "message": "Dinero enviado a Caja Chica correctamente",
            "success": True,
            "data": {
                "concentradora": self._mapear_movimiento(egreso_concentradora),
                "caja_chica": {
                    "movimiento_id": ingreso_caja_chica.id,
                    "fecha": ingreso_caja_chica.fecha.isoformat(),
                    "monto": float(ingreso_caja_chica.monto),
                    "descripcion": ingreso_caja_chica.descripcion,
                    "estado": ingreso_caja_chica.estado.value if hasattr(ingreso_caja_chica.estado, "value") else str(ingreso_caja_chica.estado),
                },
            },
        }

    @db_session
    def actualizar_movimiento(
        self,
        movimiento_id: int,
        data: Dict[str, Any],
        current_user,
    ) -> Dict[str, Any]:
        """Actualizar un movimiento de caja concentradora (solo administradores)."""
        usuario = self._obtener_usuario(current_user)
        
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Solo los administradores pueden editar movimientos",
            )

        movimiento = CajaConcentradora.get(id=movimiento_id)
        if not movimiento:
            raise HTTPException(status_code=404, detail="Movimiento no encontrado")

        self._validar_permisos(usuario, movimiento.sucursal)

        # Si es un ingreso automático desde Caja Diaria, solo se puede editar descripción y estado
        if movimiento.tipo_movimiento == TipoMovimientoConcentradora.INGRESO and movimiento.origen == OrigenConcentradora.CAJA_DIARIA:
            if "monto" in data:
                raise HTTPException(
                    status_code=400,
                    detail="El monto de un ingreso automático desde Caja Diaria no puede modificarse",
                )
            if "origen" in data or "destino" in data or "tipo_movimiento" in data:
                raise HTTPException(
                    status_code=400,
                    detail="Los campos origen, destino y tipo_movimiento de ingresos automáticos no pueden modificarse",
                )

        # Actualizar campos permitidos
        if "monto" in data:
            # Verificar saldo si es un egreso
            if movimiento.tipo_movimiento == TipoMovimientoConcentradora.EGRESO:
                nuevo_monto = self._parse_decimal(data["monto"], "monto")
                saldo_actual = self.get_total_por_sucursal(movimiento.sucursal.id)
                # Calcular el saldo sin este movimiento
                saldo_sin_este = saldo_actual
                if movimiento.estado != EstadoConcentradora.RECHAZADO:
                    if movimiento.tipo_movimiento == TipoMovimientoConcentradora.INGRESO:
                        saldo_sin_este -= movimiento.monto
                    else:
                        saldo_sin_este += movimiento.monto
                
                # Verificar que el nuevo monto no exceda el saldo disponible
                if nuevo_monto > saldo_sin_este:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente. Saldo disponible: ${float(saldo_sin_este):.2f}",
                    )
                movimiento.monto = nuevo_monto

        if "descripcion" in data:
            movimiento.descripcion = data.get("descripcion")

        if "estado" in data:
            try:
                estado_enum = EstadoConcentradora(data["estado"])
                movimiento.estado = estado_enum
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Estado inválido. Opciones válidas: {', '.join([e.value for e in EstadoConcentradora])}",
                )

        if "destino" in data and movimiento.tipo_movimiento == TipoMovimientoConcentradora.EGRESO:
            try:
                destino_enum = DestinoConcentradora(data["destino"])
                movimiento.destino = destino_enum
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Destino inválido. Opciones válidas: {', '.join([e.value for e in DestinoConcentradora])}",
                )

        flush()

        return {
            "message": "Movimiento actualizado correctamente",
            "success": True,
            "data": self._mapear_movimiento(movimiento),
        }

    @db_session
    def eliminar_movimiento(self, movimiento_id: int, current_user) -> Dict[str, Any]:
        """Eliminar un movimiento de caja concentradora (solo administradores)."""
        usuario = self._obtener_usuario(current_user)
        
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Solo los administradores pueden eliminar movimientos",
            )

        movimiento = CajaConcentradora.get(id=movimiento_id)
        if not movimiento:
            raise HTTPException(status_code=404, detail="Movimiento no encontrado")

        self._validar_permisos(usuario, movimiento.sucursal)

        # Si es un ingreso desde Caja Diaria, también eliminar el movimiento correspondiente en Caja Diaria
        movimiento_caja_diaria_id = None
        if movimiento.tipo_movimiento == TipoMovimientoConcentradora.INGRESO and movimiento.origen == OrigenConcentradora.CAJA_DIARIA:
            if movimiento.caja_movimiento_id:
                from src.models import CajaMovimiento
                movimiento_caja_diaria = CajaMovimiento.get(id=movimiento.caja_movimiento_id)
                if movimiento_caja_diaria:
                    # Verificar que sea un egreso de transferencia a Caja Concentradora
                    if movimiento_caja_diaria.destino == "CAJA_CONCENTRADORA" or movimiento_caja_diaria.origen == "TRANSFERENCIA_CAJA_CONCENTRADORA":
                        movimiento_caja_diaria_id = movimiento_caja_diaria.id
                        movimiento_caja_diaria.delete()

        # Eliminar el movimiento de Caja Concentradora
        movimiento.delete()

        mensaje = "Movimiento eliminado correctamente"
        if movimiento_caja_diaria_id:
            mensaje += f". También se eliminó el egreso correspondiente en Caja Diaria (ID: {movimiento_caja_diaria_id})"

        return {
            "message": mensaje,
            "success": True,
            "data": {
                "movimiento_concentradora_eliminado": movimiento_id,
                "movimiento_caja_diaria_eliminado": movimiento_caja_diaria_id,
            },
        }

