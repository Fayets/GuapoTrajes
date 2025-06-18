from pony.orm import db_session, select, flush, commit, Database
from datetime import datetime
from src.models import Presupuesto, ItemPresupuesto, Producto, Cliente, db
from src.schemas import PresupuestoCreate, PresupuestoResponse, ItemPresupuestoResponse

@db_session
def crear_presupuesto(data: PresupuestoCreate) -> int:
    cliente = Cliente.get(id=data.cliente_id)
    if not cliente:
        raise ValueError("Cliente no encontrado")

    total = sum(item.subtotal for item in data.items)

    # Generar número correlativo tipo PRES-001
    cantidad_presupuestos = select(p for p in Presupuesto).count()
    numero = f"PRES-{cantidad_presupuestos + 1:03d}"

    presupuesto = Presupuesto(
        numero=numero,
        cliente=cliente,
        fecha_evento=data.fecha_evento,
        fecha_retiro=data.fecha_retiro,
        fecha_devolucion=data.fecha_devolucion,
        categoria_evento=data.categoria_evento,
        nombre_agasajado=data.nombre_agasajado,
        lugar_evento=data.lugar_evento,
        observaciones=data.observaciones,
        estado="pendiente",
        total=total,
        fecha_creacion=datetime.now(),
    )

    for item in data.items:
        producto = Producto.get(id=item.producto_id)
        if not producto:
            raise ValueError(f"Producto ID {item.producto_id} no encontrado")

        ItemPresupuesto(
            presupuesto=presupuesto,
            producto=producto,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=item.subtotal,
        )
    flush()
    commit()
    return presupuesto.id

@db_session
def listar_presupuestos():
    return [
        PresupuestoResponse(
            id=p.id,
            numero=p.numero,
            cliente_id=p.cliente.id,
            cliente_nombre=f"{p.cliente.nombre} {p.cliente.apellido}",
            fecha_evento=str(p.fecha_evento),
            fecha_retiro=str(p.fecha_retiro) if p.fecha_retiro else None,
            fecha_devolucion=str(p.fecha_devolucion) if p.fecha_devolucion else None,
            categoria_evento=p.categoria_evento,
            nombre_agasajado=p.nombre_agasajado,
            lugar_evento=p.lugar_evento,
            observaciones=p.observaciones or "",
            total=p.total,
            estado=p.estado,
            seña_pagada=p.orden_trabajo.seña_pagada if p.orden_trabajo else None,
            metodo_pago=p.orden_trabajo.metodo_pago if p.orden_trabajo else None,
            items=[
                ItemPresupuestoResponse(
                    producto_id=item.producto.id,
                    cantidad=item.cantidad,
                    precio_unitario=item.precio_unitario,
                    subtotal=item.subtotal,
                    producto_nombre=item.producto.descripcion
                )
                for item in p.items
            ]
        )
        for p in Presupuesto.select()
    ]


@db_session
def editar_presupuesto(presupuesto_id: int, data: PresupuestoCreate):
    presupuesto = Presupuesto.get(id=presupuesto_id)
    if not presupuesto:
        raise ValueError("Presupuesto no encontrado")

    if presupuesto.orden_trabajo:
        raise ValueError("No se puede editar un presupuesto con orden de trabajo generada")

    cliente = Cliente.get(id=data.cliente_id)
    if not cliente:
        raise ValueError("Cliente no encontrado")

    total = sum(item.subtotal for item in data.items)

    # Actualizar campos principales
    presupuesto.cliente = cliente
    presupuesto.fecha_evento = data.fecha_evento
    presupuesto.fecha_retiro = data.fecha_retiro
    presupuesto.fecha_devolucion = data.fecha_devolucion
    presupuesto.categoria_evento = data.categoria_evento
    presupuesto.nombre_agasajado = data.nombre_agasajado
    presupuesto.lugar_evento = data.lugar_evento
    presupuesto.observaciones = data.observaciones
    presupuesto.total = total

    # Borrar items actuales
    presupuesto.productos.clear()

    # Crear nuevos items
    for item in data.items:
        producto = Producto.get(id=item.producto_id)
        if not producto:
            raise ValueError(f"Producto ID {item.producto_id} no encontrado")

        ItemPresupuesto(
            presupuesto=presupuesto,
            producto=producto,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=item.subtotal,
        )

    return presupuesto.id
