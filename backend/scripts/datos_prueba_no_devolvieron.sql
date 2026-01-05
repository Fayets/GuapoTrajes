-- Script SQL para crear datos de prueba del reporte "No devolvieron"
-- Este script crea 2 órdenes de trabajo con fechas de devolución pasadas

-- IMPORTANTE: Antes de ejecutar este script, asegúrate de tener:
-- 1. Al menos 2 clientes existentes (o ajusta los IDs en el script)
-- 2. Al menos 2 productos existentes en la sucursal (o ajusta los IDs en el script)
-- 3. Una sucursal con ID 1 (o ajusta el ID en el script)

-- Si no tienes clientes o productos, primero crea algunos manualmente desde la interfaz

-- ============================================
-- ORDEN 1: Cliente con 5 días de retraso
-- ============================================

-- Paso 1: Obtener IDs existentes (ajusta estos valores según tu base de datos)
-- Cliente ID: usar el ID de un cliente existente (ej: 1)
-- Producto IDs: usar IDs de productos existentes (ej: 1, 2)

-- Paso 2: Crear Presupuesto 1
INSERT INTO "Presupuesto" (
    "numero",
    "cliente",
    "fecha_evento",
    "fecha_retiro",
    "fecha_devolucion",
    "fecha_creacion",
    "categoria_evento",
    "nombre_agasajado",
    "lugar_evento",
    "total",
    "estado"
)
VALUES (
    'PRES-TEST-001',
    1, -- Cliente ID (ajustar según tu BD)
    DATE('now', '-10 days'), -- Fecha evento: hace 10 días
    DATE('now', '-9 days'), -- Fecha retiro: hace 9 días
    DATE('now', '-5 days'), -- Fecha devolución: hace 5 días (5 días de retraso)
    datetime('now'),
    'Cumpleaños',
    'Juan Pérez',
    'Salón Eventos Centro',
    50000.00,
    'aprobado'
);

-- Paso 3: Obtener el ID del presupuesto recién creado (ajustar según tu BD)
-- Asumiendo que el siguiente ID disponible es el máximo + 1
-- O puedes consultar: SELECT MAX(id) FROM "Presupuesto";

-- Paso 4: Crear Items del Presupuesto 1
-- Necesitas obtener el ID del presupuesto insertado (ajustar estos valores)
-- Asumiendo que el presupuesto tiene ID = (SELECT MAX(id) FROM "Presupuesto" WHERE numero = 'PRES-TEST-001')
INSERT INTO "ItemPresupuesto" (
    "presupuesto",
    "producto",
    "cantidad",
    "precio_unitario",
    "subtotal"
)
SELECT 
    (SELECT id FROM "Presupuesto" WHERE numero = 'PRES-TEST-001'),
    1, -- Producto ID 1 (ajustar según tu BD)
    1, -- Cantidad
    25000.00, -- Precio unitario
    25000.00 -- Subtotal
UNION ALL
SELECT 
    (SELECT id FROM "Presupuesto" WHERE numero = 'PRES-TEST-001'),
    2, -- Producto ID 2 (ajustar según tu BD)
    1, -- Cantidad
    25000.00, -- Precio unitario
    25000.00; -- Subtotal

-- Paso 5: Crear Orden de Trabajo 1
INSERT INTO "OrdenesTrabajo" (
    "presupuesto",
    "fecha_creacion",
    "fecha_evento",
    "estado",
    "seña_pagada",
    "saldo_pendiente",
    "metodo_pago"
)
SELECT 
    (SELECT id FROM "Presupuesto" WHERE numero = 'PRES-TEST-001'),
    datetime('now'),
    DATE('now', '-10 days'), -- Fecha evento
    'lista', -- Estado: lista (no completada)
    20000.00, -- Seña pagada
    30000.00, -- Saldo pendiente
    'EFECTIVO'; -- Método de pago

-- ============================================
-- ORDEN 2: Cliente con 10 días de retraso
-- ============================================

-- Paso 6: Crear Presupuesto 2
INSERT INTO "Presupuesto" (
    "numero",
    "cliente",
    "fecha_evento",
    "fecha_retiro",
    "fecha_devolucion",
    "fecha_creacion",
    "categoria_evento",
    "nombre_agasajado",
    "lugar_evento",
    "total",
    "estado"
)
VALUES (
    'PRES-TEST-002',
    1, -- Cliente ID (ajustar según tu BD, puede ser el mismo o diferente)
    DATE('now', '-15 days'), -- Fecha evento: hace 15 días
    DATE('now', '-14 days'), -- Fecha retiro: hace 14 días
    DATE('now', '-10 days'), -- Fecha devolución: hace 10 días (10 días de retraso)
    datetime('now'),
    'Casamiento',
    'María González',
    'Salón Eventos Norte',
    75000.00,
    'aprobado'
);

-- Paso 7: Crear Items del Presupuesto 2
INSERT INTO "ItemPresupuesto" (
    "presupuesto",
    "producto",
    "cantidad",
    "precio_unitario",
    "subtotal"
)
SELECT 
    (SELECT id FROM "Presupuesto" WHERE numero = 'PRES-TEST-002'),
    1, -- Producto ID 1 (ajustar según tu BD)
    2, -- Cantidad
    37500.00, -- Precio unitario
    75000.00; -- Subtotal

-- Paso 8: Crear Orden de Trabajo 2
INSERT INTO "OrdenesTrabajo" (
    "presupuesto",
    "fecha_creacion",
    "fecha_evento",
    "estado",
    "seña_pagada",
    "saldo_pendiente",
    "metodo_pago"
)
SELECT 
    (SELECT id FROM "Presupuesto" WHERE numero = 'PRES-TEST-002'),
    datetime('now'),
    DATE('now', '-15 days'), -- Fecha evento
    'lista', -- Estado: lista (no completada)
    30000.00, -- Seña pagada
    45000.00, -- Saldo pendiente
    'DEBITO'; -- Método de pago

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Para verificar que los datos se insertaron correctamente:
-- SELECT 
--     ot.id as orden_id,
--     p.numero as presupuesto_numero,
--     p.fecha_devolucion,
--     DATE('now') - p.fecha_devolucion as dias_retraso,
--     c.nombre || ' ' || c.apellido as cliente_nombre,
--     c.celular
-- FROM "OrdenesTrabajo" ot
-- JOIN "Presupuesto" p ON ot.presupuesto = p.id
-- JOIN "Cliente" c ON p.cliente = c.id
-- WHERE p.numero LIKE 'PRES-TEST-%';

