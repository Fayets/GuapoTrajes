"""Trazabilidad de descuentos aplicados a clientes."""
from __future__ import annotations

from typing import Any, Optional

from src.models import AccionAuditoria, Cliente, Presupuesto, Usuario, Venta
from src.services.auditoria_services import nombre_usuario, registrar_auditoria


def descuento_maximo_estandar(usuario: Optional[Usuario]) -> float:
    from src.models import Roles

    if usuario and usuario.rol in (Roles.ADMIN, Roles.SUPER_ADMIN):
        return 50.0
    return 15.0


def _tiene_descuento(porcentaje: Optional[float]) -> bool:
    return porcentaje is not None and float(porcentaje) > 0


def _snapshot_descuento(
    porcentaje: Optional[float],
    monto: Optional[float],
    motivo: Optional[str],
) -> dict[str, Any]:
    return {
        "porcentaje": float(porcentaje or 0),
        "monto": float(monto or 0),
        "motivo": (motivo or "").strip(),
    }


def _cliente_resumen(cliente: Optional[Cliente]) -> dict[str, Any]:
    if not cliente:
        return {}
    return {
        "cliente_id": cliente.id,
        "cliente_nombre": f"{cliente.nombre} {cliente.apellido}".strip(),
        "cliente_dni": cliente.dni,
    }


def _tipo_descuento(porcentaje: float, maximo_estandar: float) -> str:
    return "extra" if porcentaje > maximo_estandar else "estandar"


