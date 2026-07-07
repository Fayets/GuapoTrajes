from pony.orm import db_session, select
from fastapi import HTTPException
from datetime import date, datetime
from typing import List, Dict, Optional
import re
from src.descripcion_producto import format_descripcion_producto
from src.models import Presupuesto, OrdenTrabajo, ItemPresupuesto, Producto, Cliente, CajaMovimiento, Venta, TipoMovimiento, EstadoProducto, ProductoReservado, ProductoLavanderia, ProductoModista, DetalleVenta, DetalleVenta


class ReportesServices:
    def __init__(self):
        pass

    @staticmethod
    def _titular_presupuesto(presupuesto) -> Optional[Dict]:
        """Datos de contacto del cliente o precliente vinculado al presupuesto."""
        if presupuesto is None:
            return None
        if presupuesto.cliente:
            c = presupuesto.cliente
            return {
                "cliente_id": c.id,
                "precliente_id": None,
                "es_precliente": False,
                "cliente_nombre": f"{c.apellido} {c.nombre}".strip(),
                "cliente_dni": c.dni or "",
                "cliente_celular": c.celular or "",
                "cliente_direccion": c.direccion or "",
            }
        if presupuesto.precliente:
            pc = presupuesto.precliente
            return {
                "cliente_id": None,
                "precliente_id": pc.id,
                "es_precliente": True,
                "cliente_nombre": f"{pc.apellido} {pc.nombre}".strip(),
                "cliente_dni": "",
                "cliente_celular": pc.celular or "",
                "cliente_direccion": "",
            }
        return None

    @db_session
    def obtener_alquileres_por_prenda(
        self, 
        fecha_desde: date, 
        fecha_hasta: date,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener cantidad de veces que cada prenda fue alquilada en un rango de fechas.
        
        Args:
            fecha_desde: Fecha inicial del rango
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada prenda y cantidad de alquileres
        """
        try:
            # Obtener todas las órdenes de trabajo y filtrar en Python
            # para evitar problemas con PonyORM y consultas complejas
            todas_ordenes = list(OrdenTrabajo.select())
            
            # Filtrar órdenes que cumplan las condiciones
            ordenes = []
            for ot in todas_ordenes:
                try:
                    # Verificar que tenga presupuesto
                    if not ot.presupuesto:
                        continue
                    
                    # Verificar que la fecha_evento esté en el rango
                    if not ot.fecha_evento:
                        continue
                    
                    if ot.fecha_evento < fecha_desde or ot.fecha_evento > fecha_hasta:
                        continue
                    
                    # Si se especifica sucursal, verificar que algún producto sea de esa sucursal
                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            for item in ot.presupuesto.items:
                                if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                    tiene_producto_sucursal = True
                                    break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {ot.id}: {e}")
                            continue
                        
                        if not tiene_producto_sucursal:
                            continue
                    
                    ordenes.append(ot)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {ot.id if hasattr(ot, 'id') else 'N/A'}: {e}")
                    continue
            
            # Diccionario para acumular las cantidades por producto
            alquileres_por_producto = {}
            
            # Recorrer todas las órdenes
            for orden in ordenes:
                try:
                    presupuesto = orden.presupuesto
                    if not presupuesto:
                        continue
                    
                    fecha_evento_str = orden.fecha_evento.isoformat() if orden.fecha_evento else ""
                    
                    # Diccionario temporal para productos en esta orden (para contar una vez por orden)
                    productos_en_orden = {}
                    
                    # Recorrer los items del presupuesto
                    for item in presupuesto.items:
                        try:
                            producto = item.producto
                            if not producto:
                                continue
                            
                            producto_id = producto.id
                            
                            # Validar que el producto tenga sucursal
                            if not producto.sucursal:
                                print(f"⚠️ Producto {producto_id} no tiene sucursal asignada")
                                continue
                            
                            # Si el producto no está en el diccionario principal, inicializarlo
                            if producto_id not in alquileres_por_producto:
                                alquileres_por_producto[producto_id] = {
                                    "producto_id": producto_id,
                                    "codigo_barra": producto.codigo_barra or "N/A",
                                    "descripcion": format_descripcion_producto(
                                        producto.descripcion, producto.descripcion_extra
                                    ) or "N/A",
                                    "linea": (producto.linea.nombre if producto.linea else "N/A"),
                                    "talle": (producto.talle.nombre if producto.talle else "N/A"),
                                    "color": (producto.color.nombre if producto.color else "N/A"),
                                    "tela": (producto.tela.nombre if producto.tela else "N/A"),
                                    "sucursal_id": producto.sucursal.id if producto.sucursal else None,
                                    "sucursal_nombre": producto.sucursal.nombre if producto.sucursal else "N/A",
                                    "cantidad_total_alquilada": 0,
                                    "cantidad_veces_alquilada": 0,  # Número de órdenes que incluyeron este producto
                                    "fechas_alquiler": []  # Fechas en que fue alquilado
                                }
                            
                            # Sumar la cantidad alquilada
                            alquileres_por_producto[producto_id]["cantidad_total_alquilada"] += item.cantidad
                            
                            # Marcar que este producto está en esta orden (para contar una vez por orden)
                            if producto_id not in productos_en_orden:
                                productos_en_orden[producto_id] = True
                                alquileres_por_producto[producto_id]["cantidad_veces_alquilada"] += 1
                            
                            # Agregar la fecha del evento (sin duplicados)
                            if fecha_evento_str and fecha_evento_str not in alquileres_por_producto[producto_id]["fechas_alquiler"]:
                                alquileres_por_producto[producto_id]["fechas_alquiler"].append(fecha_evento_str)
                        except Exception as item_error:
                            print(f"⚠️ Error al procesar item {item.id if hasattr(item, 'id') else 'N/A'}: {item_error}")
                            import traceback
                            traceback.print_exc()
                            continue
                except Exception as orden_error:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {orden_error}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            # Convertir el diccionario a lista y ordenar por cantidad total alquilada (descendente)
            resultado = list(alquileres_por_producto.values())
            resultado.sort(key=lambda x: x["cantidad_total_alquilada"], reverse=True)
            
            return resultado
            
        except Exception as e:
            print(f"❌ Error al obtener alquileres por prenda: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener alquileres por prenda: {str(e)}")

    @db_session
    def obtener_ranking_alquileres(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None,
        ordenar_por: str = "veces_alquilada"  # "veces_alquilada" o "cantidad_total"
    ) -> List[Dict]:
        """
        Obtener ranking de prendas ordenadas por cantidad de alquileres.
        Incluye TODOS los productos de la sucursal, incluso los que nunca se alquilaron.
        
        Args:
            fecha_desde: Fecha inicial del rango
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (obligatorio)
            ordenar_por: Criterio de ordenamiento ("veces_alquilada" o "cantidad_total")
        
        Returns:
            Lista de diccionarios con información de cada prenda ordenada por ranking
        """
        try:
            if not sucursal_id:
                raise HTTPException(status_code=400, detail="sucursal_id es obligatorio para el ranking")
            
            print(f"🔍 DEBUG: Obteniendo ranking para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")
            
            # Obtener todos los productos y filtrar por sucursal en Python
            # Esto es más robusto que usar lambda en PonyORM
            todos_productos_raw = list(Producto.select())
            print(f"🔍 DEBUG: Total productos en BD: {len(todos_productos_raw)}")
            
            todos_productos = []
            for p in todos_productos_raw:
                try:
                    if p.sucursal and p.sucursal.id == sucursal_id:
                        todos_productos.append(p)
                except Exception as e:
                    print(f"⚠️ Error al verificar sucursal del producto {p.id if hasattr(p, 'id') else 'N/A'}: {e}")
                    continue
            
            print(f"🔍 DEBUG: Total productos encontrados en sucursal {sucursal_id}: {len(todos_productos)}")
            
            # Obtener los alquileres en el rango de fechas
            # Usar la lógica directamente para evitar problemas con sesiones anidadas
            todas_ordenes = list(OrdenTrabajo.select())
            
            # Filtrar órdenes que cumplan las condiciones
            ordenes = []
            for ot in todas_ordenes:
                try:
                    if not ot.presupuesto or not ot.fecha_evento:
                        continue
                    if ot.fecha_evento < fecha_desde or ot.fecha_evento > fecha_hasta:
                        continue
                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            for item in ot.presupuesto.items:
                                if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                    tiene_producto_sucursal = True
                                    break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {ot.id}: {e}")
                            continue
                        if not tiene_producto_sucursal:
                            continue
                    ordenes.append(ot)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {ot.id if hasattr(ot, 'id') else 'N/A'}: {e}")
                    continue
            
            # Diccionario para acumular las cantidades por producto
            alquileres_dict = {}
            
            # Recorrer todas las órdenes para obtener alquileres
            for orden in ordenes:
                try:
                    presupuesto = orden.presupuesto
                    if not presupuesto:
                        continue
                    
                    fecha_evento_str = orden.fecha_evento.isoformat() if orden.fecha_evento else ""
                    productos_en_orden = {}
                    
                    for item in presupuesto.items:
                        try:
                            producto = item.producto
                            if not producto or not producto.sucursal:
                                continue
                            
                            producto_id = producto.id
                            
                            if producto_id not in alquileres_dict:
                                alquileres_dict[producto_id] = {
                                    "producto_id": producto_id,
                                    "cantidad_total_alquilada": 0,
                                    "cantidad_veces_alquilada": 0,
                                }
                            
                            alquileres_dict[producto_id]["cantidad_total_alquilada"] += item.cantidad
                            
                            if producto_id not in productos_en_orden:
                                productos_en_orden[producto_id] = True
                                alquileres_dict[producto_id]["cantidad_veces_alquilada"] += 1
                        except Exception as item_error:
                            print(f"⚠️ Error al procesar item: {item_error}")
                            continue
                except Exception as orden_error:
                    print(f"⚠️ Error al procesar orden: {orden_error}")
                    continue
            
            # Crear el ranking con TODOS los productos
            ranking = []
            for producto in todos_productos:
                try:
                    producto_id = producto.id
                    
                    # Si el producto tiene alquileres, usar esos datos y completar información
                    if producto_id in alquileres_dict:
                        item = alquileres_dict[producto_id].copy()
                        # Completar información del producto
                        item["codigo_barra"] = producto.codigo_barra or "N/A"
                        item["descripcion"] = format_descripcion_producto(
                            producto.descripcion, producto.descripcion_extra
                        ) or "N/A"
                        item["linea"] = (producto.linea.nombre if producto.linea else "N/A")
                        item["talle"] = (producto.talle.nombre if producto.talle else "N/A")
                        item["color"] = (producto.color.nombre if producto.color else "N/A")
                        item["tela"] = (producto.tela.nombre if producto.tela else "N/A")
                        item["sucursal_id"] = producto.sucursal.id if producto.sucursal else None
                        item["sucursal_nombre"] = producto.sucursal.nombre if producto.sucursal else "N/A"
                        if "fechas_alquiler" not in item:
                            item["fechas_alquiler"] = []
                    else:
                        # Si no tiene alquileres, crear entrada con valores en 0
                        item = {
                            "producto_id": producto_id,
                            "codigo_barra": producto.codigo_barra or "N/A",
                            "descripcion": format_descripcion_producto(
                                producto.descripcion, producto.descripcion_extra
                            ) or "N/A",
                            "linea": (producto.linea.nombre if producto.linea else "N/A"),
                            "talle": (producto.talle.nombre if producto.talle else "N/A"),
                            "color": (producto.color.nombre if producto.color else "N/A"),
                            "tela": (producto.tela.nombre if producto.tela else "N/A"),
                            "sucursal_id": producto.sucursal.id if producto.sucursal else None,
                            "sucursal_nombre": producto.sucursal.nombre if producto.sucursal else "N/A",
                            "cantidad_total_alquilada": 0,
                            "cantidad_veces_alquilada": 0,
                            "fechas_alquiler": []
                        }
                    
                    ranking.append(item)
                except Exception as producto_error:
                    print(f"⚠️ Error al procesar producto {producto.id if hasattr(producto, 'id') else 'N/A'}: {producto_error}")
                    continue
            
            # Ordenar según el criterio especificado
            if ordenar_por == "cantidad_total":
                ranking.sort(key=lambda x: (x["cantidad_total_alquilada"], x["cantidad_veces_alquilada"]), reverse=True)
            else:  # Por defecto ordenar por veces alquilada
                ranking.sort(key=lambda x: (x["cantidad_veces_alquilada"], x["cantidad_total_alquilada"]), reverse=True)
            
            # Agregar posición en el ranking
            for index, item in enumerate(ranking, start=1):
                item["posicion"] = index
            
            print(f"🔍 DEBUG: Ranking generado con {len(ranking)} productos")
            if len(ranking) > 0:
                print(f"🔍 DEBUG: Primer producto del ranking: {ranking[0].get('codigo_barra', 'N/A')}")
            
            return ranking
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener ranking de alquileres: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener ranking de alquileres: {str(e)}")

    @db_session
    def obtener_contratos_por_fecha(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None,
        filtro_fecha: str = "fecha_creacion",  # "fecha_creacion" o "fecha_evento"
        tipo: str = "todos"  # "todos", "presupuestos", "ordenes_trabajo"
    ) -> List[Dict]:
        """
        Obtener contratos (presupuestos y órdenes de trabajo) filtrados por rango de fechas.
        
        Args:
            fecha_desde: Fecha inicial del rango
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
            filtro_fecha: Campo de fecha a usar para filtrar ("fecha_creacion" o "fecha_evento")
            tipo: Tipo de contrato a mostrar ("todos", "presupuestos", "ordenes_trabajo")
        
        Returns:
            Lista de diccionarios con información de cada contrato
        """
        try:
            print(f"🔍 DEBUG: Obteniendo contratos para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}, filtro={filtro_fecha}, tipo={tipo}")
            
            contratos = []
            
            # Procesar presupuestos si corresponde
            if tipo in ["todos", "presupuestos"]:
                todos_presupuestos = list(Presupuesto.select())
                print(f"🔍 DEBUG: Total presupuestos en BD: {len(todos_presupuestos)}")
                
                for presupuesto in todos_presupuestos:
                    try:
                        # Determinar qué fecha usar para filtrar
                        if filtro_fecha == "fecha_evento":
                            fecha_filtro = presupuesto.fecha_evento
                        else:  # Por defecto usar fecha_creacion
                            fecha_filtro = presupuesto.fecha_creacion.date() if isinstance(presupuesto.fecha_creacion, datetime) else presupuesto.fecha_creacion
                        
                        # Filtrar por rango de fechas
                        if fecha_filtro < fecha_desde or fecha_filtro > fecha_hasta:
                            continue
                        
                        # Si se especifica sucursal, verificar que algún producto del presupuesto sea de esa sucursal
                        if sucursal_id:
                            tiene_producto_sucursal = False
                            try:
                                for item in presupuesto.items:
                                    if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                        tiene_producto_sucursal = True
                                        break
                            except Exception as e:
                                print(f"⚠️ Error al verificar sucursal en presupuesto {presupuesto.id}: {e}")
                                continue
                            
                            if not tiene_producto_sucursal:
                                continue
                        
                        # Obtener información del cliente
                        cliente_nombre = "N/A"
                        cliente_dni = "N/A"
                        try:
                            if presupuesto.precliente:
                                cliente_nombre = f"{presupuesto.precliente.apellido} {presupuesto.precliente.nombre}".strip()
                                cliente_dni = "N/A"
                            elif presupuesto.cliente:
                                cliente_nombre = f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}".strip()
                                cliente_dni = presupuesto.cliente.dni or "N/A"
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos del cliente en presupuesto {presupuesto.id}: {e}")
                        
                        # Verificar si tiene orden de trabajo
                        tiene_orden = presupuesto.orden_trabajo is not None
                        orden_id = None
                        if tiene_orden:
                            try:
                                orden_id = presupuesto.orden_trabajo.id
                            except:
                                pass
                        
                        # Calcular total de items
                        cantidad_items = len(presupuesto.items) if presupuesto.items else 0
                        
                        contrato = {
                            "tipo": "presupuesto",
                            "id": presupuesto.id,
                            "presupuesto_id": presupuesto.id,
                            "numero": presupuesto.numero,
                            "cliente_id": presupuesto.cliente.id if presupuesto.cliente else None,
                            "cliente_nombre": cliente_nombre,
                            "cliente_dni": cliente_dni,
                            "fecha_creacion": presupuesto.fecha_creacion.isoformat() if isinstance(presupuesto.fecha_creacion, datetime) else str(presupuesto.fecha_creacion),
                            "fecha_evento": presupuesto.fecha_evento.isoformat() if presupuesto.fecha_evento else None,
                            "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else None,
                            "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else None,
                            "categoria_evento": presupuesto.categoria_evento or "N/A",
                            "nombre_agasajado": presupuesto.nombre_agasajado or "N/A",
                            "lugar_evento": presupuesto.lugar_evento or "N/A",
                            "total": float(presupuesto.total),
                            "estado": presupuesto.estado,
                            "cantidad_items": cantidad_items,
                            "tiene_orden_trabajo": tiene_orden,
                            "orden_trabajo_id": orden_id,
                            "observaciones": presupuesto.observaciones or "",
                            "seña_pagada": None,
                            "saldo_pendiente": None,
                            "metodo_pago": None
                        }
                        
                        contratos.append(contrato)
                    except Exception as presupuesto_error:
                        print(f"⚠️ Error al procesar presupuesto {presupuesto.id if hasattr(presupuesto, 'id') else 'N/A'}: {presupuesto_error}")
                        import traceback
                        traceback.print_exc()
                        continue
            
            # Procesar órdenes de trabajo si corresponde
            if tipo in ["todos", "ordenes_trabajo"]:
                todas_ordenes = list(OrdenTrabajo.select())
                print(f"🔍 DEBUG: Total órdenes de trabajo en BD: {len(todas_ordenes)}")
                
                for orden in todas_ordenes:
                    try:
                        presupuesto = orden.presupuesto
                        if not presupuesto:
                            continue
                        
                        # Determinar qué fecha usar para filtrar
                        if filtro_fecha == "fecha_evento":
                            fecha_filtro = orden.fecha_evento
                        else:  # Por defecto usar fecha_creacion
                            fecha_filtro = orden.fecha_creacion.date() if isinstance(orden.fecha_creacion, datetime) else orden.fecha_creacion
                        
                        # Filtrar por rango de fechas
                        if fecha_filtro < fecha_desde or fecha_filtro > fecha_hasta:
                            continue
                        
                        # Si se especifica sucursal, verificar que algún producto del presupuesto sea de esa sucursal
                        if sucursal_id:
                            tiene_producto_sucursal = False
                            try:
                                for item in presupuesto.items:
                                    if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                        tiene_producto_sucursal = True
                                        break
                            except Exception as e:
                                print(f"⚠️ Error al verificar sucursal en orden {orden.id}: {e}")
                                continue
                            
                            if not tiene_producto_sucursal:
                                continue
                        
                        # Obtener información del cliente
                        cliente_nombre = "N/A"
                        cliente_dni = "N/A"
                        try:
                            if presupuesto.precliente:
                                cliente_nombre = f"{presupuesto.precliente.apellido} {presupuesto.precliente.nombre}".strip()
                                cliente_dni = "N/A"
                            elif presupuesto.cliente:
                                cliente_nombre = f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}".strip()
                                cliente_dni = presupuesto.cliente.dni or "N/A"
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos del cliente en orden {orden.id}: {e}")
                        
                        # Calcular total de items
                        cantidad_items = len(presupuesto.items) if presupuesto.items else 0
                        
                        contrato = {
                            "tipo": "orden_trabajo",
                            "id": orden.id,
                            "presupuesto_id": presupuesto.id,
                            "orden_trabajo_id": orden.id,
                            "numero": f"ID-{orden.id}",
                            "cliente_id": presupuesto.cliente.id if presupuesto.cliente else None,
                            "cliente_nombre": cliente_nombre,
                            "cliente_dni": cliente_dni,
                            "fecha_creacion": orden.fecha_creacion.isoformat() if isinstance(orden.fecha_creacion, datetime) else str(orden.fecha_creacion),
                            "fecha_evento": orden.fecha_evento.isoformat() if orden.fecha_evento else None,
                            "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else None,
                            "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else None,
                            "categoria_evento": presupuesto.categoria_evento or "N/A",
                            "nombre_agasajado": presupuesto.nombre_agasajado or "N/A",
                            "lugar_evento": presupuesto.lugar_evento or "N/A",
                            "total": float(presupuesto.total),
                            "estado": orden.estado,
                            "cantidad_items": cantidad_items,
                            "tiene_orden_trabajo": True,
                            "observaciones": presupuesto.observaciones or "",
                            "seña_pagada": float(orden.seña_pagada),
                            "saldo_pendiente": float(orden.saldo_pendiente),
                            "metodo_pago": orden.metodo_pago or "N/A"
                        }
                        
                        contratos.append(contrato)
                    except Exception as orden_error:
                        print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {orden_error}")
                        import traceback
                        traceback.print_exc()
                        continue
            
            # Ordenar por fecha de creación descendente (más recientes primero)
            contratos.sort(key=lambda x: x["fecha_creacion"], reverse=True)
            
            print(f"🔍 DEBUG: Contratos encontrados: {len(contratos)}")
            
            return contratos
            
        except Exception as e:
            print(f"❌ Error al obtener contratos por fecha: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener contratos por fecha: {str(e)}")

    @db_session
    def obtener_recibos_por_fecha(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener recibos (comprobantes) de señas y pagos adicionales filtrados por rango de fechas.
        
        Args:
            fecha_desde: Fecha inicial del rango
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada recibo formateado
        """
        try:
            print(f"🔍 DEBUG: Obteniendo recibos para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")
            
            # Obtener todos los movimientos de caja
            todos_movimientos = list(CajaMovimiento.select())
            print(f"🔍 DEBUG: Total movimientos en BD: {len(todos_movimientos)}")
            
            recibos = []
            for movimiento in todos_movimientos:
                try:
                    # Filtrar solo movimientos de tipo INGRESO
                    if movimiento.tipo != TipoMovimiento.INGRESO:
                        continue
                    
                    if not movimiento.origen:
                        continue
                    
                    origen = movimiento.origen
                    es_seña = origen.startswith("SEÑA_PRESUPUESTO:")
                    es_pago_adicional = origen.startswith("PAGO_ADICIONAL_ORDEN:")
                    es_venta = origen.startswith("VENTA:")
                    
                    # Solo procesar señas, pagos adicionales y ventas
                    if not (es_seña or es_pago_adicional or es_venta):
                        continue
                    
                    # Filtrar por fecha
                    fecha_movimiento = movimiento.fecha_hora.date() if isinstance(movimiento.fecha_hora, datetime) else movimiento.fecha_hora
                    if fecha_movimiento < fecha_desde or fecha_movimiento > fecha_hasta:
                        continue
                    
                    # Filtrar por sucursal
                    if sucursal_id:
                        if not movimiento.sucursal or movimiento.sucursal.id != sucursal_id:
                            continue
                    
                    # Determinar concepto y obtener información del cliente
                    numero_presupuesto = None
                    concepto = None
                    cliente_nombre = "N/A"
                    cliente_dni = "N/A"
                    presupuesto_numero = None
                    
                    if es_venta:
                        # Obtener información de la venta
                        concepto = "venta"
                        try:
                            venta_id = int(origen.replace("VENTA:", ""))
                            venta = Venta.get(id=venta_id)
                            if venta and venta.cliente:
                                cliente_nombre = f"{venta.cliente.nombre} {venta.cliente.apellido}".strip()
                                cliente_dni = venta.cliente.dni or "N/A"
                                presupuesto_numero = f"VENTA-{venta.id}"
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos de la venta {origen}: {e}")
                    elif es_seña:
                        numero_presupuesto = origen.replace("SEÑA_PRESUPUESTO:", "")
                        concepto = "seña"
                        presupuesto_numero = numero_presupuesto
                        try:
                            presupuesto = Presupuesto.get(numero=numero_presupuesto)
                            if presupuesto and presupuesto.cliente:
                                cliente_nombre = f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}".strip()
                                cliente_dni = presupuesto.cliente.dni or "N/A"
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos del presupuesto {numero_presupuesto}: {e}")
                    elif es_pago_adicional:
                        numero_presupuesto = origen.replace("PAGO_ADICIONAL_ORDEN:", "")
                        concepto = "pago adicional"
                        presupuesto_numero = numero_presupuesto
                        try:
                            presupuesto = Presupuesto.get(numero=numero_presupuesto)
                            if presupuesto and presupuesto.cliente:
                                cliente_nombre = f"{presupuesto.cliente.nombre} {presupuesto.cliente.apellido}".strip()
                                cliente_dni = presupuesto.cliente.dni or "N/A"
                        except Exception as e:
                            print(f"⚠️ Error al obtener datos del presupuesto {numero_presupuesto}: {e}")
                    
                    # Obtener información del usuario que registró el movimiento
                    usuario_nombre = "N/A"
                    try:
                        if movimiento.usuario:
                            usuario_nombre = f"{movimiento.usuario.nombre} {movimiento.usuario.apellido}".strip()
                    except Exception as e:
                        print(f"⚠️ Error al obtener datos del usuario: {e}")
                    
                    # Obtener método de pago (nuevo sistema o compatibilidad)
                    metodo_pago = "N/A"
                    try:
                        if movimiento.metodo_pago_configurable:
                            # Nuevo sistema
                            metodo_pago = movimiento.metodo_pago_configurable.nombre
                            if movimiento.submetodo_pago:
                                metodo_pago = f"{movimiento.metodo_pago_configurable.nombre} - {movimiento.submetodo_pago.nombre}"
                        elif movimiento.payment_method:
                            # Sistema antiguo - compatibilidad
                            if hasattr(movimiento.payment_method, 'value'):
                                metodo_pago = movimiento.payment_method.value
                            else:
                                metodo_pago = str(movimiento.payment_method)
                    except Exception as e:
                        print(f"⚠️ Error al obtener método de pago: {e}")
                    
                    # Formatear el texto del recibo
                    monto_formateado = f"{movimiento.monto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    texto_recibo = f"Recibí de {cliente_nombre} la cantidad de ${monto_formateado} en concepto de {concepto}."
                    
                    recibo = {
                        "movimiento_id": movimiento.id,
                        "fecha": movimiento.fecha_hora.isoformat() if isinstance(movimiento.fecha_hora, datetime) else str(movimiento.fecha_hora),
                        "fecha_hora": movimiento.fecha_hora.isoformat() if isinstance(movimiento.fecha_hora, datetime) else str(movimiento.fecha_hora),
                        "presupuesto_numero": presupuesto_numero or "N/A",
                        "cliente_nombre": cliente_nombre,
                        "cliente_dni": cliente_dni,
                        "monto": float(movimiento.monto),
                        "concepto": concepto,
                        "texto_recibo": texto_recibo,
                        "metodo_pago": metodo_pago,
                        "usuario_nombre": usuario_nombre,
                        "sucursal_nombre": movimiento.sucursal.nombre if movimiento.sucursal else "N/A",
                        "origen": origen
                    }
                    
                    recibos.append(recibo)
                except Exception as movimiento_error:
                    print(f"⚠️ Error al procesar movimiento {movimiento.id if hasattr(movimiento, 'id') else 'N/A'}: {movimiento_error}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            # Ordenar por fecha descendente (más recientes primero)
            recibos.sort(key=lambda x: x["fecha"], reverse=True)
            
            print(f"🔍 DEBUG: Recibos encontrados: {len(recibos)}")
            
            return recibos
            
        except Exception as e:
            print(f"❌ Error al obtener recibos por fecha: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener recibos por fecha: {str(e)}")

    @db_session
    def obtener_ingresos_por_tipo(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None,
        cuenta_destino_id: Optional[int] = None,
        categoria: Optional[str] = None,
        payment_method: Optional[str] = None
    ) -> Dict:
        """
        Obtener ingresos agrupados por método de pago en un rango de fechas.
        
        Args:
            fecha_desde: Fecha inicial del rango
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Diccionario con ingresos agrupados por método de pago y total general
        """
        try:
            print(f"🔍 DEBUG: Obteniendo ingresos por tipo para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")

            # Obtener todos los movimientos y filtrar en Python
            todos_movimientos = list(CajaMovimiento.select())
            print(f"🔍 DEBUG: Total movimientos en BD: {len(todos_movimientos)}")

            # Filtrar movimientos de tipo INGRESO en el rango de fechas
            ingresos = []
            for movimiento in todos_movimientos:
                try:
                    # Solo movimientos de tipo INGRESO
                    if movimiento.tipo != TipoMovimiento.INGRESO:
                        continue

                    # Filtrar por fecha
                    fecha_movimiento = movimiento.fecha_hora.date() if isinstance(movimiento.fecha_hora, datetime) else movimiento.fecha_hora
                    if fecha_movimiento < fecha_desde or fecha_movimiento > fecha_hasta:
                        continue

                    # Filtrar por sucursal
                    if sucursal_id:
                        if not movimiento.sucursal or movimiento.sucursal.id != sucursal_id:
                            continue
                    
                    # Filtrar por cuenta destino
                    if cuenta_destino_id:
                        if not movimiento.cuenta_destino or movimiento.cuenta_destino.id != cuenta_destino_id:
                            continue
                    
                    # Filtrar por categoría
                    if categoria:
                        categoria_mov = movimiento.categoria if movimiento.categoria else self._determinar_categoria_automatica(movimiento.tipo, movimiento.origen)
                        if categoria_mov != categoria:
                            continue
                    
                    # Filtrar por método de pago (usar la misma lógica de mapeo que en caja diaria)
                    if payment_method:
                        # Determinar el método de pago del movimiento
                        metodo_movimiento = None
                        if movimiento.metodo_pago_configurable:
                            metodo_movimiento = movimiento.metodo_pago_configurable.nombre
                            if movimiento.submetodo_pago:
                                metodo_movimiento = f"{movimiento.metodo_pago_configurable.nombre} - {movimiento.submetodo_pago.nombre}"
                        elif movimiento.payment_method:
                            if hasattr(movimiento.payment_method, 'value'):
                                metodo_movimiento = movimiento.payment_method.value
                            else:
                                metodo_movimiento = str(movimiento.payment_method)
                        
                        # Mapear el método del movimiento a enum y comparar con el filtro
                        metodo_movimiento_enum = self._mapear_metodo_a_enum(metodo_movimiento or "")
                        metodo_filtro_enum = self._mapear_metodo_a_enum(payment_method)
                        
                        if metodo_movimiento_enum != metodo_filtro_enum:
                            continue

                    ingresos.append(movimiento)
                except Exception as e:
                    print(f"⚠️ Error al procesar movimiento {movimiento.id if hasattr(movimiento, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Ingresos encontrados: {len(ingresos)}")

            # Agrupar por método de pago y preparar detalles
            ingresos_por_tipo = {}
            total_general = 0.0
            detalles_movimientos = []

            for ingreso in ingresos:
                try:
                    # Obtener método de pago (nuevo sistema o compatibilidad)
                    metodo_pago = "SIN_METODO"
                    if ingreso.metodo_pago_configurable:
                        # Nuevo sistema
                        metodo_pago = ingreso.metodo_pago_configurable.nombre
                        if ingreso.submetodo_pago:
                            metodo_pago = f"{ingreso.metodo_pago_configurable.nombre} - {ingreso.submetodo_pago.nombre}"
                    elif ingreso.payment_method:
                        # Sistema antiguo - compatibilidad
                        if hasattr(ingreso.payment_method, 'value'):
                            metodo_pago = ingreso.payment_method.value
                        else:
                            metodo_pago = str(ingreso.payment_method)

                    # Obtener categoría
                    categoria_mov = ingreso.categoria if ingreso.categoria else self._determinar_categoria_automatica(ingreso.tipo, ingreso.origen)
                    
                    # Obtener cuenta destino
                    cuenta_destino_nombre = None
                    if ingreso.cuenta_destino:
                        cuenta_destino_nombre = ingreso.cuenta_destino.nombre_titular
                    
                    # Obtener usuario
                    usuario_nombre = None
                    if ingreso.usuario:
                        usuario_nombre = f"{ingreso.usuario.nombre} {ingreso.usuario.apellido}"

                    # Inicializar si no existe
                    if metodo_pago not in ingresos_por_tipo:
                        ingresos_por_tipo[metodo_pago] = {
                            "metodo": metodo_pago,
                            "cantidad": 0,
                            "total": 0.0
                        }

                    # Sumar cantidad y monto
                    ingresos_por_tipo[metodo_pago]["cantidad"] += 1
                    ingresos_por_tipo[metodo_pago]["total"] += float(ingreso.monto)
                    total_general += float(ingreso.monto)
                    
                    # Agregar detalle del movimiento
                    detalles_movimientos.append({
                        "id": ingreso.id,
                        "fecha_hora": ingreso.fecha_hora.isoformat() if ingreso.fecha_hora else None,
                        "origen": ingreso.origen,
                        "categoria": categoria_mov,
                        "monto": float(ingreso.monto),
                        "metodo_pago": metodo_pago,
                        "cuenta_destino_nombre": cuenta_destino_nombre,
                        "usuario_nombre": usuario_nombre
                    })
                except Exception as e:
                    print(f"⚠️ Error al procesar ingreso {ingreso.id if hasattr(ingreso, 'id') else 'N/A'}: {e}")
                    continue

            # Convertir a lista y ordenar por total descendente
            ingresos_lista = list(ingresos_por_tipo.values())
            ingresos_lista.sort(key=lambda x: x["total"], reverse=True)
            
            # Ordenar detalles por fecha descendente
            detalles_movimientos.sort(key=lambda x: x["fecha_hora"] if x["fecha_hora"] else "", reverse=True)

            print(f"🔍 DEBUG: Tipos de pago encontrados: {len(ingresos_lista)}")

            return {
                "ingresos_por_tipo": ingresos_lista,
                "total_general": total_general,
                "cantidad_total": len(ingresos),
                "detalles": detalles_movimientos
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener ingresos por tipo: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener ingresos por tipo: {str(e)}")
    
    def _mapear_metodo_a_enum(self, metodo: str) -> str:
        """Mapea un método de pago (configurable o nombre libre) a un valor de enum general.
        Usa la misma lógica que en caja_services para mantener consistencia."""
        if not metodo:
            return ""
        metodo_lower = metodo.lower()
        
        # IMPORTANTE: Verificar "crédito" ANTES de "tarjeta" o "master"
        if "efectivo" in metodo_lower:
            return "EFECTIVO"
        if "crédito" in metodo_lower or "credito" in metodo_lower:
            return "CREDITO"
        if "débito" in metodo_lower or "debito" in metodo_lower:
            return "DEBITO"
        if "tarjeta" in metodo_lower or "visa" in metodo_lower or "master" in metodo_lower:
            # Si contiene "crédito" en el nombre, mapear a CREDITO, sino a DEBITO
            if "crédito" in metodo_lower or "credito" in metodo_lower:
                return "CREDITO"
            return "DEBITO"
        if "billetera" in metodo_lower or "mercado pago" in metodo_lower or "naranja" in metodo_lower or "uala" in metodo_lower:
            return "BILLETERA_VIRTUAL"
        if "transferencia" in metodo_lower:
            return "TRANSFERENCIA"
        
        return metodo
    
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
            return "OTROS"

    @db_session
    def obtener_stock_por_estado(
        self,
        sucursal_id: Optional[int] = None
    ) -> Dict:
        """
        Obtener stock agrupado por estado de producto.
        
        Args:
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Diccionario con stock agrupado por estado y totales generales
        """
        try:
            print(f"🔍 DEBUG: Obteniendo stock por estado para sucursal_id={sucursal_id}")

            # Obtener todos los productos y filtrar en Python
            todos_productos = list(Producto.select())
            print(f"🔍 DEBUG: Total productos en BD: {len(todos_productos)}")

            # Filtrar por sucursal si se especifica
            productos = []
            for producto in todos_productos:
                try:
                    if sucursal_id:
                        if not producto.sucursal or producto.sucursal.id != sucursal_id:
                            continue
                    productos.append(producto)
                except Exception as e:
                    print(f"⚠️ Error al procesar producto {producto.id if hasattr(producto, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Productos encontrados en sucursal: {len(productos)}")

            # Agrupar por estado
            stock_por_estado = {}
            total_productos = 0

            # Inicializar todos los estados posibles
            estados_posibles = [
                EstadoProducto.SALON,
                EstadoProducto.CLIENTE,
                EstadoProducto.LAVANDERIA,
                EstadoProducto.MODISTA,
                EstadoProducto.VENDIDO
            ]

            for estado in estados_posibles:
                stock_por_estado[estado.value] = {
                    "estado": estado.value,
                    "cantidad_productos": 0,
                    "productos": []
                }

            # Procesar cada producto
            for producto in productos:
                try:
                    estado = producto.estado.value if hasattr(producto.estado, 'value') else str(producto.estado)
                    
                    if estado not in stock_por_estado:
                        stock_por_estado[estado] = {
                            "estado": estado,
                            "cantidad_productos": 0,
                            "productos": []
                        }

                    # Agregar producto a la lista
                    producto_info = {
                        "id": producto.id,
                        "codigo_barra": producto.codigo_barra,
                        "descripcion": format_descripcion_producto(
                            producto.descripcion, producto.descripcion_extra
                        ),
                        "linea": (producto.linea.nombre if producto.linea else None),
                        "talle": (producto.talle.nombre if producto.talle else None),
                        "color": (producto.color.nombre if producto.color else None),
                        "tela": (producto.tela.nombre if producto.tela else None),
                        "estado": estado
                    }
                    stock_por_estado[estado]["productos"].append(producto_info)
                    stock_por_estado[estado]["cantidad_productos"] += 1

                    # Totales generales
                    total_productos += 1
                except Exception as e:
                    print(f"⚠️ Error al procesar producto {producto.id if hasattr(producto, 'id') else 'N/A'}: {e}")
                    continue

            # Convertir a lista y ordenar por cantidad de productos descendente
            stock_lista = list(stock_por_estado.values())
            stock_lista.sort(key=lambda x: x["cantidad_productos"], reverse=True)

            print(f"🔍 DEBUG: Estados encontrados: {len(stock_lista)}")

            return {
                "stock_por_estado": stock_lista,
                "total_productos": total_productos
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener stock por estado: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener stock por estado: {str(e)}")

    @db_session
    def obtener_stock_por_linea(
        self,
        sucursal_id: Optional[int] = None
    ) -> Dict:
        """
        Obtener stock agrupado por línea de producto, valorizado a costo y precio de venta.
        
        Args:
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Diccionario con stock agrupado por línea y totales generales
        """
        try:
            print(f"🔍 DEBUG: Obteniendo stock por línea para sucursal_id={sucursal_id}")

            # Obtener todos los productos y filtrar en Python
            todos_productos = list(Producto.select())
            print(f"🔍 DEBUG: Total productos en BD: {len(todos_productos)}")

            # Filtrar por sucursal si se especifica
            productos = []
            for producto in todos_productos:
                try:
                    if sucursal_id:
                        if not producto.sucursal or producto.sucursal.id != sucursal_id:
                            continue
                    productos.append(producto)
                except Exception as e:
                    print(f"⚠️ Error al procesar producto {producto.id if hasattr(producto, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Productos encontrados en sucursal: {len(productos)}")

            # Agrupar por línea
            stock_por_linea = {}
            total_productos = 0
            total_valor_costo = 0.0
            total_valor_venta = 0.0

            # Procesar cada producto
            for producto in productos:
                try:
                    linea = (producto.linea.nombre if producto.linea else "SIN_LINEA")
                    
                    if linea not in stock_por_linea:
                        stock_por_linea[linea] = {
                            "linea": linea,
                            "cantidad_productos": 0,
                            "valor_costo": 0.0,
                            "valor_venta": 0.0
                        }

                    # Actualizar estadísticas
                    stock_por_linea[linea]["cantidad_productos"] += 1
                    # Como cada prenda es única, stock siempre es 1, pero calculamos el valor
                    valor_costo_producto = producto.costo * producto.stock
                    valor_venta_producto = producto.precio_venta * producto.stock
                    stock_por_linea[linea]["valor_costo"] += valor_costo_producto
                    stock_por_linea[linea]["valor_venta"] += valor_venta_producto

                    # Totales generales
                    total_productos += 1
                    total_valor_costo += valor_costo_producto
                    total_valor_venta += valor_venta_producto
                except Exception as e:
                    print(f"⚠️ Error al procesar producto {producto.id if hasattr(producto, 'id') else 'N/A'}: {e}")
                    continue

            # Convertir a lista y ordenar por valor a venta descendente
            stock_lista = list(stock_por_linea.values())
            stock_lista.sort(key=lambda x: x["valor_venta"], reverse=True)

            print(f"🔍 DEBUG: Líneas encontradas: {len(stock_lista)}")

            return {
                "stock_por_linea": stock_lista,
                "total_productos": total_productos,
                "total_valor_costo": total_valor_costo,
                "total_valor_venta": total_valor_venta
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener stock por línea: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener stock por línea: {str(e)}")

    @db_session
    def obtener_saldos_a_cobrar(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener reporte de saldos pendientes a cobrar de clientes en un rango de fechas.
        Muestra las órdenes de trabajo con saldo_pendiente > 0.

        Args:
            fecha_desde: Fecha inicial del rango (filtra por fecha_evento de la orden)
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)

        Returns:
            Lista de diccionarios con información de cada cliente y su saldo pendiente
        """
        try:
            print(f"🔍 DEBUG: Obteniendo saldos a cobrar para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")

            todas_ordenes = list(OrdenTrabajo.select())
            print(f"🔍 DEBUG: Total órdenes en BD: {len(todas_ordenes)}")

            ordenes_con_saldo = []
            for orden in todas_ordenes:
                try:
                    if orden.saldo_pendiente <= 0:
                        continue

                    presupuesto = orden.presupuesto
                    titular = self._titular_presupuesto(presupuesto)
                    if not presupuesto or not titular:
                        continue

                    if orden.estado and orden.estado.lower() == "cancelada":
                        continue

                    if not orden.fecha_evento:
                        continue

                    if orden.fecha_evento < fecha_desde or orden.fecha_evento > fecha_hasta:
                        continue

                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            for pr in list(orden.productos_reservados):
                                if (
                                    pr.producto
                                    and pr.producto.sucursal
                                    and pr.producto.sucursal.id == sucursal_id
                                ):
                                    tiene_producto_sucursal = True
                                    break
                            if not tiene_producto_sucursal:
                                for item in presupuesto.items:
                                    if (
                                        item.producto
                                        and item.producto.sucursal
                                        and item.producto.sucursal.id == sucursal_id
                                    ):
                                        tiene_producto_sucursal = True
                                        break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {orden.id}: {e}")
                            continue

                        if not tiene_producto_sucursal:
                            continue

                    ordenes_con_saldo.append(orden)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Órdenes con saldo pendiente encontradas: {len(ordenes_con_saldo)}")

            saldos_por_cliente = {}
            for orden in ordenes_con_saldo:
                try:
                    presupuesto = orden.presupuesto
                    titular = self._titular_presupuesto(presupuesto)
                    if not titular:
                        continue

                    group_key = (
                        f"c-{titular['cliente_id']}"
                        if titular["cliente_id"] is not None
                        else f"p-{titular['precliente_id']}"
                    )

                    if group_key not in saldos_por_cliente:
                        saldos_por_cliente[group_key] = {
                            "cliente_id": titular["cliente_id"],
                            "precliente_id": titular["precliente_id"],
                            "es_precliente": titular["es_precliente"],
                            "cliente_nombre": titular["cliente_nombre"],
                            "cliente_dni": titular["cliente_dni"],
                            "cliente_celular": titular["cliente_celular"],
                            "cliente_telefono": "",
                            "total_saldo_pendiente": 0.0,
                            "cantidad_ordenes": 0,
                            "ordenes": [],
                        }

                    orden_info = {
                        "orden_id": orden.id,
                        "presupuesto_numero": presupuesto.numero,
                        "fecha_evento": orden.fecha_evento.isoformat() if orden.fecha_evento else "",
                        "fecha_creacion": orden.fecha_creacion.isoformat() if orden.fecha_creacion else "",
                        "saldo_pendiente": float(orden.saldo_pendiente),
                        "seña_pagada": float(orden.seña_pagada),
                        "total_orden": float(orden.seña_pagada + orden.saldo_pendiente),
                        "estado": orden.estado,
                        "metodo_pago": orden.metodo_pago or "",
                    }

                    saldos_por_cliente[group_key]["ordenes"].append(orden_info)
                    saldos_por_cliente[group_key]["total_saldo_pendiente"] += float(orden.saldo_pendiente)
                    saldos_por_cliente[group_key]["cantidad_ordenes"] += 1
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            saldos_lista = list(saldos_por_cliente.values())
            saldos_lista.sort(key=lambda x: x["total_saldo_pendiente"], reverse=True)

            print(f"🔍 DEBUG: Clientes con saldo pendiente: {len(saldos_lista)}")

            return saldos_lista

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener saldos a cobrar: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener saldos a cobrar: {str(e)}")

    @db_session
    def obtener_prendas_a_armar(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener reporte de prendas a armar (órdenes de trabajo a entregar).
        Muestra las órdenes de trabajo con fecha_evento entre las fechas seleccionadas,
        incluyendo los productos/conjuntos que hay que separar.
        
        Args:
            fecha_desde: Fecha inicial del rango (filtra por fecha_evento de la orden)
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada orden y sus productos a armar
        """
        try:
            print(f"🔍 DEBUG: Obteniendo prendas a armar para sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")

            # Reutiliza la misma lógica de criticidad para armado semanal:
            # estado != SALON o presencia activa en lavandería/modista.
            # Evitar lambdas en select() por compatibilidad con bytecode reciente (LOAD_FAST_BORROW).
            productos_lavanderia = [
                pl for pl in list(ProductoLavanderia.select()) if pl.fecha_salida is None
            ]
            productos_modista = [
                pm for pm in list(ProductoModista.select()) if pm.fecha_salida is None
            ]
            productos_en_lavanderia = {pl.producto.id for pl in productos_lavanderia}
            productos_en_modista = {pm.producto.id for pm in productos_modista}
            info_lavanderia = {
                pl.producto.id: (pl.lavanderia.nombre if pl.lavanderia else "N/A")
                for pl in productos_lavanderia
            }
            info_modista = {
                pm.producto.id: (pm.modista.nombre if pm.modista else "N/A")
                for pm in productos_modista
            }

            # Obtener todas las órdenes de trabajo y filtrar en Python
            todas_ordenes = list(OrdenTrabajo.select())
            print(f"🔍 DEBUG: Total órdenes en BD: {len(todas_ordenes)}")

            # Filtrar órdenes con fecha_evento en el rango de fechas
            ordenes_filtradas = []
            for orden in todas_ordenes:
                try:
                    presupuesto = orden.presupuesto
                    if not presupuesto or not self._titular_presupuesto(presupuesto):
                        continue

                    # Filtrar por fecha_evento (fecha de entrega)
                    if not orden.fecha_evento:
                        continue
                    
                    if orden.fecha_evento < fecha_desde or orden.fecha_evento > fecha_hasta:
                        continue

                    # Filtrar por sucursal (basado en productos del presupuesto)
                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            for item in presupuesto.items:
                                if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                    tiene_producto_sucursal = True
                                    break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {orden.id}: {e}")
                            continue
                        
                        if not tiene_producto_sucursal:
                            continue

                    # Solo incluir órdenes que no estén canceladas
                    if orden.estado and orden.estado.lower() == "cancelada":
                        continue

                    # Ya con contrato generado: no listar en prendas a armar (evita duplicar con devoluciones)
                    if getattr(orden, "contrato_generado_at", None):
                        continue

                    ordenes_filtradas.append(orden)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Órdenes encontradas: {len(ordenes_filtradas)}")

            # Construir la lista de resultados
            resultado = []
            for orden in ordenes_filtradas:
                try:
                    presupuesto = orden.presupuesto
                    titular = self._titular_presupuesto(presupuesto)
                    if not titular:
                        continue

                    fecha_retiro_iso = (
                        presupuesto.fecha_retiro.isoformat()
                        if presupuesto.fecha_retiro
                        else ""
                    )
                    pr_por_producto = {
                        pr.producto.id: pr for pr in orden.productos_reservados
                    }

                    # Obtener productos/conjuntos a armar (items del presupuesto)
                    productos_a_armar = []
                    for item in presupuesto.items:
                        producto = item.producto
                        estado_producto = (
                            producto.estado.value
                            if hasattr(producto.estado, "value")
                            else str(producto.estado)
                        )

                        es_critico_armado = False
                        motivo_critico_armado = ""
                        ubicacion_critica = ""

                        if estado_producto != "SALON":
                            es_critico_armado = True
                            if estado_producto == "LAVANDERIA":
                                motivo_critico_armado = "En lavandería"
                                ubicacion_critica = info_lavanderia.get(producto.id, "N/A")
                            elif estado_producto == "MODISTA":
                                motivo_critico_armado = "En modista"
                                ubicacion_critica = info_modista.get(producto.id, "N/A")
                            elif estado_producto == "CLIENTE":
                                motivo_critico_armado = "En poder del cliente"
                                ubicacion_critica = "Cliente"
                            else:
                                motivo_critico_armado = f"Estado: {estado_producto}"
                                ubicacion_critica = estado_producto

                        if producto.id in productos_en_lavanderia:
                            es_critico_armado = True
                            motivo_critico_armado = "En lavandería"
                            ubicacion_critica = info_lavanderia.get(producto.id, "N/A")

                        if producto.id in productos_en_modista:
                            es_critico_armado = True
                            motivo_critico_armado = "En modista"
                            ubicacion_critica = info_modista.get(producto.id, "N/A")

                        pr_item = pr_por_producto.get(producto.id)
                        requiere_modista_orden = bool(
                            pr_item and getattr(pr_item, "requiere_modista", False)
                        )
                        notas_modista_orden = (
                            (pr_item.notas_modista or "").strip()
                            if pr_item and requiere_modista_orden
                            else ""
                        )

                        productos_a_armar.append({
                            "producto_id": producto.id,
                            "codigo_barra": producto.codigo_barra,
                            "descripcion": format_descripcion_producto(
                                producto.descripcion, producto.descripcion_extra
                            ),
                            "linea": (producto.linea.nombre if producto.linea else None),
                            "talle": (producto.talle.nombre if producto.talle else None),
                            "color": (producto.color.nombre if producto.color else None),
                            "tela": (producto.tela.nombre if producto.tela else None),
                            "descripcion_extra": producto.descripcion_extra or "",
                            "cantidad": item.cantidad,
                            "precio_unitario": float(item.precio_unitario),
                            "subtotal": float(item.subtotal),
                            "estado_actual": estado_producto,
                            "es_critico_armado": es_critico_armado,
                            "motivo_critico_armado": motivo_critico_armado,
                            "ubicacion_critica": ubicacion_critica,
                            "requiere_modista": requiere_modista_orden,
                            "notas_modista": notas_modista_orden,
                            "fecha_retiro": fecha_retiro_iso,
                        })

                    orden_info = {
                        "orden_id": orden.id,
                        "presupuesto_id": presupuesto.id,
                        "presupuesto_numero": presupuesto.numero,
                        "cliente_id": titular["cliente_id"],
                        "precliente_id": titular["precliente_id"],
                        "es_precliente": titular["es_precliente"],
                        "cliente_nombre": titular["cliente_nombre"],
                        "cliente_dni": titular["cliente_dni"],
                        "cliente_celular": titular["cliente_celular"],
                        "cliente_direccion": titular["cliente_direccion"],
                        "fecha_evento": orden.fecha_evento.isoformat() if orden.fecha_evento else "",
                        "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else "",
                        "categoria_evento": presupuesto.categoria_evento or "",
                        "nombre_agasajado": presupuesto.nombre_agasajado or "",
                        "lugar_evento": presupuesto.lugar_evento or "",
                        "estado": orden.estado,
                        "total": float(presupuesto.total),
                        "productos": productos_a_armar,
                        "cantidad_productos": len(productos_a_armar),
                        "cantidad_total_items": sum(item.cantidad for item in presupuesto.items),
                        "etiquetas_impresas_en_orden": bool(
                            getattr(orden, "etiquetas_armado_impresas_at", None)
                        ),
                        "etiquetas_armado_impresas_at": (
                            orden.etiquetas_armado_impresas_at.isoformat()
                            if getattr(orden, "etiquetas_armado_impresas_at", None)
                            else None
                        ),
                        "conjunto_separado": bool(
                            getattr(orden, "conjunto_separado", False)
                        ),
                    }

                    resultado.append(orden_info)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            # Ordenar por fecha_evento ascendente
            resultado.sort(key=lambda x: x["fecha_evento"])

            print(f"🔍 DEBUG: Órdenes procesadas: {len(resultado)}")

            return resultado

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener prendas a armar: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener prendas a armar: {str(e)}")

    @db_session
    def obtener_no_devolvieron(
        self,
        fecha_hasta: Optional[date] = None,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener reporte de órdenes de trabajo que no han devuelto los productos.
        Muestra las órdenes donde la fecha_devolucion ya pasó y los productos no fueron devueltos.
        
        Args:
            fecha_hasta: Fecha de referencia (default: fecha actual). Se comparan órdenes con fecha_devolucion anterior a esta fecha
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada orden y sus productos no devueltos
        """
        try:
            from datetime import date as date_type
            if fecha_hasta is None:
                fecha_hasta = date_type.today()
            
            print(f"🔍 DEBUG: Obteniendo no devolvieron para sucursal_id={sucursal_id}, fecha_hasta={fecha_hasta}")

            # Obtener todas las órdenes de trabajo y filtrar en Python
            todas_ordenes = list(OrdenTrabajo.select())
            print(f"🔍 DEBUG: Total órdenes en BD: {len(todas_ordenes)}")

            # Filtrar órdenes que no han devuelto
            ordenes_no_devueltas = []
            for orden in todas_ordenes:
                try:
                    # Verificar que tenga presupuesto y cliente
                    if not orden.presupuesto or not orden.presupuesto.cliente:
                        continue

                    # Excluir órdenes canceladas
                    if orden.estado and orden.estado.lower() == "cancelada":
                        continue

                    # Excluir órdenes completadas (ya devolvieron todos los productos)
                    if orden.estado and orden.estado.lower() == "completada":
                        continue

                    # Verificar que tenga fecha_devolucion
                    presupuesto = orden.presupuesto
                    if not presupuesto.fecha_devolucion:
                        continue

                    # Verificar que la fecha_devolucion ya pasó (es menor a fecha_hasta)
                    if presupuesto.fecha_devolucion >= fecha_hasta:
                        continue

                    # Verificar que AÚN tenga productos reservados (no devolvió)
                    productos_reservados = list(orden.productos_reservados)
                    if not productos_reservados or len(productos_reservados) == 0:
                        # Si no tiene productos reservados, ya devolvió todo
                        continue

                    # Filtrar por sucursal (basado en productos reservados o productos del presupuesto)
                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            # Primero verificar en productos reservados
                            for pr in productos_reservados:
                                if pr.producto and pr.producto.sucursal and pr.producto.sucursal.id == sucursal_id:
                                    tiene_producto_sucursal = True
                                    break
                            
                            # Si no encontró en productos reservados, verificar en items del presupuesto
                            if not tiene_producto_sucursal:
                                for item in presupuesto.items:
                                    if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                        tiene_producto_sucursal = True
                                        break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {orden.id}: {e}")
                            continue
                        
                        if not tiene_producto_sucursal:
                            continue

                    ordenes_no_devueltas.append(orden)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Órdenes no devueltas encontradas: {len(ordenes_no_devueltas)}")

            # Construir la lista de resultados
            resultado = []
            for orden in ordenes_no_devueltas:
                try:
                    cliente = orden.presupuesto.cliente
                    presupuesto = orden.presupuesto

                    # Obtener productos de la orden (items del presupuesto)
                    productos = []
                    for item in presupuesto.items:
                        producto = item.producto
                        productos.append({
                            "producto_id": producto.id,
                            "codigo_barra": producto.codigo_barra,
                            "descripcion": format_descripcion_producto(
                                producto.descripcion, producto.descripcion_extra
                            ),
                            "linea": (producto.linea.nombre if producto.linea else None),
                            "talle": (producto.talle.nombre if producto.talle else None),
                            "color": (producto.color.nombre if producto.color else None),
                            "tela": (producto.tela.nombre if producto.tela else None),
                            "descripcion_extra": producto.descripcion_extra or "",
                            "cantidad": item.cantidad,
                            "precio_unitario": float(item.precio_unitario),
                            "subtotal": float(item.subtotal)
                        })

                    # Calcular días de retraso
                    dias_retraso = (fecha_hasta - presupuesto.fecha_devolucion).days

                    orden_info = {
                        "orden_id": orden.id,
                        "presupuesto_id": presupuesto.id,
                        "presupuesto_numero": presupuesto.numero,
                        "cliente_id": cliente.id,
                        "cliente_nombre": f"{cliente.nombre} {cliente.apellido}",
                        "cliente_dni": cliente.dni or "",
                        "cliente_celular": cliente.celular or "",
                        "cliente_direccion": cliente.direccion or "",
                        "fecha_evento": orden.fecha_evento.isoformat() if orden.fecha_evento else "",
                        "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else "",
                        "fecha_devolucion": presupuesto.fecha_devolucion.isoformat() if presupuesto.fecha_devolucion else "",
                        "dias_retraso": dias_retraso,
                        "categoria_evento": presupuesto.categoria_evento or "",
                        "nombre_agasajado": presupuesto.nombre_agasajado or "",
                        "lugar_evento": presupuesto.lugar_evento or "",
                        "estado": orden.estado,
                        "total": float(presupuesto.total),
                        "seña_pagada": float(orden.seña_pagada),
                        "saldo_pendiente": float(orden.saldo_pendiente),
                        "productos": productos,
                        "cantidad_productos": len(productos),
                        "cantidad_total_items": sum(item.cantidad for item in presupuesto.items)
                    }

                    resultado.append(orden_info)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            # Ordenar por días de retraso descendente (más retraso primero)
            resultado.sort(key=lambda x: x["dias_retraso"], reverse=True)

            print(f"🔍 DEBUG: Órdenes procesadas: {len(resultado)}")

            return resultado

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener no devolvieron: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener no devolvieron: {str(e)}")

    @db_session
    def obtener_productos_criticos(
        self,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener productos críticos (alquilados más de 10 veces).
        Estos productos están para cambio o venta por desgaste.
        
        Args:
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada producto crítico
        """
        try:
            # Obtener todos los productos con veces_alquilado > 10
            productos_query = Producto.select(lambda p: p.veces_alquilado > 10)
            
            # Si se especifica sucursal, filtrar por sucursal
            if sucursal_id:
                productos_query = Producto.select(
                    lambda p: p.veces_alquilado > 10 and p.sucursal.id == sucursal_id
                )
            
            productos = list(productos_query)
            
            # Ordenar por veces_alquilado descendente
            productos.sort(key=lambda p: p.veces_alquilado, reverse=True)
            
            # Construir lista de resultados
            resultados = []
            for producto in productos:
                resultados.append({
                    "producto_id": producto.id,
                    "codigo_barra": producto.codigo_barra,
                    "descripcion": format_descripcion_producto(
                        producto.descripcion, producto.descripcion_extra
                    ),
                    "linea": (producto.linea.nombre if producto.linea else None),
                    "talle": (producto.talle.nombre if producto.talle else None),
                    "color": (producto.color.nombre if producto.color else None),
                    "tela": (producto.tela.nombre if producto.tela else None),
                    "estado": producto.estado.value if hasattr(producto.estado, 'value') else str(producto.estado),
                    "sucursal_id": producto.sucursal.id,
                    "sucursal_nombre": producto.sucursal.nombre,
                    "veces_alquilado": producto.veces_alquilado,
                    "stock": producto.stock,
                    "fecha_alta": producto.fecha_alta.isoformat() if producto.fecha_alta else None,
                    "precio_venta_medio_uso": producto.precio_de_venta_medio_uso,
                    "precio_liquidacion": producto.precio_liquidacion,
                })
            
            return resultados
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener productos críticos: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener productos críticos: {str(e)}")

    @db_session
    def obtener_productos_criticos_armado(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        sucursal_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Obtener productos críticos para el armado semanal.
        Lista productos que no están disponibles para el armado semanal (en lavandería, modista, cliente)
        y que se necesitan para órdenes de trabajo en el rango de fechas seleccionado.
        
        Args:
            fecha_desde: Fecha inicial del rango (filtra por fecha_evento de la orden)
            fecha_hasta: Fecha final del rango
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
        
        Returns:
            Lista de diccionarios con información de cada producto crítico y la orden que lo necesita
        """
        try:
            print(f"🔍 DEBUG: Obteniendo productos críticos para armado semanal, sucursal_id={sucursal_id}, fecha_desde={fecha_desde}, fecha_hasta={fecha_hasta}")

            # Obtener todas las órdenes de trabajo y filtrar en Python
            todas_ordenes = list(OrdenTrabajo.select())
            print(f"🔍 DEBUG: Total órdenes en BD: {len(todas_ordenes)}")

            # Filtrar órdenes con fecha_evento en el rango de fechas
            ordenes_filtradas = []
            for orden in todas_ordenes:
                try:
                    # Verificar que tenga presupuesto y cliente
                    if not orden.presupuesto or not orden.presupuesto.cliente:
                        continue

                    # Filtrar por fecha_evento (fecha de entrega)
                    if not orden.fecha_evento:
                        continue
                    
                    if orden.fecha_evento < fecha_desde or orden.fecha_evento > fecha_hasta:
                        continue

                    # Filtrar por sucursal (basado en productos del presupuesto)
                    if sucursal_id:
                        tiene_producto_sucursal = False
                        try:
                            for item in orden.presupuesto.items:
                                if item.producto and item.producto.sucursal and item.producto.sucursal.id == sucursal_id:
                                    tiene_producto_sucursal = True
                                    break
                        except Exception as e:
                            print(f"⚠️ Error al verificar sucursal en orden {orden.id}: {e}")
                            continue
                        
                        if not tiene_producto_sucursal:
                            continue

                    # Solo incluir órdenes que no estén canceladas
                    if orden.estado and orden.estado.lower() == "cancelada":
                        continue

                    ordenes_filtradas.append(orden)
                except Exception as e:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Órdenes filtradas: {len(ordenes_filtradas)}")

            # Obtener todos los productos en lavandería y modista (sin fecha_salida)
            productos_lavanderia = list(ProductoLavanderia.select(lambda pl: pl.fecha_salida is None))
            productos_modista = list(ProductoModista.select(lambda pm: pm.fecha_salida is None))
            
            # Crear sets para búsqueda rápida
            productos_en_lavanderia = {pl.producto.id for pl in productos_lavanderia}
            productos_en_modista = {pm.producto.id for pm in productos_modista}
            
            # Diccionario para almacenar información de lavandería y modista por producto
            info_lavanderia = {}
            for pl in productos_lavanderia:
                info_lavanderia[pl.producto.id] = {
                    "lavanderia_nombre": pl.lavanderia.nombre if pl.lavanderia else "N/A",
                    "fecha_ingreso": pl.fecha_ingreso.isoformat() if pl.fecha_ingreso else None,
                    "notas": pl.notas or ""
                }
            
            info_modista = {}
            for pm in productos_modista:
                info_modista[pm.producto.id] = {
                    "modista_nombre": pm.modista.nombre if pm.modista else "N/A",
                    "fecha_ingreso": pm.fecha_ingreso.isoformat() if pm.fecha_ingreso else None,
                    "notas": pm.notas or ""
                }

            # Construir la lista de productos críticos
            productos_criticos = []
            productos_vistos = set()  # Para evitar duplicados

            for orden in ordenes_filtradas:
                try:
                    cliente = orden.presupuesto.cliente
                    presupuesto = orden.presupuesto

                    # Obtener productos reservados de la orden
                    productos_reservados = list(ProductoReservado.select(lambda pr: pr.orden_trabajo.id == orden.id))
                    
                    # Si no hay productos reservados, usar los items del presupuesto
                    if not productos_reservados:
                        productos_a_verificar = presupuesto.items
                    else:
                        productos_a_verificar = [pr.producto for pr in productos_reservados]

                    for item_or_producto in productos_a_verificar:
                        try:
                            # Obtener el producto
                            if hasattr(item_or_producto, 'producto'):
                                # Es un ItemPresupuesto
                                producto = item_or_producto.producto
                            else:
                                # Es un Producto directamente
                                producto = item_or_producto

                            if not producto:
                                continue

                            # Verificar si el producto es crítico (no está en SALON)
                            es_critico = False
                            motivo_critico = ""
                            ubicacion_actual = ""

                            # Verificar estado del producto
                            estado_producto = producto.estado.value if hasattr(producto.estado, 'value') else str(producto.estado)
                            
                            if estado_producto != "SALON":
                                es_critico = True
                                if estado_producto == "LAVANDERIA":
                                    motivo_critico = "En lavandería"
                                    ubicacion_actual = info_lavanderia.get(producto.id, {}).get("lavanderia_nombre", "N/A")
                                elif estado_producto == "MODISTA":
                                    motivo_critico = "En modista"
                                    ubicacion_actual = info_modista.get(producto.id, {}).get("modista_nombre", "N/A")
                                elif estado_producto == "CLIENTE":
                                    motivo_critico = "En poder del cliente"
                                    ubicacion_actual = "Cliente"
                                else:
                                    motivo_critico = f"Estado: {estado_producto}"
                                    ubicacion_actual = estado_producto
                            
                            # También verificar si está en lavandería o modista aunque el estado no lo refleje
                            if producto.id in productos_en_lavanderia:
                                es_critico = True
                                motivo_critico = "En lavandería"
                                ubicacion_actual = info_lavanderia.get(producto.id, {}).get("lavanderia_nombre", "N/A")
                            
                            if producto.id in productos_en_modista:
                                es_critico = True
                                motivo_critico = "En modista"
                                ubicacion_actual = info_modista.get(producto.id, {}).get("modista_nombre", "N/A")

                            # Solo agregar si es crítico
                            if es_critico:
                                # Crear clave única para evitar duplicados
                                clave_unica = f"{producto.id}_{orden.id}"
                                
                                if clave_unica not in productos_vistos:
                                    productos_vistos.add(clave_unica)
                                    
                                    # Obtener información adicional
                                    fecha_ingreso_lavanderia = None
                                    fecha_ingreso_modista = None
                                    notas_lavanderia = ""
                                    notas_modista = ""
                                    
                                    if producto.id in info_lavanderia:
                                        fecha_ingreso_lavanderia = info_lavanderia[producto.id].get("fecha_ingreso")
                                        notas_lavanderia = info_lavanderia[producto.id].get("notas", "")
                                    
                                    if producto.id in info_modista:
                                        fecha_ingreso_modista = info_modista[producto.id].get("fecha_ingreso")
                                        notas_modista = info_modista[producto.id].get("notas", "")

                                    producto_critico = {
                                        "producto_id": producto.id,
                                        "codigo_barra": producto.codigo_barra,
                                        "descripcion": format_descripcion_producto(
                                            producto.descripcion, producto.descripcion_extra
                                        ),
                                        "linea": (producto.linea.nombre if producto.linea else None),
                                        "talle": (producto.talle.nombre if producto.talle else None),
                                        "color": (producto.color.nombre if producto.color else None),
                                        "tela": (producto.tela.nombre if producto.tela else None),
                                        "estado": estado_producto,
                                        "motivo_critico": motivo_critico,
                                        "ubicacion_actual": ubicacion_actual,
                                        "fecha_ingreso_lavanderia": fecha_ingreso_lavanderia,
                                        "fecha_ingreso_modista": fecha_ingreso_modista,
                                        "notas_lavanderia": notas_lavanderia,
                                        "notas_modista": notas_modista,
                                        "sucursal_id": producto.sucursal.id if producto.sucursal else None,
                                        "sucursal_nombre": producto.sucursal.nombre if producto.sucursal else "N/A",
                                        # Información de la orden que lo necesita
                                        "orden_id": orden.id,
                                        "presupuesto_id": presupuesto.id,
                                        "presupuesto_numero": f"ID-{orden.id}",
                                        "contrato_id": orden.id,
                                        "cliente_id": cliente.id,
                                        "cliente_nombre": f"{cliente.nombre} {cliente.apellido}",
                                        "cliente_dni": cliente.dni or "",
                                        "cliente_celular": cliente.celular or "",
                                        "fecha_evento": orden.fecha_evento.isoformat() if orden.fecha_evento else "",
                                        "fecha_retiro": presupuesto.fecha_retiro.isoformat() if presupuesto.fecha_retiro else "",
                                        "categoria_evento": presupuesto.categoria_evento or "",
                                        "nombre_agasajado": presupuesto.nombre_agasajado or "",
                                    }

                                    productos_criticos.append(producto_critico)
                        except Exception as item_error:
                            print(f"⚠️ Error al procesar producto en orden {orden.id}: {item_error}")
                            continue
                except Exception as orden_error:
                    print(f"⚠️ Error al procesar orden {orden.id if hasattr(orden, 'id') else 'N/A'}: {orden_error}")
                    continue

            # Ordenar por fecha_evento ascendente (más urgente primero)
            productos_criticos.sort(key=lambda x: x["fecha_evento"])

            print(f"🔍 DEBUG: Productos críticos encontrados: {len(productos_criticos)}")

            return productos_criticos

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener productos críticos para armado: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener productos críticos para armado: {str(e)}")

    @db_session
    def obtener_historico_producto(
        self,
        codigo_barra: str,
        fecha_hasta: Optional[date] = None,
        sucursal_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict:
        """
        Obtener histórico completo (trazabilidad) de un producto desde su ingreso al stock hasta una fecha determinada.
        Incluye: ingreso, alquileres, lavandería, modista, ventas, cambios de estado.
        
        Args:
            codigo_barra: Código de barras del producto
            fecha_hasta: Fecha hasta la cual se busca el histórico (default: fecha actual)
            sucursal_id: ID de la sucursal (opcional, si es None busca en todas)
            page: Página 1-based
            page_size: Tamaño de página (máx. 10); eventos más recientes primero
        
        Returns:
            Diccionario con producto, eventos de la página, resumen global y paginación
        """
        try:
            from datetime import date as date_type
            if fecha_hasta is None:
                fecha_hasta = date_type.today()
            
            print(f"🔍 DEBUG: Obteniendo histórico de producto {codigo_barra}, fecha_hasta={fecha_hasta}, sucursal_id={sucursal_id}")

            # Buscar el producto por código de barras
            producto = Producto.get(codigo_barra=codigo_barra)
            
            if not producto:
                raise HTTPException(status_code=404, detail=f"Producto con código de barras {codigo_barra} no encontrado")
            
            # Filtrar por sucursal si se especifica
            if sucursal_id and producto.sucursal.id != sucursal_id:
                raise HTTPException(status_code=403, detail="El producto no pertenece a la sucursal especificada")
            
            # Lista de eventos cronológicos
            eventos = []

            def extraer_orden_ref(*textos) -> Optional[int]:
                for txt in textos:
                    if not txt:
                        continue
                    m = re.search(r"orden\s*#?\s*(\d+)", str(txt), flags=re.IGNORECASE)
                    if m:
                        return int(m.group(1))
                return None

            def extraer_seq_remito(*textos) -> Optional[int]:
                # Ej: REM-65-20260414121107-1 -> 20260414121107
                for txt in textos:
                    if not txt:
                        continue
                    m = re.search(r"REM-[^-]+-(\d{14})", str(txt), flags=re.IGNORECASE)
                    if m:
                        try:
                            return int(m.group(1))
                        except Exception:
                            return None
                return None
            
            # 1. Evento de ingreso al stock
            if producto.fecha_alta and producto.fecha_alta <= fecha_hasta:
                suc_nom = producto.sucursal.nombre if producto.sucursal else "N/A"
                eventos.append({
                    "tipo": "ingreso",
                    "fecha": producto.fecha_alta.isoformat(),
                    "fecha_datetime": datetime.combine(producto.fecha_alta, datetime.min.time()),
                    "descripcion": "Ingreso al stock",
                    "detalle": f"Producto ingresado al sistema en sucursal {suc_nom}",
                    "estado": producto.estado.value if hasattr(producto.estado, 'value') else str(producto.estado),
                    "sucursal": suc_nom,
                })
            
            # 2. Alquileres (órdenes de trabajo): por ítems de presupuesto asociados al producto.
            # Tras devolución completada suele borrarse ProductoReservado; el presupuesto/orden queda.
            # Filtrar en Python para evitar inconsistencias del traductor SQL de Pony
            # con comparaciones de FK en algunos entornos.
            items_presupuesto = [
                ip for ip in list(ItemPresupuesto.select())
                if getattr(ip, "producto", None) and ip.producto.id == producto.id
            ]
            ordenes_alquiler_vistas = set()
            for ip in items_presupuesto:
                presupuesto = ip.presupuesto
                if not presupuesto:
                    continue
                orden = presupuesto.orden_trabajo
                if not orden or not orden.fecha_evento:
                    continue
                # Contar alquileres reales: cuando pasa a CLIENTE (contrato)
                # o cuando la orden quedó cerrada como completada/entregada.
                estado_orden = str(getattr(orden, "estado", "") or "").strip().lower()
                tuvo_paso_cliente = bool(getattr(orden, "contrato_generado_at", None))
                orden_cerrada = estado_orden in {"completada", "entregada"}
                if not (tuvo_paso_cliente or orden_cerrada):
                    continue
                fecha_alquiler_dt = (
                    orden.contrato_generado_at
                    if getattr(orden, "contrato_generado_at", None)
                    else datetime.combine(orden.fecha_evento, datetime.min.time())
                )
                if orden.id in ordenes_alquiler_vistas:
                    continue
                if fecha_alquiler_dt.date() > fecha_hasta:
                    continue
                ordenes_alquiler_vistas.add(orden.id)

                pc = getattr(presupuesto, "precliente", None)
                cli = getattr(presupuesto, "cliente", None)
                if pc is not None:
                    nombre_titular = (
                        f"{getattr(pc, 'apellido', '') or ''} {getattr(pc, 'nombre', '') or ''}".strip()
                        or "N/A"
                    )
                elif cli is not None:
                    nombre_titular = (
                        f"{getattr(cli, 'apellido', '') or ''} {getattr(cli, 'nombre', '') or ''}".strip()
                        or "N/A"
                    )
                else:
                    nombre_titular = "N/A"

                pr_actual = ProductoReservado.get(
                    producto=producto, orden_trabajo=orden
                )
                eventos.append({
                    "tipo": "alquiler",
                    "fecha": fecha_alquiler_dt.date().isoformat(),
                    "fecha_datetime": fecha_alquiler_dt,
                    "_orden_ref": orden.id,
                    "_fase": 0,
                    "_ent_id": orden.id,
                    "descripcion": f"Alquilado - Orden #{orden.id}",
                    "detalle": f"Cliente: {nombre_titular} - Evento: {(presupuesto.categoria_evento if presupuesto else None) or 'N/A'} - Estado orden: {orden.estado}",
                    "cliente_nombre": nombre_titular,
                    "orden_id": orden.id,
                    "presupuesto_numero": presupuesto.numero if presupuesto else "N/A",
                    "estado_reserva": pr_actual.estado if pr_actual else None,
                    "fecha_evento": orden.fecha_evento.isoformat(),
                    "fecha_contrato": orden.contrato_generado_at.isoformat(),
                })
            
            # 3. Lavandería
            productos_lavanderia = [
                pl for pl in list(ProductoLavanderia.select())
                if getattr(pl, "producto", None) and pl.producto.id == producto.id
            ]
            
            for pl in productos_lavanderia:
                lav_nombre = pl.lavanderia.nombre if pl.lavanderia else "N/A"
                orden_ref = extraer_orden_ref(pl.notas)
                seq_remito = extraer_seq_remito(pl.notas)
                if pl.fecha_ingreso and pl.fecha_ingreso <= fecha_hasta:
                    eventos.append({
                        "tipo": "lavanderia_ingreso",
                        "fecha": pl.fecha_ingreso.isoformat(),
                        "fecha_datetime": datetime.combine(pl.fecha_ingreso, datetime.min.time()),
                        "_orden_ref": orden_ref,
                        "_fase": 1,
                        "_ent_id": pl.id,
                        "_seq_hint": seq_remito,
                        "descripcion": f"Ingreso a lavandería: {lav_nombre}",
                        "detalle": f"Producto enviado a lavandería - Notas: {pl.notas or 'Sin notas'}",
                        "lavanderia_nombre": lav_nombre,
                        "notas": pl.notas or ""
                    })
                
                if pl.fecha_salida and pl.fecha_salida <= fecha_hasta:
                    eventos.append({
                        "tipo": "lavanderia_salida",
                        "fecha": pl.fecha_salida.isoformat(),
                        "fecha_datetime": datetime.combine(pl.fecha_salida, datetime.min.time()),
                        "_orden_ref": orden_ref,
                        "_fase": 2,
                        "_ent_id": pl.id,
                        "_seq_hint": seq_remito,
                        "descripcion": f"Salida de lavandería: {lav_nombre}",
                        "detalle": f"Producto regresado de lavandería",
                        "lavanderia_nombre": lav_nombre
                    })
            
            # 4. Modista
            productos_modista = [
                pm for pm in list(ProductoModista.select())
                if getattr(pm, "producto", None) and pm.producto.id == producto.id
            ]
            
            for pm in productos_modista:
                mod_nombre = pm.modista.nombre if pm.modista else "N/A"
                orden_ref = extraer_orden_ref(pm.notas)
                seq_remito = extraer_seq_remito(pm.notas)
                if pm.fecha_ingreso and pm.fecha_ingreso <= fecha_hasta:
                    eventos.append({
                        "tipo": "modista_ingreso",
                        "fecha": pm.fecha_ingreso.isoformat(),
                        "fecha_datetime": datetime.combine(pm.fecha_ingreso, datetime.min.time()),
                        "_orden_ref": orden_ref,
                        "_fase": 1,
                        "_ent_id": pm.id,
                        "_seq_hint": seq_remito,
                        "descripcion": f"Ingreso a modista: {mod_nombre}",
                        "detalle": f"Producto enviado a modista - Notas: {pm.notas or 'Sin notas'}",
                        "modista_nombre": mod_nombre,
                        "notas": pm.notas or ""
                    })
                
                if pm.fecha_salida and pm.fecha_salida <= fecha_hasta:
                    eventos.append({
                        "tipo": "modista_salida",
                        "fecha": pm.fecha_salida.isoformat(),
                        "fecha_datetime": datetime.combine(pm.fecha_salida, datetime.min.time()),
                        "_orden_ref": orden_ref,
                        "_fase": 2,
                        "_ent_id": pm.id,
                        "_seq_hint": seq_remito,
                        "descripcion": f"Salida de modista: {mod_nombre}",
                        "detalle": f"Producto regresado de modista",
                        "modista_nombre": mod_nombre
                    })
            
            # 5. Ventas
            detalles_venta = list(DetalleVenta.select(
                lambda dv: dv.producto.id == producto.id
            ))
            
            for dv in detalles_venta:
                venta = dv.venta
                if not venta or not venta.fecha:
                    continue
                
                if venta.fecha > fecha_hasta:
                    continue
                
                cliente = getattr(venta, "cliente", None)
                if cliente is not None:
                    cli_txt = f"{getattr(cliente, 'nombre', '') or ''} {getattr(cliente, 'apellido', '') or ''}".strip() or "N/A"
                else:
                    cli_txt = "N/A"
                eventos.append({
                    "tipo": "venta",
                    "fecha": venta.fecha.isoformat(),
                    "fecha_datetime": datetime.combine(venta.fecha, venta.fecha_hora.time() if hasattr(venta, 'fecha_hora') else datetime.min.time()),
                    "descripcion": f"Vendido - Venta #{venta.id}",
                    "detalle": f"Cliente: {cli_txt} - Cantidad: {dv.cantidad} - Precio unitario: ${dv.precio_unitario:,.2f} - Subtotal: ${dv.subtotal:,.2f}",
                    "cliente_nombre": cli_txt,
                    "venta_id": venta.id,
                    "cantidad": dv.cantidad,
                    "precio_unitario": float(dv.precio_unitario),
                    "subtotal": float(dv.subtotal),
                    "tipo_precio": venta.tipo_precio
                })
            
            # Más reciente primero y, dentro del mismo día, intercalar por orden:
            # alquiler -> ingreso taller -> salida taller.
            # Ordenar ciclos por secuencia real de remito cuando exista.
            orden_seq = {}
            for ev in eventos:
                oref = ev.get("_orden_ref")
                if not oref:
                    continue
                seq_hint = ev.get("_seq_hint")
                if seq_hint is None:
                    continue
                prev = orden_seq.get(oref)
                if prev is None or seq_hint < prev:
                    orden_seq[oref] = seq_hint

            # Timeline descendente (lo último primero):
            # dentro de un mismo ciclo/fecha, mostrar salida -> ingreso -> alquiler.
            fase_desc_rank = {2: 0, 1: 1, 0: 2}
            eventos.sort(
                key=lambda x: (
                    -x["fecha_datetime"].date().toordinal(),            # días recientes primero
                    -orden_seq.get(x.get("_orden_ref"), -1),            # ciclo más nuevo primero
                    fase_desc_rank.get(x.get("_fase", 9), 9),           # salida -> ingreso -> alquiler
                    -(x.get("_ent_id", 0) or 0),                        # estabilidad
                    x["fecha_datetime"],
                )
            )

            total_eventos = len(eventos)
            ps = max(1, min(int(page_size or 10), 10))
            total_pages = max(1, (total_eventos + ps - 1) // ps) if total_eventos else 1
            pg = min(max(1, int(page or 1)), total_pages)
            start = (pg - 1) * ps
            eventos_pagina = eventos[start : start + ps]
            for ev in eventos_pagina:
                ev.pop("fecha_datetime", None)
                ev.pop("_orden_ref", None)
                ev.pop("_fase", None)
                ev.pop("_ent_id", None)
                ev.pop("_seq_hint", None)
            
            # Información del producto
            producto_info = {
                "producto_id": producto.id,
                "codigo_barra": producto.codigo_barra,
                "descripcion": format_descripcion_producto(
                    producto.descripcion, producto.descripcion_extra
                ),
                "linea": (producto.linea.nombre if producto.linea else None),
                "talle": (producto.talle.nombre if producto.talle else None),
                "color": (producto.color.nombre if producto.color else None),
                "tela": (producto.tela.nombre if producto.tela else None),
                "estado_actual": producto.estado.value if hasattr(producto.estado, 'value') else str(producto.estado),
                "sucursal_id": producto.sucursal.id if producto.sucursal else None,
                "sucursal_nombre": producto.sucursal.nombre if producto.sucursal else None,
                "fecha_alta": producto.fecha_alta.isoformat() if producto.fecha_alta else None,
                "veces_alquilado": len(ordenes_alquiler_vistas),
                "stock": producto.stock,
                "inmovilizado": producto.inmovilizado
            }
            
            # Resumen: lavandería y modista = solo ingresos (no salidas).
            resumen = {
                "total_alquileres": len([e for e in eventos if e["tipo"] == "alquiler"]),
                "total_ventas": len([e for e in eventos if e["tipo"] == "venta"]),
                "total_lavanderia": len([e for e in eventos if e["tipo"] == "lavanderia_ingreso"]),
                "total_modista": len([e for e in eventos if e["tipo"] == "modista_ingreso"]),
            }
            
            print(f"🔍 DEBUG: Histórico generado con {total_eventos} eventos (página {pg}/{total_pages})")
            
            return {
                "producto": producto_info,
                "eventos": eventos_pagina,
                "resumen": resumen,
                "paginacion": {
                    "page": pg,
                    "page_size": ps,
                    "total": total_eventos,
                    "total_pages": total_pages,
                    "has_prev": pg > 1,
                    "has_next": pg < total_pages,
                },
                "fecha_hasta": fecha_hasta.isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener histórico de producto: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener histórico de producto: {str(e)}")

