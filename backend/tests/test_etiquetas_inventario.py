"""Tests de etiquetas de inventario (migración)."""
import pytest
from pony.orm import db_session

from src.models import Producto, Roles, Usuario
from src.services.productos_services import ProductoServices
from tests.factories import seed_base_world


@pytest.fixture
def world():
    return seed_base_world()


@pytest.fixture
def servicio():
    return ProductoServices()


def test_etiquetas_stats_y_registrar(world, servicio):
    stats = servicio.get_etiquetas_inventario_stats(user_id=world.usuario.id)
    assert stats["total"] >= 2
    assert stats["pendientes"] >= 2
    assert stats["impresos"] == 0

    pid = world.producto_a.id
    result = servicio.registrar_etiquetas_inventario_impresas(
        producto_ids=[pid],
        user_id=world.usuario.id,
    )
    assert result["success"] is True

    stats2 = servicio.get_etiquetas_inventario_stats(user_id=world.usuario.id)
    assert stats2["impresos"] >= 1


def test_reset_por_producto_ids(world, servicio):
    pid = world.producto_a.id
    servicio.registrar_etiquetas_inventario_impresas(
        producto_ids=[pid],
        user_id=world.usuario.id,
    )

    result = servicio.reset_etiquetas_inventario(
        user_id=world.usuario.id,
        producto_ids=[pid],
    )
    assert result["success"] is True

    with db_session:
        p = Producto.get(id=pid)
        assert p.etiqueta_inventario_impresa_at is None


def test_reset_todos_requiere_super_admin_y_confirmacion(world, servicio):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        servicio.reset_etiquetas_inventario(
            user_id=world.usuario.id,
            todos=True,
            confirmacion_global="RESETEAR_TODO_INVENTARIO",
        )
    assert exc.value.status_code == 403

    with db_session:
        admin = Usuario.get(id=world.usuario.id)
        admin.rol = Roles.SUPER_ADMIN
        super_id = admin.id

    with pytest.raises(HTTPException) as exc2:
        servicio.reset_etiquetas_inventario(
            user_id=super_id,
            todos=True,
            confirmacion_global="incorrecto",
        )
    assert exc2.value.status_code == 400

    result = servicio.reset_etiquetas_inventario(
        user_id=super_id,
        todos=True,
        confirmacion_global="RESETEAR_TODO_INVENTARIO",
    )
    assert result["success"] is True


def test_filtro_etiqueta_impresa_en_listado(world, servicio):
    pid = world.producto_a.id
    servicio.registrar_etiquetas_inventario_impresas(
        producto_ids=[pid],
        user_id=world.usuario.id,
    )

    pendientes, _ = servicio.get_all_products(
        user_id=world.usuario.id,
        etiqueta_impresa_filtro="no",
        size=500,
    )
    ids_pendientes = {p["id"] for p in pendientes}

    impresas, _ = servicio.get_all_products(
        user_id=world.usuario.id,
        etiqueta_impresa_filtro="si",
        size=500,
    )
    ids_impresas = {p["id"] for p in impresas}
    assert pid in ids_impresas
    assert pid not in ids_pendientes