def detalle_descuento(
    *,
    porcentaje: float,
    monto: float,
    motivo: str,
    cliente: Optional[Cliente],
    entidad_tipo: str,
    entidad_id: int,
    entidad_referencia: str,
    total_final: float,
    maximo_estandar: float,
    accion_contexto: str,
    descuento_anterior: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    detalle: dict[str, Any] = {
        **_cliente_resumen(cliente),
        "entidad_tipo": entidad_tipo,
        "entidad_id": entidad_id,
        "entidad_referencia": entidad_referencia,
        "porcentaje": round(float(porcentaje), 2),
        "monto": round(float(monto), 2),
        "motivo": motivo,
        "tipo": _tipo_descuento(float(porcentaje), maximo_estandar),
        "total_final": round(float(total_final), 2),
        "accion_contexto": accion_contexto,
    }
    if descuento_anterior is not None:
        detalle["descuento_anterior"] = descuento_anterior
    return detalle


def _resumen_descuento(
    accion: AccionAuditoria,
    porcentaje: float,
    monto: float,
    cliente: Optional[Cliente],
    entidad_referencia: str,
    motivo: str,
) -> str:
    cliente_txt = ""
    if cliente:
        cliente_txt = f" a {cliente.nombre} {cliente.apellido}".strip()
    base = f"Descuento {porcentaje:.0f}% (${monto:,.0f}){cliente_txt} — {entidad_referencia}"
    if accion == AccionAuditoria.DESCUENTO_MODIFICADO:
        return f"Descuento modificado: {base}"
    if accion == AccionAuditoria.DESCUENTO_ELIMINADO:
        return f"Descuento eliminado: {entidad_referencia}{cliente_txt}"
    if motivo:
        return f"{base} — {motivo}"
    return base


def registrar_descuento_auditoria(
    usuario: Optional[Usuario],
    accion: AccionAuditoria,
    entidad_tipo: str,
    entidad_id: int,
    *,
    porcentaje: float,
    monto: float,
    motivo: str,
    cliente: Optional[Cliente],
    entidad_referencia: str,
    total_final: float,
    maximo_estandar: float,
    accion_contexto: str,
    descuento_anterior: Optional[dict[str, Any]] = None,
) -> None:
    if usuario is None:
        return
    detalle = detalle_descuento(
        porcentaje=porcentaje,
        monto=monto,
        motivo=motivo,
        cliente=cliente,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        entidad_referencia=entidad_referencia,
        total_final=total_final,
        maximo_estandar=maximo_estandar,
        accion_contexto=accion_contexto,
        descuento_anterior=descuento_anterior,
    )
    resumen = _resumen_descuento(
        accion, porcentaje, monto, cliente, entidad_referencia, motivo
    )
    registrar_auditoria(
        usuario,
        accion,
        entidad_tipo,
        entidad_id,
        resumen,
        detalle,
    )


def registrar_cambio_descuento_presupuesto(
    presupuesto: Presupuesto,
    usuario: Optional[Usuario],
    *,
    porcentaje_nuevo: Optional[float],
    monto_nuevo: Optional[float],
    motivo_nuevo: Optional[str],
    total_final: float,
    accion_contexto: str,
    descuento_anterior: Optional[dict[str, Any]] = None,
) -> None:
    if usuario is None:
        return
    maximo = descuento_maximo_estandar(usuario)
    anterior = descuento_anterior or _snapshot_descuento(
        presupuesto.extra_discount_percentage,
        presupuesto.extra_discount_amount,
        presupuesto.extra_discount_reason,
    )
    nuevo = _snapshot_descuento(porcentaje_nuevo, monto_nuevo, motivo_nuevo)
    tenia = _tiene_descuento(anterior.get("porcentaje"))
    tiene = _tiene_descuento(nuevo.get("porcentaje"))

    if not tenia and not tiene:
        return

    cliente = presupuesto.cliente
    referencia = presupuesto.numero or f"Presupuesto #{presupuesto.id}"

    if not tenia and tiene:
        accion = AccionAuditoria.DESCUENTO_APLICADO
        detalle_anterior = None
    elif tenia and not tiene:
        accion = AccionAuditoria.DESCUENTO_ELIMINADO
        detalle_anterior = anterior
        nuevo = {"porcentaje": 0, "monto": 0, "motivo": ""}
    elif (
        abs(float(anterior["porcentaje"]) - float(nuevo["porcentaje"])) > 1e-9
        or abs(float(anterior["monto"]) - float(nuevo["monto"])) > 1e-9
        or (anterior.get("motivo") or "") != (nuevo.get("motivo") or "")
    ):
        accion = AccionAuditoria.DESCUENTO_MODIFICADO
        detalle_anterior = anterior
    else:
        return

    registrar_descuento_auditoria(
        usuario,
        accion,
        "presupuesto",
        presupuesto.id,
        porcentaje=float(nuevo["porcentaje"]),
        monto=float(nuevo["monto"]),
        motivo=str(nuevo.get("motivo") or ""),
        cliente=cliente,
        entidad_referencia=referencia,
        total_final=total_final,
        maximo_estandar=maximo,
        accion_contexto=accion_contexto,
        descuento_anterior=detalle_anterior,
    )


def registrar_descuento_venta(
    venta: Venta,
    usuario: Usuario,
    *,
    porcentaje: float,
    monto: float,
    motivo: str,
    total_final: float,
) -> None:
    if not _tiene_descuento(porcentaje):
        return
    maximo = descuento_maximo_estandar(usuario)
    referencia = f"Venta #{venta.id}"
    registrar_descuento_auditoria(
        usuario,
        AccionAuditoria.DESCUENTO_APLICADO,
        "venta",
        venta.id,
        porcentaje=porcentaje,
        monto=monto,
        motivo=motivo,
        cliente=venta.cliente,
        entidad_referencia=referencia,
        total_final=total_final,
        maximo_estandar=maximo,
        accion_contexto="venta_creada",
    )


def listar_descuentos_cliente(cliente_id: int) -> list[dict[str, Any]]:
    from pony.orm import db_session

    with db_session:
        cliente = Cliente.get(id=cliente_id)
        if not cliente:
            return []

        items: list[dict[str, Any]] = []

        for p in Presupuesto.select():
            if not p.cliente or p.cliente.id != cliente_id:
                continue
            if not _tiene_descuento(p.extra_discount_percentage):
                continue
            items.append(
                {
                    "fecha": p.extra_discount_created_at or p.fecha_creacion,
                    "origen": "presupuesto",
                    "origen_id": p.id,
                    "referencia": p.numero,
                    "porcentaje": float(p.extra_discount_percentage or 0),
                    "monto": float(p.extra_discount_amount or 0),
                    "motivo": (p.extra_discount_reason or "").strip(),
                    "total_final": float(p.total or 0),
                    "aplicado_por": nombre_usuario(p.extra_discount_applied_by),
                    "aplicado_por_id": (
                        p.extra_discount_applied_by.id if p.extra_discount_applied_by else None
                    ),
                    "tipo": _tipo_descuento(
                        float(p.extra_discount_percentage or 0),
                        descuento_maximo_estandar(p.extra_discount_applied_by),
                    ),
                }
            )

        for v in Venta.select():
            if not v.cliente or v.cliente.id != cliente_id:
                continue
            if not _tiene_descuento(v.extra_discount_percentage):
                continue
            items.append(
                {
                    "fecha": v.extra_discount_created_at or v.fecha_hora,
                    "origen": "venta",
                    "origen_id": v.id,
                    "referencia": f"Venta #{v.id}",
                    "porcentaje": float(v.extra_discount_percentage or 0),
                    "monto": float(v.extra_discount_amount or 0),
                    "motivo": (v.extra_discount_reason or "").strip(),
                    "total_final": float(v.total or 0),
                    "aplicado_por": nombre_usuario(v.extra_discount_applied_by),
                    "aplicado_por_id": (
                        v.extra_discount_applied_by.id if v.extra_discount_applied_by else None
                    ),
                    "tipo": _tipo_descuento(
                        float(v.extra_discount_percentage or 0),
                        descuento_maximo_estandar(v.extra_discount_applied_by),
                    ),
                }
            )

        items.sort(key=lambda x: x["fecha"] or "", reverse=True)
        for row in items:
            fh = row.pop("fecha")
            row["fecha"] = fh.isoformat() if hasattr(fh, "isoformat") else str(fh or "")
        return items
