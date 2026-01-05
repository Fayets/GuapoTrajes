from pony.orm import db_session
from datetime import date, timedelta
from src.models import ItemPresupuesto, Presupuesto, ProductoReservado

@db_session
def verificar_disponibilidad(producto_id: int, fecha_retiro: date, fecha_devolucion: date, presupuesto_excluir_id: int = None) -> bool:
    """
    Verifica si un producto está disponible en las fechas indicadas.
    
    Args:
        producto_id: ID del producto a verificar
        fecha_retiro: Fecha de retiro del producto
        fecha_devolucion: Fecha de devolución del producto
        presupuesto_excluir_id: ID del presupuesto a excluir de la verificación (útil al editar)
    
    Returns:
        True si el producto está disponible, False si está ocupado
    """
    try:
        # 1. Verificar presupuestos (pendientes y aprobados) que usen este producto
        todos_presupuestos = list(Presupuesto.select())
        
        for presupuesto in todos_presupuestos:
            # Excluir el presupuesto que se está editando
            if presupuesto_excluir_id and presupuesto.id == presupuesto_excluir_id:
                continue
            
            # Solo verificar presupuestos pendientes y aprobados (excluir cancelados, rechazados, vencidos, etc.)
            if presupuesto.estado.lower() not in ["pendiente", "aprobado"]:
                continue
            
            # Si el presupuesto está "aprobado" pero no tiene orden activa, no bloquea
            # (esto puede pasar si se eliminó la orden pero el estado no se actualizó)
            if presupuesto.estado.lower() == "aprobado" and not presupuesto.orden_trabajo:
                continue
            
            # Verificar si este presupuesto tiene el producto
            items_producto = list(presupuesto.items.select(lambda ip: ip.producto.id == producto_id))
            
            if items_producto:
                # Calcular rango de fechas del presupuesto
                fecha_inicio = presupuesto.fecha_evento
                fecha_fin = presupuesto.fecha_devolucion or presupuesto.fecha_evento
                
                # Si hay solapamiento, el producto no está disponible
                # Solapamiento: fecha_inicio <= fecha_devolucion AND fecha_fin >= fecha_retiro
                if fecha_inicio <= fecha_devolucion and fecha_fin >= fecha_retiro:
                    return False
        
        # 2. Verificar órdenes de trabajo (ProductoReservado)
        productos_reservados = list(ProductoReservado.select(lambda pr: pr.producto.id == producto_id))
        
        for producto_reservado in productos_reservados:
            orden = producto_reservado.orden_trabajo
            if not orden:
                continue
            
            # Calcular el rango de fechas bloqueadas
            # La fecha_bloqueo es fecha_evento - 5 días
            # El bloqueo termina cuando se devuelve el producto (fecha_evento)
            fecha_bloqueo_inicio = producto_reservado.fecha_bloqueo
            fecha_bloqueo_fin = orden.fecha_evento
            
            # Verificar solapamiento con las fechas solicitadas
            if fecha_bloqueo_inicio <= fecha_devolucion and fecha_bloqueo_fin >= fecha_retiro:
                return False
        
        return True
    except Exception as e:
        print(f"Error en verificar_disponibilidad: {e}")
        import traceback
        traceback.print_exc()
        # En caso de error, asumir que está disponible para no bloquear operaciones
        return True
