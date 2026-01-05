"""
Script para actualizar productos de prueba con veces_alquilado >= 10
para el reporte "Productos críticos"
"""
import sys
import os

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pony.orm import db_session, commit
from src.models import Producto
from src.db import db as database
database.generate_mapping(create_tables=False)

@db_session
def actualizar_productos_criticos():
    """Actualiza productos existentes con veces_alquilado >= 10"""
    
    # Obtener productos existentes
    productos = list(Producto.select()[:20])  # Obtener hasta 20 productos
    
    if len(productos) < 5:
        print(f"ADVERTENCIA: Solo se encontraron {len(productos)} productos")
        print("Se necesitan al menos 5 productos para la prueba")
        if len(productos) == 0:
            print("ERROR: No hay productos en la base de datos")
            return
    
    print(f"OK: Se encontraron {len(productos)} productos")
    
    # Actualizar algunos productos con veces_alquilado >= 10
    valores_prueba = [10, 12, 15, 18, 20, 22, 25, 11, 13, 16]
    
    productos_actualizados = 0
    for i, producto in enumerate(productos[:len(valores_prueba)]):
        producto.veces_alquilado = valores_prueba[i]
        productos_actualizados += 1
        print(f"OK: Producto {producto.codigo_barra} - {producto.descripcion} actualizado con {valores_prueba[i]} veces alquilado")
    
    commit()
    
    print(f"\nDatos de prueba actualizados correctamente!")
    print(f"Total de productos actualizados: {productos_actualizados}")
    print("\nResumen de productos críticos:")
    productos_criticos = list(Producto.select(lambda p: p.veces_alquilado > 10))
    for producto in productos_criticos:
        print(f"  - {producto.codigo_barra}: {producto.descripcion} - {producto.veces_alquilado} veces alquilado")
    
    print(f"\nTotal de productos críticos: {len(productos_criticos)}")
    print("\nAhora puedes probar el reporte 'Productos críticos' en la interfaz web")

if __name__ == '__main__':
    try:
        actualizar_productos_criticos()
    except Exception as e:
        print(f"ERROR al actualizar productos: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

