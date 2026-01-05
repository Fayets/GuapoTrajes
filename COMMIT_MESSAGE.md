# Mensaje de Commit Completo

## Resumen General

Implementación completa del sistema de gestión de disponibilidad de productos, reportes avanzados, y mejora del flujo de trabajo de presupuestos y órdenes de trabajo. Se incluye la funcionalidad para rastrear el uso de productos y generar reportes de productos críticos.

## Cambios Principales

### 1. Sistema de Disponibilidad de Productos Mejorado

#### Backend:
- **`backend/src/services/disponibilidad_services.py`**: 
  - Mejora de la verificación de disponibilidad para incluir presupuestos pendientes y aprobados
  - Lógica para excluir presupuestos cancelados de la verificación de disponibilidad
  - Soporte para `presupuesto_excluir_id` para permitir edición de presupuestos sin bloquear sus propios productos

- **`backend/src/services/presupuestos_services.py`**:
  - Validación de disponibilidad antes de crear/editar presupuestos
  - Integración con el servicio de disponibilidad para prevenir conflictos

- **`backend/src/services/orden_trabajo_services.py`**:
  - Implementación de lógica para incrementar `veces_alquilado` cuando una orden se marca como "Completada"
  - Al eliminar una orden de trabajo, el presupuesto asociado se marca como "cancelada" en lugar de eliminarse
  - Limpieza adecuada de productos reservados al eliminar órdenes

#### Frontend:
- **`frontend/my-app/src/app/(dashboard)/presupuestos/page.tsx`**:
  - Soporte para estado "cancelada" en presupuestos
  - Visualización de presupuestos cancelados con estilo rojo
  - Ocultación de acciones (Generar Orden, Eliminar) para presupuestos cancelados

### 2. Nuevos Reportes Implementados

#### Reporte "Saldos a Cobrar":
- **Backend**: `backend/src/services/reportes_services.py`
  - Método `obtener_saldos_a_cobrar()` para filtrar saldos pendientes por fecha de creación
  - Agrupación por cliente con información de órdenes asociadas
- **Backend**: `backend/src/controllers/reportes_controller.py`
  - Endpoint `/reportes/saldos-a-cobrar`
- **Frontend**: `frontend/my-app/src/app/(dashboard)/reportes/page.tsx`
  - Interfaz completa con filtros de fecha
  - Exportación a CSV
  - Visualización de resumen y detalles por cliente

#### Reporte "Conjuntos a Armar" (Prendas a Armar):
- **Backend**: `backend/src/services/reportes_services.py`
  - Método `obtener_prendas_a_armar()` para listar órdenes de trabajo a entregar
  - Filtrado por fecha de evento y sucursal
- **Backend**: `backend/src/controllers/reportes_controller.py`
  - Endpoint `/reportes/prendas-a-armar`
- **Frontend**: `frontend/my-app/src/app/(dashboard)/reportes/page.tsx`
  - Interfaz completa con filtros de fecha
  - Botón "Semana Actual" para generar reporte automático de lunes a sábado
  - Exportación a PDF con formato profesional
  - Visualización tipo acordeón con detalles de cada orden

#### Reporte "No Devolvieron":
- **Backend**: `backend/src/services/reportes_services.py`
  - Método `obtener_no_devolvieron()` para listar órdenes con productos no devueltos
  - Cálculo de días de retraso
  - Filtrado por fecha de devolución y estado
- **Backend**: `backend/src/controllers/reportes_controller.py`
  - Endpoint `/reportes/no-devolvieron`
- **Frontend**: `frontend/my-app/src/app/(dashboard)/reportes/page.tsx`
  - Interfaz completa con exportación a PDF
  - Visualización de información de clientes y productos pendientes
- **Scripts de Prueba**:
  - `backend/scripts/insertar_datos_prueba_no_devolvieron.py`
  - `backend/scripts/datos_prueba_no_devolvieron.sql`
  - `backend/scripts/datos_prueba_no_devolvieron_manual.md`

#### Reporte "Productos Críticos":
- **Backend**: `backend/src/models.py`
  - Agregado campo `veces_alquilado` al modelo `Producto` (tipo int, default=0)
- **Backend**: `backend/src/services/reportes_services.py`
  - Método `obtener_productos_criticos()` para listar productos con más de 10 alquileres
  - Filtrado por sucursal y ordenamiento por veces_alquilado descendente
- **Backend**: `backend/src/controllers/reportes_controller.py`
  - Endpoint `/reportes/productos-criticos`
- **Frontend**: `frontend/my-app/src/app/(dashboard)/reportes/page.tsx`
  - Interfaz completa con exportación a PDF
  - Visualización de código de barras, descripción, línea, talle, color, tela, estado, veces alquilado y stock
  - Resumen con total de productos, promedio y máximo de alquileres
  - Descripción actualizada: "Productos con nivel alto de desgaste o uso"
