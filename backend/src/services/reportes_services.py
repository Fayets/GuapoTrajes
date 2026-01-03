from pony.orm import db_session, select
from fastapi import HTTPException
from datetime import date, datetime
from typing import List, Dict, Optional
from src.models import Presupuesto, OrdenTrabajo, ItemPresupuesto, Producto, Cliente, CajaMovimiento, Venta, TipoMovimiento, EstadoProducto


class ReportesServices:
    def __init__(self):
        pass

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
                                    "descripcion": producto.descripcion or "N/A",
                                    "linea": producto.linea or "N/A",
                                    "talle": producto.talle or "N/A",
                                    "color": producto.color or "N/A",
                                    "tela": producto.tela or "N/A",
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
                        item["descripcion"] = producto.descripcion or "N/A"
                        item["linea"] = producto.linea or "N/A"
                        item["talle"] = producto.talle or "N/A"
                        item["color"] = producto.color or "N/A"
                        item["tela"] = producto.tela or "N/A"
                        item["sucursal_id"] = producto.sucursal.id if producto.sucursal else None
                        item["sucursal_nombre"] = producto.sucursal.nombre if producto.sucursal else "N/A"
                        if "fechas_alquiler" not in item:
                            item["fechas_alquiler"] = []
                    else:
                        # Si no tiene alquileres, crear entrada con valores en 0
                        item = {
                            "producto_id": producto_id,
                            "codigo_barra": producto.codigo_barra or "N/A",
                            "descripcion": producto.descripcion or "N/A",
                            "linea": producto.linea or "N/A",
                            "talle": producto.talle or "N/A",
                            "color": producto.color or "N/A",
                            "tela": producto.tela or "N/A",
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
                            if presupuesto.cliente:
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
                            if presupuesto.cliente:
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
                            "numero": presupuesto.numero,
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
                    
                    # Obtener método de pago (puede ser enum o string)
                    metodo_pago = "N/A"
                    try:
                        if movimiento.payment_method:
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
        sucursal_id: Optional[int] = None
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

                    ingresos.append(movimiento)
                except Exception as e:
                    print(f"⚠️ Error al procesar movimiento {movimiento.id if hasattr(movimiento, 'id') else 'N/A'}: {e}")
                    continue

            print(f"🔍 DEBUG: Ingresos encontrados: {len(ingresos)}")

            # Agrupar por método de pago
            ingresos_por_tipo = {}
            total_general = 0.0

            for ingreso in ingresos:
                try:
                    # Obtener método de pago (puede ser Enum o string)
                    metodo_pago = "SIN_METODO"
                    if ingreso.payment_method:
                        if hasattr(ingreso.payment_method, 'value'):
                            metodo_pago = ingreso.payment_method.value
                        else:
                            metodo_pago = str(ingreso.payment_method)

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
                except Exception as e:
                    print(f"⚠️ Error al procesar ingreso {ingreso.id if hasattr(ingreso, 'id') else 'N/A'}: {e}")
                    continue

            # Convertir a lista y ordenar por total descendente
            ingresos_lista = list(ingresos_por_tipo.values())
            ingresos_lista.sort(key=lambda x: x["total"], reverse=True)

            print(f"🔍 DEBUG: Tipos de pago encontrados: {len(ingresos_lista)}")

            return {
                "ingresos_por_tipo": ingresos_lista,
                "total_general": total_general,
                "cantidad_total": len(ingresos)
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error al obtener ingresos por tipo: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error al obtener ingresos por tipo: {str(e)}")

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
                        "descripcion": producto.descripcion,
                        "linea": producto.linea,
                        "talle": producto.talle,
                        "color": producto.color,
                        "tela": producto.tela,
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
                    linea = producto.linea or "SIN_LINEA"
                    
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

