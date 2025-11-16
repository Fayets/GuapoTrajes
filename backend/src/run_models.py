# run_models.py este archivo es para actualizar la bd ante cambios o agregado de clases/entidades/etc.

from src.db import db
from src.models import *
# Generar el mapeo y crear las tablas si no existen
db.generate_mapping(create_tables=True)

<<<<<<< HEAD
=======
print("✅ Tablas actualizadas correctamente.")
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
