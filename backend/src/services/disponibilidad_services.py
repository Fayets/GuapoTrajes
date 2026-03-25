from pony.orm import db_session
from datetime import date, timedelta
from src.models import Presupuesto, ProductoReservado

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

            tiene_producto = False
            for item in presupuesto.items:
                if item.producto.id == producto_id:
                    tiene_producto = True
                    break
            if tiene_producto:
                # Calcular rango de fechas del presupuesto
                fecha_inicio = presupuesto.fecha_evento
                fecha_fin = presupuesto.fecha_devolucion or presupuesto.fecha_evento

                # Si hay solapamiento, el producto no está disponible
                if fecha_inicio <= fecha_devolucion and fecha_fin >= fecha_retiro:
                    return False

        # 2. Órdenes de trabajo: ventana persistida [fecha_bloqueo, fecha_bloqueo+5] (= [R-5, R])
        for producto_reservado in ProductoReservado.select():
            if producto_reservado.producto.id != producto_id:
                continue
            orden = producto_reservado.orden_trabajo
            if not orden:
                continue

            fecha_bloqueo_inicio = producto_reservado.fecha_bloqueo
            fecha_bloqueo_fin = fecha_bloqueo_inicio + timedelta(days=5)

            if fecha_bloqueo_inicio <= fecha_devolucion and fecha_bloqueo_fin >= fecha_retiro:
                return False
        
        return True
    except Exception as e:
        print(f"Error en verificar_disponibilidad: {e}")
        import traceback
        traceback.print_exc()
        # En caso de error, asumir que está disponible para no bloquear operaciones
        return True
