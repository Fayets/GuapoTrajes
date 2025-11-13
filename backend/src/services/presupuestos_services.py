from pony.orm import db_session, select, flush, commit, Database, desc
from datetime import datetime
from fastapi import HTTPException
from src.models import Presupuesto, ItemPresupuesto, Producto, Cliente, db
from src.schemas import PresupuestoCreate, PresupuestoResponse, ItemPresupuestoResponse

class PresupuestosServices:
    def __init__(self):
        pass

    def crear_presupuesto(self, data: PresupuestoCreate) -> dict:
        with db_session:
            try:
                
                # Verificar que el cliente existe
                cliente = Cliente.get(id=data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                

                # Verificar que todos los productos existen
                for i, item in enumerate(data.items):
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")

                # Calcular total
                total = sum(item.subtotal for item in data.items)

                # Generar número
                cantidad_presupuestos = Presupuesto.select().count()
                numero = f"PRES-{cantidad_presupuestos + 1:03d}"

                # Crear presupuesto
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
                

                # Crear items
                for i, item in enumerate(data.items):
                    producto = Producto.get(id=item.producto_id)
                    
                    ItemPresupuesto(
                        presupuesto=presupuesto,
                        producto=producto,
                        cantidad=item.cantidad,
                        precio_unitario=item.precio_unitario,
                        subtotal=item.subtotal,
                    )
                
                flush()
                commit()
                
                return {
                    "message": "Presupuesto creado exitosamente",
                    "success": True,
                    "data": {
                        "id": presupuesto.id,
                        "numero": presupuesto.numero,
                        "cliente_id": presupuesto.cliente.id,
                        "total": presupuesto.total,
                        "estado": presupuesto.estado
                    }
                }
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en crear_presupuesto: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

    def listar_presupuestos(self) -> list:
        with db_session:
            try:
                presupuestos = list(Presupuesto.select().order_by(desc(Presupuesto.fecha_creacion)))
                
                if not presupuestos:
                    return []
                
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
                        fecha_creacion=str(p.fecha_creacion) if p.fecha_creacion else None,
                        items=[
                            ItemPresupuestoResponse(
                                id=item.id,
                                producto_id=item.producto.id,
                                producto_descripcion=item.producto.descripcion,
                                cantidad=item.cantidad,
                                precio_unitario=item.precio_unitario,
                                subtotal=item.subtotal
                            )
                            for item in p.items
                        ],
                        seña_pagada=getattr(p.orden_trabajo, 'seña_pagada', None) if p.orden_trabajo else None,
                        metodo_pago=getattr(p.orden_trabajo, 'metodo_pago', None) if p.orden_trabajo else None
                    )
                    for p in presupuestos
                ]
            except Exception as e:
                print(f"❌ Error en listar_presupuestos: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al listar presupuestos: {str(e)}")

    def editar_presupuesto(self, presupuesto_id: int, data: PresupuestoCreate) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="No se puede editar: ya tiene orden de trabajo generada")

                # Verificar cliente
                cliente = Cliente.get(id=data.cliente_id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                # Verificar productos
                for item in data.items:
                    producto = Producto.get(id=item.producto_id)
                    if not producto:
                        raise HTTPException(status_code=404, detail=f"Producto ID {item.producto_id} no encontrado")

                # Actualizar presupuesto
                presupuesto.cliente = cliente
                presupuesto.fecha_evento = data.fecha_evento
                presupuesto.fecha_retiro = data.fecha_retiro
                presupuesto.fecha_devolucion = data.fecha_devolucion
                presupuesto.categoria_evento = data.categoria_evento
                presupuesto.nombre_agasajado = data.nombre_agasajado
                presupuesto.lugar_evento = data.lugar_evento
                presupuesto.observaciones = data.observaciones

                # Eliminar items existentes
                for item in presupuesto.items:
                    item.delete()

                # Crear nuevos items
                total = 0
                for item_data in data.items:
                    producto = Producto.get(id=item_data.producto_id)
                    subtotal = item_data.cantidad * item_data.precio_unitario
                    total += subtotal
                    
                    ItemPresupuesto(
                        presupuesto=presupuesto,
                        producto=producto,
                        cantidad=item_data.cantidad,
                        precio_unitario=item_data.precio_unitario,
                        subtotal=subtotal,
                    )

                presupuesto.total = total
                flush()
                commit()

                return {
                    "message": "Presupuesto actualizado exitosamente",
                    "success": True,
                    "data": {
                        "id": presupuesto.id,
                        "numero": presupuesto.numero,
                        "total": presupuesto.total
                    }
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al editar presupuesto: {str(e)}")

    def eliminar_presupuesto(self, presupuesto_id: int) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                if presupuesto.orden_trabajo:
                    raise HTTPException(status_code=400, detail="No se puede eliminar: ya tiene orden de trabajo generada")

                presupuesto.delete()
                return {
                    "message": "Presupuesto eliminado exitosamente",
                    "success": True
                }

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar presupuesto: {str(e)}")

    def obtener_presupuesto_por_id(self, presupuesto_id: int) -> dict:
        with db_session:
            try:
                presupuesto = Presupuesto.get(id=presupuesto_id)
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

                return PresupuestoResponse(
                    id=presupuesto.id,
                    numero=presupuesto.numero,
                    cliente_id=presupuesto.cliente.id,
                    cliente_nombre=f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}",
                    fecha_evento=str(presupuesto.fecha_evento),
                    fecha_retiro=str(presupuesto.fecha_retiro) if presupuesto.fecha_retiro else None,
                    fecha_devolucion=str(presupuesto.fecha_devolucion) if presupuesto.fecha_devolucion else None,
                    categoria_evento=presupuesto.categoria_evento,
                    nombre_agasajado=presupuesto.nombre_agasajado,
                    lugar_evento=presupuesto.lugar_evento,
                    observaciones=presupuesto.observaciones or "",
                    total=presupuesto.total,
                    estado=presupuesto.estado,
                    fecha_creacion=str(presupuesto.fecha_creacion) if presupuesto.fecha_creacion else None,
                    items=[
                        ItemPresupuestoResponse(
                            id=item.id,
                            producto_id=item.producto.id,
                            producto_descripcion=item.producto.descripcion,
                            cantidad=item.cantidad,
                            precio_unitario=item.precio_unitario,
                            subtotal=item.subtotal
                        )
                        for item in presupuesto.items
                    ],
                    seña_pagada=getattr(presupuesto.orden_trabajo, 'seña_pagada', None) if presupuesto.orden_trabajo else None,
                    metodo_pago=getattr(presupuesto.orden_trabajo, 'metodo_pago', None) if presupuesto.orden_trabajo else None
                )

            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error en obtener_presupuesto_por_id: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al obtener presupuesto: {str(e)}")
