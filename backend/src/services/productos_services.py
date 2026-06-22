from pony.orm import db_session, select, sum, flush, commit
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError, ConstraintError
from src import models, schemas
from src.models import Producto, EstadoProducto, Sucursal, Roles
from src.services.disponibilidad_services import (
    verificar_disponibilidad,
    producto_ids_en_ventana_reserva_el_dia,
)
from src.db import db
from datetime import datetime, date
from typing import Optional, Tuple, List, Dict
import traceback


def _producto_to_response_dict(p: "models.Producto") -> dict:
    """Serializa un Producto incluyendo linea_id/nombre, talle_id/nombre, etc."""
    d = {
        "id": p.id,
        "codigo_barra": p.codigo_barra,
        "descripcion": p.descripcion,
        "descripcion_extra": p.descripcion_extra,
        "costo": p.costo,
        "precio_alquiler_lista": p.precio_alquiler_lista,
        "precio_alquiler_efectivo": p.precio_alquiler_efectivo,
        "precio_venta_nuevo_lista": p.precio_venta_nuevo_lista,
        "precio_venta_nuevo_efectivo": p.precio_venta_nuevo_efectivo,
        "precio_de_venta_medio_uso": p.precio_de_venta_medio_uso,
        "precio_venta": p.precio_venta,
        "precio_liquidacion": p.precio_liquidacion,
        "stock": p.stock,
        "stock_minimo": p.stock_minimo,
        "fecha_alta": p.fecha_alta,
        "estado": p.estado,
        "sucursal_id": p.sucursal.id,
        "inmovilizado": p.inmovilizado,
        "veces_alquilado": p.veces_alquilado,
        "linea_id": p.linea.id if p.linea else None,
        "linea_nombre": p.linea.nombre if p.linea else None,
        "talle_id": p.talle.id if p.talle else None,
        "talle_nombre": p.talle.nombre if p.talle else None,
        "tela_id": p.tela.id if p.tela else None,
        "tela_nombre": p.tela.nombre if p.tela else None,
        "color_id": p.color.id if p.color else None,
        "color_nombre": p.color.nombre if p.color else None,
        "disponible_en_fechas": None,
        "en_ventana_reserva_hoy": None,
        "etiqueta_inventario_impresa_at": getattr(p, "etiqueta_inventario_impresa_at", None),
    }
    return d


def _sql_ilike_pattern(term: str) -> str:
    """Patrón ILIKE seguro para concatenar en SQL crudo (escapa comillas y wildcards)."""
    s = term.strip().replace("'", "''")
    for char, escaped in (("\\", "\\\\"), ("%", "\\%"), ("_", "\\_")):
        s = s.replace(char, escaped)
    return f"%{s}%"


def _build_productos_where_conditions(
    *,
    is_admin: bool,
    sucursal_id: Optional[int],
    estado_enum: Optional[EstadoProducto] = None,
    linea_id: Optional[int] = None,
    talle_id: Optional[int] = None,
    tela_id: Optional[int] = None,
    color_id: Optional[int] = None,
    reserved_ids: Optional[set[int]] = None,
    ventana_reserva_filtro: Optional[str] = None,
    q: Optional[str] = None,
    etiqueta_impresa_filtro: Optional[str] = None,
) -> str:
    """Construye cláusula WHERE para listados y stats de productos."""
    conditions = []
    if not is_admin and sucursal_id is not None:
        conditions.append(f"p.sucursal = {int(sucursal_id)}")
    if estado_enum is not None:
        conditions.append(f"p.estado = '{estado_enum.value}'")
    if linea_id is not None:
        conditions.append(f"p.linea_id = {int(linea_id)}")
    if talle_id is not None:
        conditions.append(f"p.talle_id = {int(talle_id)}")
    if tela_id is not None:
        conditions.append(f"p.tela_id = {int(tela_id)}")
    if color_id is not None:
        conditions.append(f"p.color_id = {int(color_id)}")

    vf = (ventana_reserva_filtro or "").strip().lower()
    reserved_ids = reserved_ids or set()
    if vf == "si":
        if not reserved_ids:
            conditions.append("1=0")
        else:
            ids_sql = ",".join(str(int(i)) for i in sorted(reserved_ids))
            conditions.append(f"p.id IN ({ids_sql})")
    elif vf == "no":
        if reserved_ids:
            ids_sql = ",".join(str(int(i)) for i in sorted(reserved_ids))
            conditions.append(f"p.id NOT IN ({ids_sql})")

    ei = (etiqueta_impresa_filtro or "").strip().lower()
    if ei == "si":
        conditions.append("p.etiqueta_inventario_impresa_at IS NOT NULL")
    elif ei == "no":
        conditions.append("p.etiqueta_inventario_impresa_at IS NULL")

    search_term = (q or "").strip()
    if search_term:
        pattern = _sql_ilike_pattern(search_term)
        conditions.append(
            "("
            f"p.codigo_barra ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"p.descripcion ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"COALESCE(p.descripcion_extra, '') ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"COALESCE(pl.nombre, '') ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"COALESCE(pt.nombre, '') ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"COALESCE(ptel.nombre, '') ILIKE '{pattern}' ESCAPE E'\\\\' OR "
            f"COALESCE(pc.nombre, '') ILIKE '{pattern}' ESCAPE E'\\\\'"
            ")"
        )

    return " AND ".join(conditions) if conditions else "1=1"


