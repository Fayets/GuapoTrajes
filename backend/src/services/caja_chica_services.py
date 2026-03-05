from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from pony.orm import db_session, flush, select, desc

from src.models import (
    CajaChica,
    CajaConcentradora,
    EstadoMovimientoCajaChica,
    MetodoPagoCajaChica,
    Roles,
    Sucursal,
    TipoEgresoCajaChica,
    TipoMovimientoCajaChica,
    Usuario,
)


class CajaChicaService:
    """Gestión centralizada de movimientos de caja chica."""

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

    def _parse_enum(
        self,
        value: Optional[str],
        enum_cls,
        field: str,
        allow_none: bool = False,
    ):
        if value is None:
            if allow_none:
                return None
            raise HTTPException(status_code=400, detail=f"El campo '{field}' es requerido")
        value_clean = str(value).strip().upper()
        try:
            return enum_cls(value_clean)
        except ValueError:
            opciones = ", ".join([item.value for item in enum_cls])
            raise HTTPException(
                status_code=400,
                detail=f"Valor inválido para '{field}'. Opciones válidas: {opciones}",
            )

    @staticmethod
    def _obtener_usuario(current_user) -> Usuario:
        usuario = Usuario.get(id=current_user.id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return usuario

    @staticmethod
    def _obtener_sucursal(sucursal_id: Optional[int]) -> Sucursal:
        if not sucursal_id:
            raise HTTPException(status_code=400, detail="La sucursal es requerida")
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

    def _mapear_movimiento(self, movimiento: CajaChica) -> Dict[str, Any]:
        etiqueta_transferencia = None
        tipo_val = movimiento.tipo.value if hasattr(movimiento.tipo, "value") else str(movimiento.tipo)
        if (
            tipo_val == TipoMovimientoCajaChica.INGRESO.value
            and movimiento.referencia == "CAJA_DIARIA"
        ):
            etiqueta_transferencia = "Ingreso desde Caja Diaria"

        metodo_pago_val = (
            movimiento.metodo_pago.value
            if movimiento.metodo_pago and hasattr(movimiento.metodo_pago, "value")
            else str(movimiento.metodo_pago) if movimiento.metodo_pago else "EFECTIVO"
        )

        tipo_egreso_val = (
            movimiento.tipo_egreso.value
            if movimiento.tipo_egreso and hasattr(movimiento.tipo_egreso, "value")
            else str(movimiento.tipo_egreso) if movimiento.tipo_egreso else None
        )

        estado_val = (
            movimiento.estado.value
            if movimiento.estado and hasattr(movimiento.estado, "value")
            else str(movimiento.estado)
        )

        return {
            "id": movimiento.id,
            "sucursal_id": movimiento.sucursal.id,
            "usuario_id": movimiento.usuario.id,
            "usuario_nombre": f"{movimiento.usuario.nombre} {movimiento.usuario.apellido}",
            "fecha": movimiento.fecha.isoformat(),
            "tipo_movimiento": tipo_val,
            "metodo_pago": metodo_pago_val,
            "tipo_egreso": tipo_egreso_val,
            "monto": float(movimiento.monto),
            "descripcion": movimiento.descripcion,
            "estado": estado_val,
            "referencia": movimiento.referencia,
            "caja_movimiento_id": movimiento.caja_movimiento_id,
            "caja_diaria_id": movimiento.caja_diaria_id,
            "etiqueta": etiqueta_transferencia,
        }

    @db_session
    def listar_movimientos(
        self,
        sucursal_id: int,
        current_user,
        tipo: Optional[str] = None,
        estado: Optional[str] = None,
    ) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)
        self._validar_permisos(usuario, sucursal)

        sucursal_id_val = sucursal.id
        movimientos = list(CajaChica.select())
        movimientos = [cc for cc in movimientos if cc.sucursal.id == sucursal_id_val]

        if tipo:
            tipo_enum = self._parse_enum(tipo, TipoMovimientoCajaChica, "tipo")
            movimientos = [cc for cc in movimientos if cc.tipo == tipo_enum]

        if estado:
            estado_enum = self._parse_enum(estado, EstadoMovimientoCajaChica, "estado")
            movimientos = [cc for cc in movimientos if cc.estado == estado_enum]

        movimientos.sort(key=lambda cc: cc.fecha, reverse=True)

        total = Decimal("0")
        for mov in movimientos:
            if mov.tipo == TipoMovimientoCajaChica.INGRESO:
                if mov.estado != EstadoMovimientoCajaChica.RECHAZADO:
                    total += mov.monto
            elif mov.tipo == TipoMovimientoCajaChica.EGRESO:
                if mov.estado != EstadoMovimientoCajaChica.RECHAZADO:
                    total -= mov.monto

        return {
            "message": "Movimientos obtenidos correctamente",
            "success": True,
            "data": {
                "movimientos": [self._mapear_movimiento(mov) for mov in movimientos],
                "total": float(total),
            },
        }

    @db_session
    def obtener_ingresos(
        self,
        sucursal_id: int,
        current_user,
    ) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)
        self._validar_permisos(usuario, sucursal)

        ingresos = select(
            cc
            for cc in CajaChica
            if cc.sucursal.id == sucursal.id and cc.tipo == TipoMovimientoCajaChica.INGRESO
        ).order_by(lambda cc: desc(cc.fecha))

        return {
            "message": "Ingresos obtenidos correctamente",
            "success": True,
            "data": [self._mapear_movimiento(mov) for mov in ingresos],
        }

    @db_session
    def obtener_egresos(
        self,
        sucursal_id: int,
        current_user,
    ) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal = self._obtener_sucursal(sucursal_id)
        self._validar_permisos(usuario, sucursal)

        egresos = select(
            cc
            for cc in CajaChica
            if cc.sucursal.id == sucursal.id and cc.tipo == TipoMovimientoCajaChica.EGRESO
        ).order_by(lambda cc: desc(cc.fecha))

        return {
            "message": "Egresos obtenidos correctamente",
            "success": True,
            "data": [self._mapear_movimiento(mov) for mov in egresos],
        }

    @db_session
    def registrar_egreso(self, data: Dict[str, Any], current_user) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        sucursal_id = data.get("sucursal_id") or (usuario.sucursal.id if usuario.sucursal else None)
        sucursal = self._obtener_sucursal(sucursal_id)
        self._validar_permisos(usuario, sucursal)

        tipo_movimiento = data.get("tipo_movimiento") or data.get("tipo")
        tipo = self._parse_enum(
            tipo_movimiento or "EGRESO",
            TipoMovimientoCajaChica,
            "tipo_movimiento",
        )
        if tipo != TipoMovimientoCajaChica.EGRESO:
            raise HTTPException(
                status_code=400,
                detail="Los ingresos solo pueden generarse automáticamente desde Caja Diaria",
            )

        metodo_pago = self._parse_enum(
            data.get("metodo_pago") or data.get("metodoPago") or "EFECTIVO",
            MetodoPagoCajaChica,
            "metodo_pago",
        )
        tipo_egreso = self._parse_enum(
            data.get("tipo_egreso") or data.get("tipoEgreso") or TipoEgresoCajaChica.OTROS.value,
            TipoEgresoCajaChica,
            "tipo_egreso",
        )
        monto = self._parse_decimal(data.get("monto"), "monto")
        descripcion = data.get("descripcion")
        estado = self._parse_enum(
            data.get("estado") or EstadoMovimientoCajaChica.PENDIENTE.value,
            EstadoMovimientoCajaChica,
            "estado",
        )

        movimiento = CajaChica(
            sucursal=sucursal,
            usuario=usuario,
            fecha=datetime.now(),
            tipo=tipo,
            metodo_pago=metodo_pago,
            tipo_egreso=tipo_egreso,
            monto=monto,
            descripcion=descripcion,
            estado=estado,
            referencia="EGRESO_MANUAL",
            enviado_concentradora=False,
        )
        flush()

        return {
            "message": "Egreso registrado correctamente",
            "success": True,
            "data": self._mapear_movimiento(movimiento),
        }

    @db_session
    def actualizar_movimiento(
        self,
        movimiento_id: int,
        data: Dict[str, Any],
        current_user,
    ) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        movimiento = CajaChica.get(id=movimiento_id)
        if not movimiento:
            raise HTTPException(status_code=404, detail="Movimiento no encontrado")

        self._validar_permisos(usuario, movimiento.sucursal)

        if movimiento.tipo == TipoMovimientoCajaChica.INGRESO:
            if usuario.rol != Roles.ADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="Solo un administrador puede editar ingresos automáticos",
                )

            if "monto" in data:
                raise HTTPException(
                    status_code=400,
                    detail="El monto de un ingreso automático no puede modificarse",
                )

            if "descripcion" in data:
                movimiento.descripcion = data.get("descripcion")
            if "estado" in data:
                movimiento.estado = self._parse_enum(
                    data["estado"],
                    EstadoMovimientoCajaChica,
                    "estado",
                )

            flush()
            return {
                "message": "Movimiento actualizado correctamente",
                "success": True,
                "data": self._mapear_movimiento(movimiento),
            }

        if "monto" in data:
            movimiento.monto = self._parse_decimal(data["monto"], "monto")
        if "descripcion" in data:
            movimiento.descripcion = data.get("descripcion")
        if "metodo_pago" in data or "metodoPago" in data:
            movimiento.metodo_pago = self._parse_enum(
                data.get("metodo_pago") or data.get("metodoPago"),
                MetodoPagoCajaChica,
                "metodo_pago",
            )
        if "tipo_egreso" in data or "tipoEgreso" in data:
            movimiento.tipo_egreso = self._parse_enum(
                data.get("tipo_egreso") or data.get("tipoEgreso"),
                TipoEgresoCajaChica,
                "tipo_egreso",
            )
        if "estado" in data:
            movimiento.estado = self._parse_enum(
                data["estado"],
                EstadoMovimientoCajaChica,
                "estado",
            )

        flush()
        return {
            "message": "Movimiento actualizado correctamente",
            "success": True,
            "data": self._mapear_movimiento(movimiento),
        }

    @db_session
    def eliminar_movimiento(self, movimiento_id: int, current_user) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)
        movimiento = CajaChica.get(id=movimiento_id)
        if not movimiento:
            raise HTTPException(status_code=404, detail="Movimiento no encontrado")

        self._validar_permisos(usuario, movimiento.sucursal)

        if movimiento.tipo == TipoMovimientoCajaChica.INGRESO:
            raise HTTPException(
                status_code=400,
                detail="Los ingresos provenientes de Caja Diaria no pueden eliminarse manualmente",
            )

        movimiento.delete()
        return {
            "message": "Movimiento eliminado correctamente",
            "success": True,
        }

    @db_session
    def registrar_ingreso_desde_caja_diaria(
        self,
        sucursal_id: int,
        usuario_id: int,
        monto: Decimal,
        descripcion: Optional[str],
        caja_movimiento_id: Optional[int],
    ) -> CajaChica:
        sucursal = self._obtener_sucursal(sucursal_id)
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        movimiento = CajaChica(
            sucursal=sucursal,
            usuario=usuario,
            fecha=datetime.now(),
            tipo=TipoMovimientoCajaChica.INGRESO,
            metodo_pago=MetodoPagoCajaChica.EFECTIVO,
            tipo_egreso=None,
            monto=Decimal(monto),
            descripcion=descripcion or "Transferencia desde Caja Diaria",
            estado=EstadoMovimientoCajaChica.APROBADO,
            referencia="CAJA_DIARIA",
            enviado_concentradora=False,
            caja_movimiento_id=caja_movimiento_id,
        )
        flush()
        return movimiento

    @db_session
    def enviar_a_concentradora(self, caja_chica_id: int, current_user) -> Dict[str, Any]:
        usuario = self._obtener_usuario(current_user)

        movimiento = CajaChica.get(id=caja_chica_id)
        if not movimiento:
            raise HTTPException(status_code=404, detail="Movimiento de caja chica no encontrado")

        self._validar_permisos(usuario, movimiento.sucursal)

        if movimiento.enviado_concentradora:
            raise HTTPException(status_code=400, detail="El movimiento ya fue enviado a la concentradora")

        if movimiento.tipo != TipoMovimientoCajaChica.INGRESO:
            raise HTTPException(status_code=400, detail="Solo los ingresos pueden enviarse a la concentradora")

        from src.models import TipoMovimientoConcentradora, OrigenConcentradora, EstadoConcentradora
        
        concentradora = CajaConcentradora(
            sucursal=movimiento.sucursal,
            usuario_envio=usuario,
            usuario=usuario,
            monto=movimiento.monto,
            descripcion=movimiento.descripcion,
            fecha=datetime.now(),
            tipo_movimiento=TipoMovimientoConcentradora.INGRESO,
            origen=OrigenConcentradora.CAJA_CHICA,
            destino=None,
            estado=EstadoConcentradora.CONFIRMADO,
            vaciado_por=None,
            fecha_vaciado=None,
            activo=True,
            movimiento_origen=movimiento,
        )

        movimiento.enviado_concentradora = True
        movimiento.movimiento_concentradora = concentradora
        flush()

        return {
            "message": "Monto enviado a la caja concentradora correctamente",
            "success": True,
            "data": {
                "caja_chica_id": movimiento.id,
                "concentradora_id": concentradora.id,
                "monto": float(concentradora.monto),
                "descripcion": concentradora.descripcion,
                "fecha": concentradora.fecha.isoformat() if concentradora.fecha else None,
                "enviado_por": usuario.id,
            },
        }