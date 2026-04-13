from pony.orm import *
from decouple import config

db = Database()

_provider = (config("DB_PROVIDER", default="postgres") or "postgres").lower()
if _provider == "sqlite":
    db.bind(provider="sqlite", filename=config("DB_NAME", default=":memory:"), create_db=True)
else:
    db.bind(
        provider=config("DB_PROVIDER"),
        user=config("DB_USER"),
        password=config("DB_PASS"),
        host=config("DB_HOST"),
        database=config("DB_NAME"),
    )