def _row_to_producto_dict(row) -> dict:
    """Convierte una fila de SQL crudo (get_all_products) al formato de respuesta."""
    # Orden: id, codigo_barra, descripcion, descripcion_extra, costo, precio_alquiler_lista, precio_alquiler_efectivo,
    # precio_venta_nuevo_lista, precio_venta_nuevo_efectivo, precio_de_venta_medio_uso, precio_venta,
    # precio_liquidacion, stock, stock_minimo, fecha_alta, estado, sucursal_id, inmovilizado, veces_alquilado,
    # linea_id, linea_nombre, talle_id, talle_nombre, tela_id, tela_nombre, color_id, color_nombre
    return {
        "id": row[0],
        "codigo_barra": row[1],
        "descripcion": row[2] or "",
        "descripcion_extra": row[3] or "",
        "costo": float(row[4]),
        "precio_alquiler_lista": float(row[5]),
        "precio_alquiler_efectivo": float(row[6]),
        "precio_venta_nuevo_lista": float(row[7]),
        "precio_venta_nuevo_efectivo": float(row[8]),
        "precio_de_venta_medio_uso": float(row[9]),
        "precio_venta": float(row[10]),
        "precio_liquidacion": float(row[11]),
        "stock": int(row[12]),
        "stock_minimo": int(row[13]),
        "fecha_alta": row[14],
        "estado": row[15],
        "sucursal_id": row[16],
        "inmovilizado": bool(row[17]),
        "veces_alquilado": int(row[18] or 0),
        "linea_id": row[19],
        "linea_nombre": row[20],
        "talle_id": row[21],
        "talle_nombre": row[22],
        "tela_id": row[23],
        "tela_nombre": row[24],
        "color_id": row[25],
        "color_nombre": row[26],
        "destino_tipo": None,
        "destino_nombre": None,
        "destino_notas": None,
        "destino_cliente_nombre": None,
        "destino_cliente_celular": None,
        "disponible_en_fechas": None,
        "en_ventana_reserva_hoy": None,
        "etiqueta_inventario_impresa_at": row[27] if len(row) > 27 else None,
    }


def _obtener_prefijo_codigo_barra(linea_id: int, talle_id: int, tela_id: int, color_id: int) -> str:
    linea = models.ProductoLinea.get(id=linea_id)
    talle = models.ProductoTalle.get(id=talle_id)
    tela = models.ProductoTela.get(id=tela_id)
    color = models.ProductoColor.get(id=color_id)
    if not (linea and talle and tela and color):
        raise HTTPException(status_code=400, detail="Línea, talle, tela o color no encontrados.")
    if not (linea.codigo and talle.codigo and tela.codigo and color.codigo):
        raise HTTPException(status_code=400, detail="Los atributos seleccionados no tienen código configurado.")
    return f"{linea.codigo}{talle.codigo}{tela.codigo}{color.codigo}"


def _build_descripcion(linea, talle, tela, color) -> str:
    """Arma la descripción como suma de atributos en mayúsculas."""
    partes = []
    if linea is not None and getattr(linea, "nombre", None):
        partes.append(str(linea.nombre).upper())
    if talle is not None and getattr(talle, "nombre", None):
        partes.append(str(talle.nombre).upper())
    if tela is not None and getattr(tela, "nombre", None):
        partes.append(str(tela.nombre).upper())
    if color is not None and getattr(color, "nombre", None):
        partes.append(str(color.nombre).upper())
    return " ".join(partes)


