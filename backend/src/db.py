from pony.orm import *
from decouple import config

db = Database()

_provider = (config("DB_PROVIDER", default="postgres") or "postgres").lower()
if _provider == "sqlite":
    db.bind(provider="sqlite", filename=config("DB_NAME", default=":memory:"), create_db=True)
else:
    # Sesión PostgreSQL en hora Argentina (fechas DATE/TIMESTAMP coherentes con el negocio).
    db.bind(
        provider=config("DB_PROVIDER"),
        user=config("DB_USER"),
        password=config("DB_PASS"),
        host=config("DB_HOST"),
        database=config("DB_NAME"),
        options="-c timezone=America/Argentina/Buenos_Aires",
    )

