# run_models.py este archivo es para actualizar la bd ante cambios o agregado de clases/entidades/etc.

from src.db import db
import src.models

# Generar el mapeo y crear las tablas si no existen
db.generate_mapping(create_tables=True)

print("✅ Tablas actualizadas correctamente.")
