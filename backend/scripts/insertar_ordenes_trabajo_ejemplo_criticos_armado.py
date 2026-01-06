"""
Script para insertar órdenes de trabajo de ejemplo para probar el reporte
"Productos críticos para armado" con fechas entre 01/01/2026 y 31/01/2026
"""
import sys
import os
from datetime import date, datetime, timedelta

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pony.orm import db_session, commit
from src.models import (
    db, Presupuesto, OrdenTrabajo, ItemPresupuesto, 
    Producto, Cliente, Sucursal, ProductoReservado, EstadoProducto,
    ProductoLavanderia, ProductoModista, Lavanderia, Modista
)

# Inicializar la base de datos
from src.db import db as database
database.generate_mapping(create_tables=False)

@db_session
def insertar_datos_prueba():
    """Inserta datos de prueba para el reporte Productos críticos para armado"""
    
    # Obtener IDs de clientes (asumimos que existen)
    cliente_id_1 = 1
    cliente_id_2 = 2
    
    # Verificar que los clientes existen
    cliente1 = Cliente.get(id=cliente_id_1)
    cliente2 = Cliente.get(id=cliente_id_2)
    
    if not cliente1:
        print(f"ERROR: Cliente con ID {cliente_id_1} no encontrado")
        return
    
    if not cliente2:
        print(f"ERROR: Cliente con ID {cliente_id_2} no encontrado")
        return
    
    print(f"OK: Cliente 1 encontrado: {cliente1.nombre} {cliente1.apellido}")
    print(f"OK: Cliente 2 encontrado: {cliente2.nombre} {cliente2.apellido}")
    
    # Obtener productos existentes (necesitamos al menos 3)
    productos = list(Producto.select()[:5])
    
    if len(productos) < 3:
        print("ERROR: Se necesitan al menos 3 productos en la base de datos")
        print(f"   Productos encontrados: {len(productos)}")
        return
    
    producto1 = productos[0]
    producto2 = productos[1] if len(productos) > 1 else productos[0]
    producto3 = productos[2] if len(productos) > 2 else productos[0]
    
    print(f"OK: Producto 1: {producto1.codigo_barra} - {producto1.descripcion}")
    print(f"OK: Producto 2: {producto2.codigo_barra} - {producto2.descripcion}")
    print(f"OK: Producto 3: {producto3.codigo_barra} - {producto3.descripcion}")
    
    # Obtener sucursal del primer producto
    sucursal = producto1.sucursal
    print(f"OK: Sucursal: {sucursal.nombre}")
    
    # Obtener o crear lavandería y modista
    lavanderia = list(Lavanderia.select()[:1])
    if lavanderia:
        lavanderia = lavanderia[0]
    else:
        lavanderia = Lavanderia(nombre="Lavandería Ejemplo", telefono="123456789", direccion="Calle Ejemplo 123")
        commit()
        print("OK: Lavandería creada")
    
    modista = list(Modista.select()[:1])
    if modista:
        modista = modista[0]
    else:
        modista = Modista(nombre="Modista Ejemplo", telefono="987654321", direccion="Avenida Ejemplo 456")
        commit()
        print("OK: Modista creada")
    
    # Verificar si ya existen presupuestos de prueba
    presupuesto_test_1 = Presupuesto.get(numero='PRES-CRIT-001')
    if presupuesto_test_1:
        print("ADVERTENCIA: El presupuesto PRES-CRIT-001 ya existe. Eliminando datos de prueba anteriores...")
        if presupuesto_test_1.orden_trabajo:
            # Eliminar productos reservados
            for pr in list(presupuesto_test_1.orden_trabajo.productos_reservados):
                pr.delete()
            presupuesto_test_1.orden_trabajo.delete()
        for item in list(presupuesto_test_1.items):
            item.delete()
        presupuesto_test_1.delete()
        commit()
    
    presupuesto_test_2 = Presupuesto.get(numero='PRES-CRIT-002')
    if presupuesto_test_2:
        print("ADVERTENCIA: El presupuesto PRES-CRIT-002 ya existe. Eliminando datos de prueba anteriores...")
        if presupuesto_test_2.orden_trabajo:
            # Eliminar productos reservados
            for pr in list(presupuesto_test_2.orden_trabajo.productos_reservados):
                pr.delete()
            presupuesto_test_2.orden_trabajo.delete()
        for item in list(presupuesto_test_2.items):
            item.delete()
        presupuesto_test_2.delete()
        commit()
    
    # Fechas para enero 2026
    fecha_evento_1 = date(2026, 1, 15)  # 15 de enero
    fecha_retiro_1 = date(2026, 1, 14)
    fecha_devolucion_1 = date(2026, 1, 20)
    
    fecha_evento_2 = date(2026, 1, 25)  # 25 de enero
    fecha_retiro_2 = date(2026, 1, 24)
    fecha_devolucion_2 = date(2026, 1, 30)
    
    # ============================================
    # ORDEN 1: Producto en lavandería
    # ============================================
    print("\nCreando Orden 1 (producto en lavandería)...")
    
    # Marcar producto1 como en lavandería
    producto1.estado = EstadoProducto.LAVANDERIA
    producto_lavanderia = ProductoLavanderia(
        producto=producto1,
        lavanderia=lavanderia,
        fecha_ingreso=date(2026, 1, 10),
        fecha_salida=None,  # Aún no ha salido
        notas="Producto en proceso de lavado"
    )
    commit()
    print(f"   OK: Producto {producto1.codigo_barra} marcado como en lavandería")
    
    # Crear Presupuesto 1
    presupuesto1 = Presupuesto(
        numero='PRES-CRIT-001',
        cliente=cliente1,
        fecha_evento=fecha_evento_1,
        fecha_retiro=fecha_retiro_1,
        fecha_devolucion=fecha_devolucion_1,
        fecha_creacion=datetime.now(),
        categoria_evento='Casamiento',
        nombre_agasajado='Carlos Rodríguez',
        lugar_evento='Salón Eventos Centro',
        total=50000.00,
        estado='aprobado'
    )
    commit()
    
    # Crear Items del Presupuesto 1
    precio_unitario_1 = 25000.00
    ItemPresupuesto(
        presupuesto=presupuesto1,
        producto=producto1,  # Este está en lavandería
        cantidad=1,
        precio_unitario=precio_unitario_1,
        subtotal=precio_unitario_1
    )
    
    ItemPresupuesto(
        presupuesto=presupuesto1,
        producto=producto2,
        cantidad=1,
        precio_unitario=precio_unitario_1,
        subtotal=precio_unitario_1
    )
    
    # Crear Orden de Trabajo 1
    orden1 = OrdenTrabajo(
        presupuesto=presupuesto1,
        fecha_creacion=datetime.now(),
        fecha_evento=fecha_evento_1,
        estado='pendiente',
        seña_pagada=20000.00,
        saldo_pendiente=30000.00,
        metodo_pago='EFECTIVO'
    )
    commit()
    
    # Crear Productos Reservados
    ProductoReservado(
        orden_trabajo=orden1,
        producto=producto1,
        estado='no disponible',  # Porque está en lavandería
        fecha_bloqueo=fecha_evento_1 - timedelta(days=5)
    )
    
    ProductoReservado(
        orden_trabajo=orden1,
        producto=producto2,
        estado='reservado',
        fecha_bloqueo=fecha_evento_1 - timedelta(days=5)
    )
    commit()
    
    print(f"   OK: Presupuesto {presupuesto1.numero} creado (ID: {presupuesto1.id})")
    print(f"   OK: Orden de Trabajo creada (ID: {orden1.id})")
    
    # ============================================
    # ORDEN 2: Producto en modista
    # ============================================
    print("\nCreando Orden 2 (producto en modista)...")
    
    # Marcar producto3 como en modista
    producto3.estado = EstadoProducto.MODISTA
    producto_modista = ProductoModista(
        producto=producto3,
        modista=modista,
        fecha_ingreso=date(2026, 1, 12),
        fecha_salida=None,  # Aún no ha salido
        notas="Producto en proceso de arreglo"
    )
    commit()
    print(f"   OK: Producto {producto3.codigo_barra} marcado como en modista")
    
    # Crear Presupuesto 2
    presupuesto2 = Presupuesto(
        numero='PRES-CRIT-002',
        cliente=cliente2,
        fecha_evento=fecha_evento_2,
        fecha_retiro=fecha_retiro_2,
        fecha_devolucion=fecha_devolucion_2,
        fecha_creacion=datetime.now(),
        categoria_evento='Cumpleaños',
        nombre_agasajado='Ana Martínez',
        lugar_evento='Salón Eventos Norte',
        total=75000.00,
        estado='aprobado'
    )
    commit()
    
    # Crear Items del Presupuesto 2
    precio_unitario_2 = 37500.00
    ItemPresupuesto(
        presupuesto=presupuesto2,
        producto=producto3,  # Este está en modista
        cantidad=1,
        precio_unitario=precio_unitario_2,
        subtotal=precio_unitario_2
    )
    
    ItemPresupuesto(
        presupuesto=presupuesto2,
        producto=producto2,
        cantidad=1,
        precio_unitario=precio_unitario_2,
        subtotal=precio_unitario_2
    )
    
    # Crear Orden de Trabajo 2
    orden2 = OrdenTrabajo(
        presupuesto=presupuesto2,
        fecha_creacion=datetime.now(),
        fecha_evento=fecha_evento_2,
        estado='pendiente',
        seña_pagada=30000.00,
        saldo_pendiente=45000.00,
        metodo_pago='DEBITO'
    )
    commit()
    
    # Crear Productos Reservados
    ProductoReservado(
        orden_trabajo=orden2,
        producto=producto3,
        estado='no disponible',  # Porque está en modista
        fecha_bloqueo=fecha_evento_2 - timedelta(days=5)
    )
    
    ProductoReservado(
        orden_trabajo=orden2,
        producto=producto2,
        estado='reservado',
        fecha_bloqueo=fecha_evento_2 - timedelta(days=5)
    )
    commit()
    
    print(f"   OK: Presupuesto {presupuesto2.numero} creado (ID: {presupuesto2.id})")
    print(f"   OK: Orden de Trabajo creada (ID: {orden2.id})")
    
    # ============================================
    # VERIFICACIÓN
    # ============================================
    print("\nDatos de prueba insertados correctamente!")
    print("\nResumen:")
    print(f"   Orden 1: {orden1.id} - Cliente: {cliente1.nombre} {cliente1.apellido}")
    print(f"            Fecha evento: {fecha_evento_1}")
    print(f"            Producto crítico: {producto1.codigo_barra} (en lavandería)")
    print(f"   Orden 2: {orden2.id} - Cliente: {cliente2.nombre} {cliente2.apellido}")
    print(f"            Fecha evento: {fecha_evento_2}")
    print(f"            Producto crítico: {producto3.codigo_barra} (en modista)")
    print("\nAhora puedes probar el reporte 'Productos críticos para armado'")
    print("   con fechas entre 01/01/2026 y 31/01/2026 en la interfaz web")

if __name__ == '__main__':
    try:
        insertar_datos_prueba()
    except Exception as e:
        print(f"ERROR al insertar datos: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

