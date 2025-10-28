from pony.orm import db_session
from datetime import date
from src.models import ItemPresupuesto, Presupuesto

@db_session
def verificar_disponibilidad(producto_id: int, fecha_retiro: date, fecha_devolucion: date) -> bool:
    try:
        # Buscar presupuestos aprobados que usen este producto
        presupuestos_aprobados = list(Presupuesto.select(lambda p: p.estado == "aprobado"))
        
        for presupuesto in presupuestos_aprobados:
            # Verificar si este presupuesto tiene el producto
            items_producto = list(presupuesto.items.select(lambda ip: ip.producto.id == producto_id))
            
            if items_producto:
                # Verificar si las fechas se solapan
                fecha_inicio = presupuesto.fecha_evento
                fecha_fin = presupuesto.fecha_devolucion or presupuesto.fecha_evento
                
                # Si hay solapamiento, el producto no está disponible
                if fecha_inicio <= fecha_devolucion and fecha_fin >= fecha_retiro:
                    return False
        
        return True
    except Exception as e:
        print(f"Error en verificar_disponibilidad: {e}")
        # En caso de error, asumir que está disponible
        return True