- **Migración de Base de Datos**:
  - `backend/scripts/migracion_veces_alquilado.sql`
  - `backend/scripts/migracion_veces_alquilado.py`
- **Scripts de Prueba**:
  - `backend/scripts/insertar_productos_criticos_prueba.py`

### 3. Mejoras en Contratos y Órdenes de Trabajo

- **`frontend/my-app/src/app/(dashboard)/ordenes/page.tsx`**:
  - Optimización del contrato para que quepa en una sola página de impresión
  - Ajuste de tamaños de fuente, márgenes y espaciado
  - Eliminación de saltos de página innecesarios

### 4. Control de Acceso Basado en Roles (RBAC)

- **`frontend/my-app/src/components/ui/sidebar.tsx`**:
  - Permiso para usuarios "EMPLEADO" de acceder a la sección "Reportes"
- **`frontend/my-app/src/app/(dashboard)/dashboard/page.tsx`**:
  - Permiso para usuarios "EMPLEADO" de ver el módulo "Reportes"
- **`frontend/my-app/src/app/(dashboard)/reportes/page.tsx`**:
  - Filtrado de reportes disponibles según rol de usuario
  - Usuarios "EMPLEADO" solo pueden ver el reporte "Conjuntos a armar"
  - Selección predeterminada del reporte "Conjuntos a armar" para empleados

### 5. Scripts de Utilidad

- Scripts para datos de prueba de los nuevos reportes
- Scripts de migración de base de datos
- Documentación manual para creación de datos de prueba

### 6. Mejoras en la Vista de Productos

- **`backend/src/schemas.py`**:
  - Agregado campo `veces_alquilado` al schema `ProductBase` para incluir el contador de alquileres en las respuestas de la API

- **`backend/src/services/productos_services.py`**:
  - Actualizado método `get_product_by_code()` para incluir `veces_alquilado` en la respuesta

- **`frontend/my-app/src/app/(dashboard)/productos/page.tsx`**:
  - Agregado campo `veces_alquilado` a la interfaz TypeScript `Producto`
  - Rediseñado modal de "Ver Producto" para que tenga el mismo diseño que el modal de "Editar Producto"
  - Implementado diseño con dos cards en columnas:
    - Card izquierda: "Datos generales" (código, descripción, línea, talle, tela, color, estado, fecha de alta, inmovilizado)
    - Card derecha: "Precios y stock" (todos los precios, stock, stock mínimo y **"Cantidad de Usos o Veces Alquiladas"**)
  - Campos mostrados como elementos de solo lectura con fondo gris claro (consistentes con el diseño del modal de editar)
  - Mismo tamaño de modal (`modal-xl`, maxWidth: 900px), mismo padding y mismo formato de estilos

## Archivos Modificados

### Backend:
- `backend/src/models.py`
- `backend/src/schemas.py`
- `backend/src/services/disponibilidad_services.py`
- `backend/src/services/presupuestos_services.py`
- `backend/src/services/orden_trabajo_services.py`
- `backend/src/services/productos_services.py`
- `backend/src/services/reportes_services.py`
- `backend/src/controllers/reportes_controller.py`

### Frontend:
- `frontend/my-app/src/app/(dashboard)/presupuestos/page.tsx`
- `frontend/my-app/src/app/(dashboard)/ordenes/page.tsx`
- `frontend/my-app/src/app/(dashboard)/productos/page.tsx`
- `frontend/my-app/src/app/(dashboard)/reportes/page.tsx`
- `frontend/my-app/src/app/(dashboard)/dashboard/page.tsx`
- `frontend/my-app/src/components/ui/sidebar.tsx`

### Scripts (Nuevos):
- `backend/scripts/insertar_datos_prueba_no_devolvieron.py`
- `backend/scripts/datos_prueba_no_devolvieron.sql`
- `backend/scripts/datos_prueba_no_devolvieron_manual.md`
- `backend/scripts/migracion_veces_alquilado.sql`
- `backend/scripts/migracion_veces_alquilado.py`
- `backend/scripts/insertar_productos_criticos_prueba.py`

## Migraciones de Base de Datos Requeridas

1. **Campo `veces_alquilado` en tabla `Productos`**:
   - Ejecutar: `backend/scripts/migracion_veces_alquilado.py`
   - O manualmente: `ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "veces_alquilado" INTEGER DEFAULT 0;`

## Notas Importantes

- El campo `veces_alquilado` se incrementa automáticamente cuando una orden de trabajo se marca como "Completada"
- Los presupuestos cancelados no bloquean la disponibilidad de productos
- Los reportes filtran automáticamente por la sucursal del usuario logueado
- El reporte "Conjuntos a armar" incluye un botón "Semana Actual" para facilitar el trabajo semanal
- Los usuarios "EMPLEADO" tienen acceso limitado a reportes (solo "Conjuntos a armar")

## Testing

- Scripts de prueba incluidos para verificar el funcionamiento de los nuevos reportes
- Datos de prueba disponibles para "No devolvieron" y "Productos críticos"

