-- Migración para agregar el campo veces_alquilado a la tabla Productos
-- Este campo cuenta cuántas veces se ha alquilado cada producto

-- Para PostgreSQL
ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "veces_alquilado" INTEGER DEFAULT 0;

-- Actualizar productos existentes para que tengan 0 como valor por defecto
UPDATE "Productos" SET "veces_alquilado" = 0 WHERE "veces_alquilado" IS NULL;

