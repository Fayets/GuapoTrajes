from pony.orm import db_session, commit
from .models import Presupuesto, ItemPresupuesto, OrdenTrabajo

@db_session
def eliminar_presupuestos_y_ordenes():
    print("🧹 Eliminando items de presupuestos...")
    ItemPresupuesto.select().delete(bulk=True)

    print("🧹 Eliminando órdenes de trabajo...")
    OrdenTrabajo.select().delete(bulk=True)

    print("🧹 Eliminando presupuestos...")
    Presupuesto.select().delete(bulk=True)

    commit()
    print("✅ Todos los registros han sido eliminados.")

if __name__ == "__main__":
    eliminar_presupuestos_y_ordenes()
