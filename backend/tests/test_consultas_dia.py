"""Las lecturas del día no mezclan otras fechas y conservan los totales."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from pony.orm import db_session, flush

from src.fechas_ar import hoy_ar
from src.models import (
    CajaMovimiento,
    EstadoProducto,
    MetodoPago,
    OrdenTrabajo,
    Presupuesto,
    Producto,
    ProductoReservado,
    Roles,
    Sucursal,
    TipoMovimiento,
    Usuario,
)
from src.services.caja_services import CajaServices
from src.services.dashboard_services import DashboardServices
from src.services.disponibilidad_services import (
    dias_ventana_seguridad,
    producto_ids_en_ventana_reserva_el_dia,
)
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from src.services.productos_services import ProductoServices
from tests.factories import seed_base_world

DIA = date(2026, 10, 9)


def _producto(world, codigo: str, estado=EstadoProducto.SALON, sucursal_id=None):
    with db_session:
        sucursal = Sucursal.get(id=sucursal_id or world.sucursal_id)
        base = dict(
            costo=100.0,
            precio_alquiler_lista=200.0,
            precio_alquiler_efectivo=180.0,
            precio_venta_nuevo_lista=300.0,
            precio_venta_nuevo_efectivo=280.0,
            precio_de_venta_medio_uso=150.0,
            precio_venta=290.0,
            precio_liquidacion=100.0,
            stock=1,
            stock_minimo=0,
            fecha_alta=date(2025, 1, 1),
            estado=estado,
            sucursal=sucursal,
        )
        producto = Producto(codigo_barra=codigo, descripcion=codigo, **base)
        flush()
        return producto.id


def test_caja_diaria_lee_solo_el_dia_y_arma_totales():
    world = seed_base_world()
    with db_session:
        sucursal = Sucursal.get(id=world.sucursal_id)
        usuario = Usuario.get(id=world.usuario_id)
        en_dia = datetime(2026, 10, 9, 21, 15)
        otro_dia = datetime(2026, 10, 8, 12, 0)
        CajaMovimiento(
            fecha_hora=en_dia,
            tipo=TipoMovimiento.INGRESO,
            monto=100,
            origen="VENTA:test",
            categoria="VENTAS",
            payment_method=MetodoPago.EFECTIVO,
            usuario=usuario,
            sucursal=sucursal,
        )
        CajaMovimiento(
            fecha_hora=en_dia,
            tipo=TipoMovimiento.EGRESO,
            monto=40,
            origen="GASTO:test",
            categoria="OTROS_EGRESOS",
            payment_method=MetodoPago.EFECTIVO,
            usuario=usuario,
            sucursal=sucursal,
        )
        CajaMovimiento(
            fecha_hora=en_dia,
            tipo=TipoMovimiento.INGRESO,
            monto=25,
            origen="VENTA:credito",
            categoria="VENTAS",
            payment_method=MetodoPago.CREDITO,
            usuario=usuario,
            sucursal=sucursal,
        )
        CajaMovimiento(
            fecha_hora=otro_dia,
            tipo=TipoMovimiento.INGRESO,
            monto=999,
            origen="VENTA:ayer",
            categoria="VENTAS",
            payment_method=MetodoPago.EFECTIVO,
            usuario=usuario,
            sucursal=sucursal,
        )

    resumen = CajaServices().resumen_caja_diaria(DIA, world.sucursal_id)
    origenes = {m["origen"] for m in resumen["movimientos"]}
    assert "VENTA:ayer" not in origenes
    assert origenes == {"VENTA:test", "GASTO:test", "VENTA:credito"}
    assert resumen["totales"]["total_general"] == 85
    assert resumen["saldo_efectivo"] == 60


def test_ventana_reserva_ignora_canceladas_y_fuera_de_rango():
    world = seed_base_world()
    dia = hoy_ar()
    margen = dias_ventana_seguridad()
    dentro = _producto(world, f"VENTANA-DENTRO-{world.sucursal_id}")
    fuera = _producto(world, f"VENTANA-FUERA-{world.sucursal_id}")
    cancelado = _producto(world, f"VENTANA-CANCEL-{world.sucursal_id}")

    with db_session:
        cliente_id = world.cliente_id
        from src.models import Cliente

        cliente = Cliente.get(id=cliente_id)
        producto_dentro = Producto.get(id=dentro)
        producto_fuera = Producto.get(id=fuera)
        producto_cancelado = Producto.get(id=cancelado)

        def _orden(producto, estado, retiro, numero):
            presupuesto = Presupuesto(
                numero=numero,
                cliente=cliente,
                fecha_evento=retiro,
                fecha_retiro=retiro,
                total=100,
            )
            orden = OrdenTrabajo(
                presupuesto=presupuesto,
                fecha_evento=retiro,
                estado=estado,
                seña_pagada=50,
                saldo_pendiente=50,
                metodo_pago="EFECTIVO",
            )
            ProductoReservado(
                orden_trabajo=orden,
                producto=producto,
                fecha_bloqueo=retiro - timedelta(days=margen),
            )
            flush()

        _orden(producto_dentro, "pendiente", dia, f"PRES-V-{dentro}")
        _orden(producto_fuera, "pendiente", dia + timedelta(days=margen + 2), f"PRES-F-{fuera}")
        _orden(producto_cancelado, "cancelada", dia, f"PRES-C-{cancelado}")

    with db_session:
        ids = producto_ids_en_ventana_reserva_el_dia(dia)
    assert dentro in ids
    assert fuera not in ids
    assert cancelado not in ids


def test_stats_de_productos_respeta_admin_y_sucursal():
    world = seed_base_world()
    servicio = ProductoServices()
    antes_admin = servicio.get_status_stats(world.usuario_id)

    with db_session:
        otra = Sucursal(nombre=f"Otra {world.sucursal_id}", direccion="x", provincia="BA")
        flush()
        empleado = Usuario(
            username=f"emp_{world.sucursal_id}_{otra.id}",
            email=f"emp_{world.sucursal_id}_{otra.id}@test.local",
            password="x",
            nombre="Em",
            apellido="Pleado",
            rol=Roles.EMPLEADO,
            sucursal=otra,
        )
        flush()
        otra_id = otra.id
        empleado_id = empleado.id

    _producto(world, f"LAV-{world.sucursal_id}", EstadoProducto.LAVANDERIA)
    _producto(
        world,
        f"SALON-OTRA-{otra_id}",
        EstadoProducto.SALON,
        sucursal_id=otra_id,
    )

    despues_admin = servicio.get_status_stats(world.usuario_id)
    assert despues_admin["LAVANDERIA"] == antes_admin["LAVANDERIA"] + 1
    assert despues_admin["SALON"] == antes_admin["SALON"] + 1

    empleado_stats = servicio.get_status_stats(empleado_id)
    assert empleado_stats["SALON"] == 1
    assert empleado_stats["LAVANDERIA"] == 0


def test_dashboard_suma_ventas_del_dia_y_no_cuenta_ordenes_cerradas():
    world = seed_base_world()
    antes = DashboardServices().kpis(DIA, world.usuario_id, world.sucursal_id)

    with db_session:
        sucursal = Sucursal.get(id=world.sucursal_id)
        usuario = Usuario.get(id=world.usuario_id)
        from src.models import Cliente

        cliente = Cliente.get(id=world.cliente_id)
        CajaMovimiento(
            fecha_hora=datetime(2026, 10, 9, 18, 0),
            tipo=TipoMovimiento.INGRESO,
            monto=80,
            origen="VENTA:dash",
            categoria="VENTAS",
            payment_method=MetodoPago.EFECTIVO,
            usuario=usuario,
            sucursal=sucursal,
        )
        CajaMovimiento(
            fecha_hora=datetime(2026, 10, 9, 18, 5),
            tipo=TipoMovimiento.INGRESO,
            monto=15,
            origen="SEÑA:dash",
            categoria="SEÑAS",
            payment_method=MetodoPago.EFECTIVO,
            usuario=usuario,
            sucursal=sucursal,
        )
        presupuesto = Presupuesto(
            numero=f"PRES-DASH-{world.sucursal_id}",
            cliente=cliente,
            fecha_evento=DIA,
            total=80,
        )
        OrdenTrabajo(
            presupuesto=presupuesto,
            fecha_evento=DIA,
            estado="pendiente",
            seña_pagada=10,
            saldo_pendiente=70,
            metodo_pago="EFECTIVO",
        )
        presupuesto_cerrado = Presupuesto(
            numero=f"PRES-DASH-C-{world.sucursal_id}",
            cliente=cliente,
            fecha_evento=DIA,
            total=10,
        )
        OrdenTrabajo(
            presupuesto=presupuesto_cerrado,
            fecha_evento=DIA,
            estado="completada",
            seña_pagada=10,
            saldo_pendiente=0,
            metodo_pago="EFECTIVO",
        )

    despues = DashboardServices().kpis(DIA, world.usuario_id, world.sucursal_id)
    assert despues["ventas_total"] == (antes["ventas_total"] or 0) + 80
    assert despues["ventas_cantidad"] == (antes["ventas_cantidad"] or 0) + 1
    assert despues["saldo_efectivo"] == (antes["saldo_efectivo"] or 0) + 95
    assert despues["ordenes_activas"] == (antes["ordenes_activas"] or 0) + 1


def test_dashboard_kpis_exige_sesion_y_responde_el_contrato():
    from fastapi.testclient import TestClient
    from jose import jwt

    from main import app
    from src.security import ALGORITHM, SECRET_KEY

    world = seed_base_world()
    client = TestClient(app)
    assert client.get("/dashboard/kpis").status_code == 401
    token = jwt.encode(
        {"sub": str(world.usuario_id), "type": "access"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    res = client.get(
        "/dashboard/kpis",
        params={"fecha": "2026-10-09", "sucursal_id": world.sucursal_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    for campo in (
        "ventas_total",
        "ventas_cantidad",
        "saldo_efectivo",
        "ordenes_activas",
        "prendas_salon",
    ):
        assert campo in body


def test_listados_siguen_devolviendo_la_grilla():
    world = seed_base_world()
    dia = hoy_ar()
    with db_session:
        from src.models import Cliente

        cliente = Cliente.get(id=world.cliente_id)
        producto = Producto.get(id=world.producto_a_id)
        presupuesto = Presupuesto(
            numero=f"PRES-LIST-{world.producto_a_id}",
            cliente=cliente,
            fecha_evento=dia,
            total=200,
        )
        from src.models import ItemPresupuesto

        ItemPresupuesto(
            presupuesto=presupuesto,
            producto=producto,
            cantidad=1,
            precio_unitario=200,
            subtotal=200,
        )
        orden = OrdenTrabajo(
            presupuesto=presupuesto,
            fecha_evento=dia,
            estado="pendiente",
            seña_pagada=50,
            saldo_pendiente=150,
            metodo_pago="EFECTIVO",
        )
        ProductoReservado(
            orden_trabajo=orden,
            producto=producto,
            fecha_bloqueo=dia,
        )
        flush()
        presupuesto_id = presupuesto.id
        orden_id = orden.id

    presupuestos = PresupuestosServices().listar_presupuestos()
    encontrado = next(p for p in presupuestos if p.id == presupuesto_id)
    assert encontrado.numero == f"PRES-LIST-{world.producto_a_id}"
    assert encontrado.cliente_nombre
    assert len(encontrado.items) == 1
    assert encontrado.items[0].producto_id == world.producto_a_id

    ordenes = OrdenTrabajoServices().listar_ordenes_trabajo()
    orden_api = next(o for o in ordenes if o["id"] == orden_id)
    assert orden_api["presupuesto_numero"] == f"PRES-LIST-{world.producto_a_id}"
    assert orden_api["cliente_nombre"]
    assert len(orden_api["productos_reservados"]) == 1
