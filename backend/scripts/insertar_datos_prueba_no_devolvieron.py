"""
Script para insertar datos de prueba del reporte "No devolvieron"
Este script crea 2 órdenes de trabajo con fechas de devolución pasadas
"""
import sys
import os
from datetime import date, datetime, timedelta

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pony.orm import db_session, commit
from src.models import (
    db, Presupuesto, OrdenTrabajo, ItemPresupuesto, 
    Producto, Cliente, Sucursal
)

# Inicializar la base de datos
from src.db import db as database
database.generate_mapping(create_tables=False)

@db_session
def insertar_datos_prueba():
    """Inserta datos de prueba para el reporte No devolvieron"""
    
    # Obtener IDs de clientes (el usuario indicó que son 1 y 2)
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
    
    # Obtener productos existentes (necesitamos al menos 2)
    productos = list(Producto.select()[:5])
    
    if len(productos) < 2:
        print("ERROR: Se necesitan al menos 2 productos en la base de datos")
        print(f"   Productos encontrados: {len(productos)}")
        return
    
    producto1 = productos[0]
    producto2 = productos[1] if len(productos) > 1 else productos[0]
    
    print(f"OK: Producto 1: {producto1.codigo_barra} - {producto1.descripcion}")
    print(f"OK: Producto 2: {producto2.codigo_barra} - {producto2.descripcion}")
    
    # Obtener sucursal del primer producto
    sucursal = producto1.sucursal
    print(f"OK: Sucursal: {sucursal.nombre}")
    
    # Verificar si ya existen presupuestos de prueba
    presupuesto_test_1 = Presupuesto.get(numero='PRES-TEST-001')
    if presupuesto_test_1:
        print("ADVERTENCIA: El presupuesto PRES-TEST-001 ya existe. Eliminando datos de prueba anteriores...")
        # Eliminar orden de trabajo si existe
        if presupuesto_test_1.orden_trabajo:
            presupuesto_test_1.orden_trabajo.delete()
        # Eliminar items
        for item in list(presupuesto_test_1.items):
            item.delete()
        presupuesto_test_1.delete()
        commit()
    
    presupuesto_test_2 = Presupuesto.get(numero='PRES-TEST-002')
    if presupuesto_test_2:
        print("ADVERTENCIA: El presupuesto PRES-TEST-002 ya existe. Eliminando datos de prueba anteriores...")
        # Eliminar orden de trabajo si existe
        if presupuesto_test_2.orden_trabajo:
            presupuesto_test_2.orden_trabajo.delete()
        # Eliminar items
        for item in list(presupuesto_test_2.items):
            item.delete()
        presupuesto_test_2.delete()
        commit()
    
    # Calcular fechas (hace días desde hoy)
    hoy = date.today()
    fecha_evento_1 = hoy - timedelta(days=10)
    fecha_retiro_1 = hoy - timedelta(days=9)
    fecha_devolucion_1 = hoy - timedelta(days=5)  # 5 días de retraso
    
    fecha_evento_2 = hoy - timedelta(days=15)
    fecha_retiro_2 = hoy - timedelta(days=14)
    fecha_devolucion_2 = hoy - timedelta(days=10)  # 10 días de retraso
    
    # ============================================
    # ORDEN 1: Cliente con 5 días de retraso
    # ============================================
    print("\nCreando Orden 1 (5 dias de retraso)...")
    
    # Crear Presupuesto 1
    presupuesto1 = Presupuesto(
        numero='PRES-TEST-001',
        cliente=cliente1,
        fecha_evento=fecha_evento_1,
        fecha_retiro=fecha_retiro_1,
        fecha_devolucion=fecha_devolucion_1,
        fecha_creacion=datetime.now(),
        categoria_evento='Cumpleaños',
        nombre_agasajado='Juan Pérez',
        lugar_evento='Salón Eventos Centro',
        total=50000.00,
        estado='aprobado'
    )
    commit()  # Para obtener el ID
    
    # Crear Items del Presupuesto 1
    precio_unitario_1 = 25000.00
    ItemPresupuesto(
        presupuesto=presupuesto1,
        producto=producto1,
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
        estado='lista',
        seña_pagada=20000.00,
        saldo_pendiente=30000.00,
        metodo_pago='EFECTIVO'
    )
    commit()
    
    print(f"   OK: Presupuesto {presupuesto1.numero} creado (ID: {presupuesto1.id})")
    print(f"   OK: Orden de Trabajo creada (ID: {orden1.id})")
    
    # ============================================
    # ORDEN 2: Cliente con 10 días de retraso
    # ============================================
    print("\nCreando Orden 2 (10 dias de retraso)...")
    
    # Crear Presupuesto 2
    presupuesto2 = Presupuesto(
        numero='PRES-TEST-002',
        cliente=cliente2,
        fecha_evento=fecha_evento_2,
        fecha_retiro=fecha_retiro_2,
        fecha_devolucion=fecha_devolucion_2,
        fecha_creacion=datetime.now(),
        categoria_evento='Casamiento',
        nombre_agasajado='María González',
        lugar_evento='Salón Eventos Norte',
        total=75000.00,
        estado='aprobado'
    )
    commit()
    
    # Crear Items del Presupuesto 2
    precio_unitario_2 = 37500.00
    ItemPresupuesto(
        presupuesto=presupuesto2,
        producto=producto1,
        cantidad=2,
        precio_unitario=precio_unitario_2,
        subtotal=precio_unitario_2 * 2
    )
    
    # Crear Orden de Trabajo 2
    orden2 = OrdenTrabajo(
        presupuesto=presupuesto2,
        fecha_creacion=datetime.now(),
        fecha_evento=fecha_evento_2,
        estado='lista',
        seña_pagada=30000.00,
        saldo_pendiente=45000.00,
        metodo_pago='DEBITO'
    )
    commit()
    
    print(f"   OK: Presupuesto {presupuesto2.numero} creado (ID: {presupuesto2.id})")
    print(f"   OK: Orden de Trabajo creada (ID: {orden2.id})")
    
    # ============================================
    # VERIFICACIÓN
    # ============================================
    print("\nDatos de prueba insertados correctamente!")
    print("\nResumen:")
    print(f"   Orden 1: {orden1.id} - Cliente: {cliente1.nombre} {cliente1.apellido} - Retraso: 5 dias")
    print(f"   Orden 2: {orden2.id} - Cliente: {cliente2.nombre} {cliente2.apellido} - Retraso: 10 dias")
    print("\nAhora puedes probar el reporte 'No devolvieron' en la interfaz web")

if __name__ == '__main__':
    try:
        insertar_datos_prueba()
    except Exception as e:
        print(f"ERROR al insertar datos: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

