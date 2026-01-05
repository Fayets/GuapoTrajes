# Guía para crear datos de prueba - Reporte "No devolvieron"

Este documento explica cómo crear manualmente datos de prueba para el reporte "No devolvieron" desde la interfaz web.

## Opción 1: Crear desde la interfaz (Recomendado)

### Paso 1: Crear o usar clientes existentes
1. Ve a la sección "Clientes"
2. Crea 2 clientes nuevos o usa clientes existentes
3. Anota los IDs o nombres de los clientes que usarás

### Paso 2: Crear presupuestos con fechas pasadas
1. Ve a la sección "Presupuestos"
2. Crea un nuevo presupuesto para el Cliente 1:
   - Fecha evento: hace 10 días
   - Fecha retiro: hace 9 días
   - **Fecha devolución: hace 5 días** (esto creará 5 días de retraso)
   - Agrega productos
   - Guarda el presupuesto

3. Crea otro presupuesto para el Cliente 2:
   - Fecha evento: hace 15 días
   - Fecha retiro: hace 14 días
   - **Fecha devolución: hace 10 días** (esto creará 10 días de retraso)
   - Agrega productos
   - Guarda el presupuesto

### Paso 3: Generar órdenes de trabajo
1. Ve a la sección "Presupuestos"
2. Para cada presupuesto creado:
   - Abre el presupuesto
   - Cambia el estado a "Aprobado"
   - Genera la orden de trabajo
   - Asegúrate de que el estado de la orden NO sea "completada" o "cancelada"

### Paso 4: Verificar en el reporte
1. Ve a "Reportes" > "No devolvieron"
2. Haz clic en "Generar Reporte"
3. Deberías ver las 2 órdenes con sus días de retraso correspondientes

---

## Opción 2: Usar SQL directamente

Si prefieres usar SQL, ejecuta el script `datos_prueba_no_devolvieron.sql` pero **debes ajustar**:

1. **IDs de Clientes**: Reemplaza `1` por IDs reales de clientes en tu BD
2. **IDs de Productos**: Reemplaza `1, 2` por IDs reales de productos en tu BD
3. **Fechas**: Las fechas están en formato SQLite (`DATE('now', '-X days')`)

### Para obtener IDs existentes:

```sql
-- Ver clientes
SELECT id, nombre, apellido FROM "Cliente" LIMIT 5;

-- Ver productos
SELECT id, codigo_barra, descripcion FROM "Productos" LIMIT 5;

-- Ver presupuestos de prueba (para limpiar después)
SELECT id, numero FROM "Presupuesto" WHERE numero LIKE 'PRES-TEST-%';

-- Eliminar datos de prueba (si necesitas limpiar)
DELETE FROM "OrdenesTrabajo" WHERE presupuesto IN (
    SELECT id FROM "Presupuesto" WHERE numero LIKE 'PRES-TEST-%'
);
DELETE FROM "ItemPresupuesto" WHERE presupuesto IN (
    SELECT id FROM "Presupuesto" WHERE numero LIKE 'PRES-TEST-%'
);
DELETE FROM "Presupuesto" WHERE numero LIKE 'PRES-TEST-%';
```

---

## Notas importantes:

- El reporte solo muestra órdenes donde `fecha_devolucion < fecha_actual`
- Las órdenes canceladas NO aparecen en el reporte
- El reporte filtra automáticamente por la sucursal del usuario logueado
- Los días de retraso se calculan como: `fecha_actual - fecha_devolucion`