class ProductoServices:
    def __init__(self):
        pass

    # Crear producto
    def create_producto(self, producto_data: schemas.ProductCreate) -> dict:
        with db_session:
            try:
                sucursal_obj = models.Sucursal.get(id=producto_data.sucursal_id)
                if not sucursal_obj:
                    raise HTTPException(status_code=400, detail="Sucursal no encontrada.")

                # Validar que se hayan enviado todos los atributos necesarios para el código de barras
                if not (producto_data.linea_id and producto_data.talle_id and producto_data.tela_id and producto_data.color_id):
                    raise HTTPException(
                        status_code=400,
                        detail="Para generar el código de barras se requieren linea_id, talle_id, tela_id y color_id."
                    )

                # Convertir fecha y estado
                fecha_alta = producto_data.fecha_alta
                if isinstance(fecha_alta, str):
                    try:
                        fecha_alta = datetime.strptime(fecha_alta, "%Y-%m-%d").date()
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Formato de fecha incorrecto.")

                try:
                    estado = EstadoProducto(producto_data.estado)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Estado inválido.")

                # Intentar generar y guardar un código de barras único, con reintentos por concurrencia
                max_retries = 5
                last_error = None
                for _ in range(max_retries):
                    try:
                        codigo_barra = self.generar_codigo_barra(
                            linea_id=producto_data.linea_id,
                            talle_id=producto_data.talle_id,
                            tela_id=producto_data.tela_id,
                            color_id=producto_data.color_id,
                        )

                        linea_obj = models.ProductoLinea.get(id=producto_data.linea_id)
                        talle_obj = models.ProductoTalle.get(id=producto_data.talle_id)
                        tela_obj = models.ProductoTela.get(id=producto_data.tela_id)
                        color_obj = models.ProductoColor.get(id=producto_data.color_id)
                        descripcion = _build_descripcion(linea_obj, talle_obj, tela_obj, color_obj)

                        producto = models.Producto(
                            codigo_barra=codigo_barra,
                            linea=linea_obj,
                            talle=talle_obj,
                            tela=tela_obj,
                            color=color_obj,
                            descripcion=descripcion,
                            descripcion_extra=(producto_data.descripcion_extra or "").strip() or None,
                            costo=producto_data.costo,
                            precio_alquiler_lista=producto_data.precio_alquiler_lista,
                            precio_alquiler_efectivo=producto_data.precio_alquiler_efectivo,
                            precio_venta_nuevo_lista=producto_data.precio_venta_nuevo_lista,
                            precio_venta_nuevo_efectivo=producto_data.precio_venta_nuevo_efectivo,
                            precio_de_venta_medio_uso=producto_data.precio_de_venta_medio_uso,
                            precio_venta=producto_data.precio_venta,
                            precio_liquidacion=producto_data.precio_liquidacion,
                            stock=producto_data.stock,
                            stock_minimo=producto_data.stock_minimo,
                            fecha_alta=fecha_alta,
                            estado=estado,
                            sucursal=sucursal_obj,
                            inmovilizado=producto_data.inmovilizado
                        )

                        return _producto_to_response_dict(producto)

                    except (ConstraintError, TransactionIntegrityError) as ce:
                        # Conflicto de unique (posible condición de carrera); reintentar
                        last_error = ce
                        continue

                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"No se pudo generar un código de barras único después de varios intentos: {last_error}"
                )

            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error general al crear el producto: {str(e)}"
                )

    def generar_codigo_barra(
        self,
        linea_id: int,
        talle_id: int,
        tela_id: int,
        color_id: int,
    ) -> str:
        """
        Genera un código de barras con estructura:
        LLL TT FF CC II
        usando los códigos de los catálogos y buscando el último producto con ese prefijo.
        """
        prefijo = _obtener_prefijo_codigo_barra(linea_id, talle_id, tela_id, color_id)
        patron = prefijo + "__"

        # Usar SQL crudo para evitar problemas de bytecode con Pony en Python 3.12+
        conn = db.get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                'SELECT "codigo_barra" FROM "Productos" WHERE "codigo_barra" LIKE %s ORDER BY "codigo_barra" DESC LIMIT 1',
                (patron,),
            )
            row = cur.fetchone()
        finally:
            cur.close()

        if row and row[0]:
            ultimo = str(row[0])
            sufijo_actual = ultimo[-2:]
            try:
                n = int(sufijo_actual)
            except ValueError:
                n = 0
            siguiente = max(1, n + 1)
        else:
            siguiente = 1

        sufijo = f"{siguiente:02d}"
        return prefijo + sufijo

    # Obtener producto por código de barras
    def get_product_by_code(self, codigo_barra: str):
        with db_session:
            try:
                producto = models.Producto.get(codigo_barra=codigo_barra)
                if not producto:
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                return _producto_to_response_dict(producto)

            except Exception as e:
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al obtener el producto: {str(e)}")

    # Obtener todos los productos (filtro por estado, linea_id, talle_id, tela_id, color_id y paginación)
    # Usamos SQL crudo para evitar el descompilador de Pony en Python 3.12+ (CACHE + JUMP_BACKWARD).
    def get_all_products(
        self,
        estado: Optional[str] = None,
        linea_id: Optional[int] = None,
        talle_id: Optional[int] = None,
        tela_id: Optional[int] = None,
        color_id: Optional[int] = None,
        page: int = 1,
        size: int = 20,
        user_id: Optional[int] = None,
        fecha_retiro: Optional[date] = None,
        fecha_devolucion: Optional[date] = None,
        presupuesto_excluir_id: Optional[int] = None,
        orden_excluir_id: Optional[int] = None,
        incluir_ventana_reserva: bool = False,
        ventana_reserva_filtro: Optional[str] = None,
        q: Optional[str] = None,
        etiqueta_impresa_filtro: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        with db_session:
            try:
                user = models.Usuario.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                is_admin = user.rol in (Roles.ADMIN, Roles.SUPER_ADMIN)
                if not is_admin and not user.sucursal:
                    return [], 0
                estado_enum = None
                if estado:
                    try:
                        estado_enum = EstadoProducto(estado)
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Estado inválido.")

                reserved_ids: set[int] = set()
                vf = (ventana_reserva_filtro or "").strip().lower()
                if incluir_ventana_reserva or vf in ("si", "no"):
                    reserved_ids = producto_ids_en_ventana_reserva_el_dia()

                # Construir WHERE con valores controlados (seguro frente a inyección)
                where_sql = _build_productos_where_conditions(
                    is_admin=is_admin,
                    sucursal_id=user.sucursal.id if (not is_admin and user.sucursal) else None,
                    estado_enum=estado_enum,
                    linea_id=linea_id,
                    talle_id=talle_id,
                    tela_id=tela_id,
                    color_id=color_id,
                    reserved_ids=reserved_ids,
                    ventana_reserva_filtro=ventana_reserva_filtro,
                    q=q,
                    etiqueta_impresa_filtro=etiqueta_impresa_filtro,
                )
                page = max(1, int(page))
                size = max(1, min(int(size), 500))
                offset = (page - 1) * size

                base_sql = '''
                    FROM "Productos" p
                    LEFT JOIN "ProductoLineas" pl ON p.linea_id = pl.id
                    LEFT JOIN "ProductoTalles" pt ON p.talle_id = pt.id
                    LEFT JOIN "ProductoTelas" ptel ON p.tela_id = ptel.id
                    LEFT JOIN "ProductoColores" pc ON p.color_id = pc.id
                    WHERE ''' + where_sql
                count_sql = 'SELECT COUNT(p.id) ' + base_sql
                select_sql_con_desc_extra = '''
                    SELECT p.id, p.codigo_barra, p.descripcion, p.descripcion_extra, p.costo, p.precio_alquiler_lista,
                    p.precio_alquiler_efectivo, p.precio_venta_nuevo_lista, p.precio_venta_nuevo_efectivo,
                    p.precio_de_venta_medio_uso, p.precio_venta, p.precio_liquidacion, p.stock, p.stock_minimo,
                    p.fecha_alta, p.estado, p.sucursal, p.inmovilizado, p.veces_alquilado,
                    p.linea_id, pl.nombre, p.talle_id, pt.nombre, p.tela_id, ptel.nombre, p.color_id, pc.nombre,
                    p.etiqueta_inventario_impresa_at
                ''' + base_sql + f' ORDER BY p.id DESC LIMIT {size} OFFSET {offset}'
                select_sql_sin_desc_extra = '''
                    SELECT p.id, p.codigo_barra, p.descripcion, '' AS descripcion_extra, p.costo, p.precio_alquiler_lista,
                    p.precio_alquiler_efectivo, p.precio_venta_nuevo_lista, p.precio_venta_nuevo_efectivo,
                    p.precio_de_venta_medio_uso, p.precio_venta, p.precio_liquidacion, p.stock, p.stock_minimo,
                    p.fecha_alta, p.estado, p.sucursal, p.inmovilizado, p.veces_alquilado,
                    p.linea_id, pl.nombre, p.talle_id, pt.nombre, p.tela_id, ptel.nombre, p.color_id, pc.nombre,
                    p.etiqueta_inventario_impresa_at
                ''' + base_sql + f' ORDER BY p.id DESC LIMIT {size} OFFSET {offset}'
                select_sql_sin_etiqueta_col = '''
                    SELECT p.id, p.codigo_barra, p.descripcion, p.descripcion_extra, p.costo, p.precio_alquiler_lista,
                    p.precio_alquiler_efectivo, p.precio_venta_nuevo_lista, p.precio_venta_nuevo_efectivo,
                    p.precio_de_venta_medio_uso, p.precio_venta, p.precio_liquidacion, p.stock, p.stock_minimo,
                    p.fecha_alta, p.estado, p.sucursal, p.inmovilizado, p.veces_alquilado,
                    p.linea_id, pl.nombre, p.talle_id, pt.nombre, p.tela_id, ptel.nombre, p.color_id, pc.nombre
                ''' + base_sql + f' ORDER BY p.id DESC LIMIT {size} OFFSET {offset}'
                select_sql_sin_etiqueta_sin_desc_extra = '''
                    SELECT p.id, p.codigo_barra, p.descripcion, '' AS descripcion_extra, p.costo, p.precio_alquiler_lista,
                    p.precio_alquiler_efectivo, p.precio_venta_nuevo_lista, p.precio_venta_nuevo_efectivo,
                    p.precio_de_venta_medio_uso, p.precio_venta, p.precio_liquidacion, p.stock, p.stock_minimo,
                    p.fecha_alta, p.estado, p.sucursal, p.inmovilizado, p.veces_alquilado,
                    p.linea_id, pl.nombre, p.talle_id, pt.nombre, p.tela_id, ptel.nombre, p.color_id, pc.nombre
                ''' + base_sql + f' ORDER BY p.id DESC LIMIT {size} OFFSET {offset}'
                conn = db.get_connection()
                cur = conn.cursor()
                cur.execute(count_sql)
                total = int(cur.fetchone()[0])
                rows = None
                for sql in (
                    select_sql_con_desc_extra,
                    select_sql_sin_desc_extra,
                    select_sql_sin_etiqueta_col,
                    select_sql_sin_etiqueta_sin_desc_extra,
                ):
                    try:
                        cur.execute(sql)
                        rows = cur.fetchall()
                        break
                    except Exception:
                        continue
                if rows is None:
                    raise HTTPException(
                        status_code=500,
                        detail="Error al consultar productos (esquema incompatible).",
                    )
                cur.close()
                result = [_row_to_producto_dict(row) for row in rows]
                # Enriquecer con destino (lavandería/modista) cargando por producto para evitar problemas de sesión
                for r in result:
                    estado = (r.get("estado") or "").strip().upper()
                    if estado == "LAVANDERIA":
                        r["destino_tipo"] = "LAVANDERIA"
                        p = models.Producto.get(id=r["id"])
                        if p:
                            activos = sorted(
                                [pl for pl in p.productos_lavanderias if pl.fecha_salida is None],
                                key=lambda pl: (pl.fecha_ingreso, pl.id),
                                reverse=True,
                            )
                            if activos:
                                pl = activos[0]
                                r["destino_nombre"] = pl.lavanderia.nombre
                                r["destino_notas"] = getattr(pl, "notas", None)
                                r["destino_cliente_nombre"] = getattr(pl, "cliente_nombre", None)
                                r["destino_cliente_celular"] = getattr(pl, "cliente_celular", None)
                    elif estado == "MODISTA":
                        r["destino_tipo"] = "MODISTA"
                        p = models.Producto.get(id=r["id"])
                        if p:
                            activos = sorted(
                                [pm for pm in p.productos_modistas if pm.fecha_salida is None],
                                key=lambda pm: (pm.fecha_ingreso, pm.id),
                                reverse=True,
                            )
                            if activos:
                                pm = activos[0]
                                r["destino_nombre"] = pm.modista.nombre
                                r["destino_notas"] = getattr(pm, "notas", None)
                                r["destino_cliente_nombre"] = getattr(pm, "cliente_nombre", None)
                                r["destino_cliente_celular"] = getattr(pm, "cliente_celular", None)
                if fecha_retiro is not None and fecha_devolucion is not None:
                    for r in result:
                        r["disponible_en_fechas"] = verificar_disponibilidad(
                            r["id"],
                            fecha_retiro,
                            fecha_devolucion,
                            presupuesto_excluir_id,
                            orden_excluir_id,
                        )
                else:
                    for r in result:
                        r["disponible_en_fechas"] = None

                if incluir_ventana_reserva or vf in ("si", "no"):
                    for r in result:
                        r["en_ventana_reserva_hoy"] = r["id"] in reserved_ids
                else:
                    for r in result:
                        r["en_ventana_reserva_hoy"] = None

                return result, total

            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                err_msg = str(e)
                print(f"Error al obtener los productos: {e}")
                raise HTTPException(status_code=500, detail=f"Error al obtener los productos: {err_msg}")

    # Actualizar producto por ID
    def update_product(self, id: int, producto_update: schemas.ProductUpdate) -> dict:
        with db_session:
            try:
                producto = models.Producto.get(id=id)
                if not producto:
                    print("❗ Producto no encontrado con ID:", id)
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                update_data = producto_update.model_dump(exclude_unset=True)
                print("🧪 update_data recibido:", update_data)

                # Validación de sucursal
                if "sucursal_id" in update_data:
                    sucursal_obj = models.Sucursal.get(id=update_data["sucursal_id"])
                    if not sucursal_obj:
                        print("⚠️ Sucursal no encontrada")
                        raise HTTPException(status_code=400, detail="Sucursal no encontrada.")
                    update_data["sucursal"] = sucursal_obj
                    del update_data["sucursal_id"]

                # Validación de estado (Enum)
                if "estado" in update_data:
                    try:
                        update_data["estado"] = EstadoProducto(update_data["estado"])
                    except ValueError:
                        print("⚠️ Estado inválido")
                        raise HTTPException(status_code=400, detail="Estado inválido.")

                # Resolver FKs de atributos
                if "linea_id" in update_data:
                    v = update_data.pop("linea_id")
                    update_data["linea"] = models.ProductoLinea.get(id=v) if v else None
                if "talle_id" in update_data:
                    v = update_data.pop("talle_id")
                    update_data["talle"] = models.ProductoTalle.get(id=v) if v else None
                if "tela_id" in update_data:
                    v = update_data.pop("tela_id")
                    update_data["tela"] = models.ProductoTela.get(id=v) if v else None
                if "color_id" in update_data:
                    v = update_data.pop("color_id")
                    update_data["color"] = models.ProductoColor.get(id=v) if v else None

                if "descripcion_extra" in update_data:
                    update_data["descripcion_extra"] = (
                        str(update_data["descripcion_extra"]).strip() or None
                        if update_data["descripcion_extra"] is not None
                        else None
                    )

                for k, v in update_data.items():
                    setattr(producto, k, v)

                flush()
                commit()

                return {
                    "message": "Producto actualizado correctamente",
                    "producto": _producto_to_response_dict(producto)
                }

            except Exception as e:
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al actualizar el producto: {str(e)}")

    def update_prices_bulk(self, data: schemas.ProductBulkPriceUpdateRequest) -> dict:
        with db_session:
            try:
                campos_validos = {
                    "precio_alquiler_lista",
                    "precio_alquiler_efectivo",
                    "precio_venta_nuevo_lista",
                    "precio_venta_nuevo_efectivo",
                    "precio_de_venta_medio_uso",
                    "precio_venta",
                    "precio_liquidacion",
                }
                campos = [c for c in data.campos if c in campos_validos]
                if not campos:
                    raise HTTPException(status_code=400, detail="No hay campos de precio válidos.")

                productos = list(models.Producto.select())
                if data.linea_ids:
                    linea_set = set(data.linea_ids)
                    productos = [p for p in productos if p.linea and p.linea.id in linea_set]
                if data.talle_ids:
                    talle_set = set(data.talle_ids)
                    productos = [p for p in productos if p.talle and p.talle.id in talle_set]
                if data.tela_ids:
                    tela_set = set(data.tela_ids)
                    productos = [p for p in productos if p.tela and p.tela.id in tela_set]
                if data.color_ids:
                    color_set = set(data.color_ids)
                    productos = [p for p in productos if p.color and p.color.id in color_set]
                if data.estado:
                    productos = [
                        p
                        for p in productos
                        if (p.estado.value if hasattr(p.estado, "value") else str(p.estado)) == data.estado
                    ]
                if data.solo_ids:
                    ids = set(data.solo_ids)
                    productos = [p for p in productos if p.id in ids]

                ids_afectados: List[int] = []
                errores: List[str] = []
                for p in productos:
                    try:
                        for campo in campos:
                            actual = float(getattr(p, campo) or 0.0)
                            if data.modo == "porcentaje":
                                nuevo = actual * (1.0 + (data.valor / 100.0))
                            else:
                                nuevo = actual + float(data.valor)
                            setattr(p, campo, round(max(0.0, nuevo), 2))
                        ids_afectados.append(p.id)
                    except Exception as e:
                        errores.append(f"Producto {p.id}: {str(e)}")

                flush()
                commit()
                return {
                    "total_encontrados": len(productos),
                    "total_actualizados": len(ids_afectados),
                    "ids_afectados": ids_afectados,
                    "errores": errores,
                }
            except HTTPException:
                raise
            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500, detail=f"Error al actualizar precios masivos: {str(e)}"
                )

    def update_estado_producto(self, id: int, nuevo_estado: str, user) -> dict:
        with db_session:
            try:
                producto = models.Producto.get(id=id)
                if not producto:
                    raise HTTPException(status_code=404, detail="Producto no encontrado")

                if user.rol not in {Roles.ADMIN, Roles.EMPLEADO}:
                    raise HTTPException(status_code=403, detail="Permiso denegado")

                try:
                    estado_enum = EstadoProducto(nuevo_estado)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Estado inválido.")

                producto.estado = estado_enum

                if estado_enum == EstadoProducto.SALON and producto.stock <= 0:
                    producto.stock = 1
                elif estado_enum == EstadoProducto.VENDIDO:
                    producto.stock = 0

                flush()

                return {
                    "message": "Estado actualizado correctamente",
                    "success": True,
                    "data": _producto_to_response_dict(producto)
                }
            except HTTPException:
                raise
            except Exception as e:
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al actualizar el estado: {str(e)}")

    # Eliminar producto por código de barras
    def delete_product(self, codigo_barra: str):
        with db_session:
            try:
                producto = models.Producto.get(codigo_barra=codigo_barra)
                if not producto:
                    raise HTTPException(status_code=404, detail="Producto no encontrado")
                producto.delete()
                return {"message": "Producto eliminado correctamente"}

            except Exception as e:
                print(f"Error al eliminar el producto: {e}")
                raise HTTPException(status_code=500, detail="Error al eliminar el producto.")

    # Obtener productos con stock bajo
    def get_low_stock_products(self):
        with db_session:
            try:
                productos_bajo_stock = list(models.Producto.select(lambda p: p.stock < p.stock_minimo))
                if not productos_bajo_stock:
                    raise HTTPException(status_code=404, detail="No hay productos con stock bajo.")

                return [_producto_to_response_dict(producto) for producto in productos_bajo_stock]

            except Exception as e:
                print(f"Error al obtener productos con stock bajo: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener productos con stock bajo.")

    # Obtener el total de productos
    def get_total_products(self):
        with db_session:
            try:
                total_productos = models.Producto.select().count()
                return {"total_products": total_productos}

            except Exception as e:
                print(f"Error al obtener la cantidad de productos: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la cantidad de productos.")

    # Obtener el valor total del inventario
    def get_inventory_value(self):
        with db_session:
            try:
                total_valor = sum(p.stock * p.precio_venta for p in models.Producto.select())
                return {"inventory_value": total_valor}

            except Exception as e:
                print(f"Error al obtener el valor del inventario: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener el valor del inventario.")

    # Obtener la cantidad de productos con stock bajo
    def get_low_stock_count(self):
        with db_session:
            try:
                count_low_stock = models.Producto.select(lambda p: p.stock < p.stock_minimo).count()
                return {"low_stock_count": count_low_stock}

            except Exception as e:
                print(f"Error al obtener la cantidad de productos con stock bajo: {e}")
                raise HTTPException(status_code=500, detail="Error al obtener la cantidad de productos con stock bajo.")

    # ===== NUEVO: stats por estado =====
    def get_status_stats(self, user_id: Optional[int] = None) -> Dict[str, int]:
        with db_session:
            try:
                # Obtener usuario
                user = models.Usuario.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                # Si el usuario es ADMIN, puede ver stats de todos los productos
                # Si no, filtra por sucursal
                is_admin = user.rol == Roles.ADMIN
                
                data = {}
                for est in EstadoProducto:
                    if is_admin:
                        # ADMIN ve todos los productos
                        data[est.value] = models.Producto.select(lambda p: p.estado == est).count()
                    else:
                        # Empleado ve solo productos de su sucursal
                        if not user.sucursal:
                            data[est.value] = 0
                        else:
                            sucursal_id = user.sucursal.id
                            data[est.value] = models.Producto.select(lambda p: p.estado == est and p.sucursal.id == sucursal_id).count()
                return data
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"Error al obtener estadísticas por estado: {e}")
                raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas por estado: {str(e)}")

    def get_etiquetas_inventario_stats(
        self,
        user_id: Optional[int] = None,
        linea_id: Optional[int] = None,
        talle_id: Optional[int] = None,
        tela_id: Optional[int] = None,
        color_id: Optional[int] = None,
        q: Optional[str] = None,
    ) -> Dict[str, int]:
        with db_session:
            try:
                user = models.Usuario.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                is_admin = user.rol in (Roles.ADMIN, Roles.SUPER_ADMIN)
                if not is_admin and not user.sucursal:
                    return {"total": 0, "impresos": 0, "pendientes": 0}

                where_sql = _build_productos_where_conditions(
                    is_admin=is_admin,
                    sucursal_id=user.sucursal.id if (not is_admin and user.sucursal) else None,
                    linea_id=linea_id,
                    talle_id=talle_id,
                    tela_id=tela_id,
                    color_id=color_id,
                    q=q,
                )
                base_sql = '''
                    FROM "Productos" p
                    LEFT JOIN "ProductoLineas" pl ON p.linea_id = pl.id
                    LEFT JOIN "ProductoTalles" pt ON p.talle_id = pt.id
                    LEFT JOIN "ProductoTelas" ptel ON p.tela_id = ptel.id
                    LEFT JOIN "ProductoColores" pc ON p.color_id = pc.id
                    WHERE ''' + where_sql

                conn = db.get_connection()
                cur = conn.cursor()
                cur.execute("SELECT COUNT(p.id) " + base_sql)
                total = int(cur.fetchone()[0])
                try:
                    cur.execute(
                        "SELECT COUNT(p.id) " + base_sql
                        + " AND p.etiqueta_inventario_impresa_at IS NOT NULL"
                    )
                    impresos = int(cur.fetchone()[0])
                except Exception:
                    impresos = 0
                pendientes = max(0, total - impresos)
                cur.close()
                return {"total": total, "impresos": impresos, "pendientes": pendientes}
            except HTTPException:
                raise
            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al obtener estadísticas de etiquetas: {str(e)}",
                )

    def registrar_etiquetas_inventario_impresas(
        self, producto_ids: List[int], user_id: Optional[int] = None
    ) -> dict:
        with db_session:
            try:
                if not producto_ids:
                    raise HTTPException(
                        status_code=400, detail="Enviá al menos un producto_id."
                    )

                user = models.Usuario.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                is_admin = user.rol in (Roles.ADMIN, Roles.SUPER_ADMIN)
                now = datetime.now()
                actualizados = 0
                no_encontrados: List[int] = []

                for pid in producto_ids:
                    producto = models.Producto.get(id=int(pid))
                    if not producto:
                        no_encontrados.append(int(pid))
                        continue
                    if not is_admin and user.sucursal:
                        if producto.sucursal.id != user.sucursal.id:
                            continue
                    producto.etiqueta_inventario_impresa_at = now
                    actualizados += 1

                flush()
                return {
                    "message": f"Se registraron {actualizados} etiqueta(s) impresa(s).",
                    "success": True,
                    "data": {
                        "actualizados": actualizados,
                        "no_encontrados": no_encontrados,
                    },
                }
            except HTTPException:
                raise
            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al registrar etiquetas impresas: {str(e)}",
                )

    def reset_etiquetas_inventario(
        self,
        *,
        user_id: Optional[int] = None,
        producto_ids: Optional[List[int]] = None,
        todos: bool = False,
        linea_id: Optional[int] = None,
        talle_id: Optional[int] = None,
        tela_id: Optional[int] = None,
        color_id: Optional[int] = None,
        confirmacion_global: Optional[str] = None,
    ) -> dict:
        with db_session:
            try:
                user = models.Usuario.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")

                if user.rol not in (Roles.ADMIN, Roles.SUPER_ADMIN):
                    raise HTTPException(
                        status_code=403,
                        detail="Solo un administrador puede resetear el progreso.",
                    )

                if todos:
                    user_role = user.rol.value if hasattr(user.rol, "value") else str(user.rol)
                    if user_role != "SUPER_ADMIN":
                        raise HTTPException(
                            status_code=403,
                            detail="Solo SUPER_ADMIN puede resetear todo el inventario.",
                        )
                    if confirmacion_global != "RESETEAR_TODO_INVENTARIO":
                        raise HTTPException(
                            status_code=400,
                            detail="Confirmación global requerida: RESETEAR_TODO_INVENTARIO",
                        )

                is_admin = True
                actualizados = 0

                if todos:
                    productos = models.Producto.select()
                    for p in productos:
                        p.etiqueta_inventario_impresa_at = None
                        actualizados += 1
                elif producto_ids:
                    for pid in producto_ids:
                        p = models.Producto.get(id=int(pid))
                        if p:
                            p.etiqueta_inventario_impresa_at = None
                            actualizados += 1
                else:
                    where_sql = _build_productos_where_conditions(
                        is_admin=is_admin,
                        sucursal_id=None,
                        linea_id=linea_id,
                        talle_id=talle_id,
                        tela_id=tela_id,
                        color_id=color_id,
                    )
                    sql = (
                        'SELECT p.id FROM "Productos" p '
                        'LEFT JOIN "ProductoLineas" pl ON p.linea_id = pl.id '
                        'LEFT JOIN "ProductoTalles" pt ON p.talle_id = pt.id '
                        'LEFT JOIN "ProductoTelas" ptel ON p.tela_id = ptel.id '
                        'LEFT JOIN "ProductoColores" pc ON p.color_id = pc.id '
                        f"WHERE {where_sql}"
                    )
                    conn = db.get_connection()
                    cur = conn.cursor()
                    cur.execute(sql)
                    ids = [int(r[0]) for r in cur.fetchall()]
                    cur.close()
                    for pid in ids:
                        p = models.Producto.get(id=pid)
                        if p:
                            p.etiqueta_inventario_impresa_at = None
                            actualizados += 1

                flush()
                return {
                    "message": f"Se reseteó el progreso de {actualizados} producto(s).",
                    "success": True,
                    "data": {"actualizados": actualizados},
                }
            except HTTPException:
                raise
            except Exception as e:
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al resetear etiquetas: {str(e)}",
                )
