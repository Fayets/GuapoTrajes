"""Registro y consulta de eventos de trazabilidad por usuario."""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Optional, Union

from fastapi import HTTPException
from pony.orm import db_session

from src.fechas_ar import ahora_ar, isoformat_ar
from src.models import AccionAuditoria, AuditoriaEvento, Roles, Sucursal, Usuario


def nombre_usuario(usuario: Optional[Usuario]) -> Optional[str]:
    if not usuario:
        return None
    return f"{usuario.nombre} {usuario.apellido}".strip() or usuario.username


def usuario_resumen(usuario: Optional[Usuario]) -> Optional[dict]:
    if not usuario:
        return None
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "username": usuario.username,
        "nombre_completo": nombre_usuario(usuario),
    }


def _accion_str(accion: Union[AccionAuditoria, str]) -> str:
    if isinstance(accion, AccionAuditoria):
        return accion.value
    return str(accion)


def registrar_auditoria(
    usuario: Optional[Usuario],
    accion: Union[AccionAuditoria, str],
    entidad_tipo: str,
    entidad_id: int,
    resumen: str,
    detalle: Optional[dict] = None,
    sucursal: Optional[Sucursal] = None,
) -> Optional[AuditoriaEvento]:
    """
    Persiste un evento de auditoría. Debe llamarse dentro de un db_session abierto.
    Si no hay usuario, no registra (no falla).
    """
    if usuario is None:
        return None
    suc = sucursal or getattr(usuario, "sucursal", None)
    if suc is None:
        return None
    detalle_str = None
    if detalle is not None:
        try:
            detalle_str = json.dumps(detalle, ensure_ascii=False, default=str)
        except Exception:
            detalle_str = str(detalle)
    kwargs = dict(
        fecha_hora=ahora_ar(),
        usuario=usuario,
        sucursal=suc,
        accion=_accion_str(accion),
        entidad_tipo=entidad_tipo,
        entidad_id=int(entidad_id),
        resumen=(resumen or "")[:500],
    )
    if detalle_str is not None:
        kwargs["detalle"] = detalle_str
    return AuditoriaEvento(**kwargs)


class AuditoriaServices:
    def listar(
        self,
        current_user: Usuario,
        usuario_id: Optional[int] = None,
        accion: Optional[str] = None,
        entidad_tipo: Optional[str] = None,
        entidad_id: Optional[int] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        sucursal_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        with db_session:
            user = Usuario.get(id=current_user.id)
            if not user:
                raise HTTPException(status_code=401, detail="Usuario no autenticado")
            rol = user.rol.value if hasattr(user.rol, "value") else str(user.rol)
            if rol not in (Roles.ADMIN.value, Roles.SUPER_ADMIN.value):
                raise HTTPException(status_code=403, detail="Permiso denegado")

            page = max(1, int(page or 1))
            page_size = min(100, max(1, int(page_size or 50)))

            eventos_all = list(AuditoriaEvento.select())
            if rol != Roles.SUPER_ADMIN.value:
                sid = user.sucursal.id
                eventos_all = [e for e in eventos_all if e.sucursal.id == sid]
            elif sucursal_id:
                sid = int(sucursal_id)
                eventos_all = [e for e in eventos_all if e.sucursal.id == sid]
            if usuario_id:
                uid = int(usuario_id)
                eventos_all = [e for e in eventos_all if e.usuario.id == uid]
            if accion:
                eventos_all = [e for e in eventos_all if e.accion == accion]
            if entidad_tipo:
                eventos_all = [e for e in eventos_all if e.entidad_tipo == entidad_tipo]
            if entidad_id is not None:
                eid = int(entidad_id)
                eventos_all = [e for e in eventos_all if e.entidad_id == eid]
            if fecha_desde:
                desde_dt = datetime.combine(fecha_desde, datetime.min.time())
                eventos_all = [e for e in eventos_all if e.fecha_hora >= desde_dt]
            if fecha_hasta:
                hasta_dt = datetime.combine(fecha_hasta, datetime.max.time())
                eventos_all = [e for e in eventos_all if e.fecha_hora <= hasta_dt]

            eventos_all.sort(key=lambda e: e.fecha_hora or datetime.min, reverse=True)
            total = len(eventos_all)
            start = (page - 1) * page_size
            eventos = eventos_all[start : start + page_size]

            items = []
            for e in eventos:
                detalle_parsed: Any = None
                if e.detalle:
                    try:
                        detalle_parsed = json.loads(e.detalle)
                    except Exception:
                        detalle_parsed = e.detalle
                items.append(
                    {
                        "id": e.id,
                        "fecha_hora": isoformat_ar(e.fecha_hora),
                        "usuario": usuario_resumen(e.usuario),
                        "sucursal_id": e.sucursal.id if e.sucursal else None,
                        "sucursal_nombre": e.sucursal.nombre if e.sucursal else None,
                        "accion": e.accion,
                        "entidad_tipo": e.entidad_tipo,
                        "entidad_id": e.entidad_id,
                        "resumen": e.resumen,
                        "detalle": detalle_parsed,
                    }
                )

            return {
                "message": "Eventos de auditoría",
                "success": True,
                "data": {
                    "items": items,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                    "acciones": [a.value for a in AccionAuditoria],
                },
            }
