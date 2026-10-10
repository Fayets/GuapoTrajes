from pony.orm import *
from pony.orm.dbapiprovider import Pool
from decouple import config

db = Database()

_provider = (config("DB_PROVIDER", default="postgres") or "postgres").lower()
if _provider == "sqlite":
    db.bind(provider="sqlite", filename=config("DB_NAME", default=":memory:"), create_db=True)
else:
    # Sesión PostgreSQL en hora Argentina (fechas DATE/TIMESTAMP coherentes con el negocio).
    # statement_timeout no va en el startup: el pooler de Neon lo rechaza.
    db.bind(
        provider=config("DB_PROVIDER"),
        user=config("DB_USER"),
        password=config("DB_PASS"),
        host=config("DB_HOST"),
        database=config("DB_NAME"),
        options="-c timezone=America/Argentina/Buenos_Aires",
    )

    _pool_connect = Pool._connect

    def _connect_con_tope(pool):
        _pool_connect(pool)
        cursor = pool.con.cursor()
        cursor.execute("SET statement_timeout = '15s'")
        cursor.close()

    Pool._connect = _connect_con_tope

    _conexion, _ = db.provider.connect()
    _cursor = _conexion.cursor()
    _cursor.execute("SET statement_timeout = '15s'")
    _cursor.close()
    db.provider.release(_conexion)

