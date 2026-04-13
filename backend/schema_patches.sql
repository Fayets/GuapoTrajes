-- Ejecutar manualmente en PostgreSQL si las columnas aún no existen.

ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE NULL;

ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS descripcion_libre TEXT NULL;
