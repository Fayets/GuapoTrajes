from pony.orm import db_session, select, sum, flush, commit
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError, ConstraintError
from src import models, schemas
from src.models import Producto, EstadoProducto, Sucursal, Roles
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
        "descripcion_libre": p.descripcion_libre,
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
    }
    return d


def _row_to_producto_dict(row) -> dict:
    """Convierte una fila de SQL crudo (get_all_products) al formato de respuesta."""
    # Orden: id, codigo_barra, descripcion, descripcion_libre, costo, ...
    return {
        "id": row[0],
        "codigo_barra": row[1],
        "descripcion": row[2] or "",
        "descripcion_libre": row[3] or None,
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


def _resolver_etiqueta_modista(producto: "models.Producto") -> dict:
    """Título + cliente, fechas y presupuesto desde una orden no cerrada con esta prenda reservada."""
    titulo = (producto.descripcion or "").strip() or f"Producto #{producto.id}"
    cliente_nombre = None
    cliente_celular = None
    fecha_retiro = None
    fecha_evento = None
    presupuesto_numero = None
    try:
        reservas = list(
            models.ProductoReservado.select(lambda pr: pr.producto == producto)
        )
        candidatos = []
        for pr in reservas:
            ord = pr.orden_trabajo
            if not ord:
                continue
            st = (ord.estado or "").strip().lower()
            if st in ("completada", "cancelada"):
                continue
            candidatos.append((pr, ord))
        if candidatos:
            candidatos.sort(key=lambda x: x[1].fecha_creacion, reverse=True)
            _, ord = candidatos[0]
            pres = ord.presupuesto
            if pres:
                if getattr(pres, "numero", None):
                    presupuesto_numero = (pres.numero or "").strip() or None
                if pres.fecha_retiro:
                    fecha_retiro = pres.fecha_retiro.isoformat()
                if pres.fecha_evento:
                    fecha_evento = pres.fecha_evento.isoformat()
                if pres.cliente:
                    cliente_nombre = f"{pres.cliente.apellido} {pres.cliente.nombre}".strip()
                    if pres.cliente.celular:
                        cliente_celular = (pres.cliente.celular or "").strip() or None
                elif pres.precliente:
                    cliente_nombre = f"{pres.precliente.apellido} {pres.precliente.nombre}".strip()
                    if pres.precliente.celular:
                        cliente_celular = (pres.precliente.celular or "").strip() or None
    except Exception:
        pass
    return {
        "titulo": titulo,
        "cliente_nombre": cliente_nombre,
        "cliente_celular": cliente_celular,
        "fecha_retiro": fecha_retiro,
        "fecha_evento": fecha_evento,
        "presupuesto_numero": presupuesto_numero,
    }


def _remito_impresion_fila(
    tipo: str,
    destino,
    producto: "models.Producto",
    datos: dict,
    fecha_envio: date,
) -> dict:
    """Una fila de datos para remito / impresión administrativa (modista o lavandería)."""
    tel = getattr(destino, "telefono", None)
    dire = getattr(destino, "direccion", None)
    tel_s = (tel or "").strip() if isinstance(tel, str) else None
    dir_s = (dire or "").strip() if isinstance(dire, str) else None
    nombre = (getattr(destino, "nombre", None) or "").strip() or "—"
    return {
        "tipo": tipo,
        "destino_nombre": nombre,
        "destino_telefono": tel_s or None,
        "destino_direccion": dir_s or None,
        "fecha_envio": fecha_envio.isoformat(),
        "producto_id": producto.id,
        "codigo_barra": producto.codigo_barra,
        "titulo": datos.get("titulo"),
        "cliente_nombre": datos.get("cliente_nombre"),
        "cliente_celular": datos.get("cliente_celular"),
        "fecha_retiro": datos.get("fecha_retiro"),
        "fecha_evento": datos.get("fecha_evento"),
        "presupuesto_numero": datos.get("presupuesto_numero"),
    }


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
                        libre = (producto_data.descripcion_libre or "").strip() or None

                        producto = models.Producto(
                            codigo_barra=codigo_barra,
                            linea=linea_obj,
                            talle=talle_obj,
                            tela=tela_obj,
                            color=color_obj,
                            descripcion=descripcion,
                            descripcion_libre=libre,
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
        user_id: Optional[int] = None
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

                # Construir WHERE con valores controlados (seguro frente a inyección)
                conditions = []
                if not is_admin and user.sucursal:
                    conditions.append(f'p.sucursal = {int(user.sucursal.id)}')
                if estado_enum is not None:
                    conditions.append(f"p.estado = '{estado_enum.value}'")
                if linea_id is not None:
                    conditions.append(f'p.linea_id = {int(linea_id)}')
                if talle_id is not None:
                    conditions.append(f'p.talle_id = {int(talle_id)}')
                if tela_id is not None:
                    conditions.append(f'p.tela_id = {int(tela_id)}')
                if color_id is not None:
                    conditions.append(f'p.color_id = {int(color_id)}')
                where_sql = ' AND '.join(conditions) if conditions else '1=1'
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
                select_sql = '''
                    SELECT p.id, p.codigo_barra, p.descripcion, p.descripcion_libre, p.costo, p.precio_alquiler_lista,
                    p.precio_alquiler_efectivo, p.precio_venta_nuevo_lista, p.precio_venta_nuevo_efectivo,
                    p.precio_de_venta_medio_uso, p.precio_venta, p.precio_liquidacion, p.stock, p.stock_minimo,
                    p.fecha_alta, p.estado, p.sucursal, p.inmovilizado, p.veces_alquilado,
                    p.linea_id, pl.nombre, p.talle_id, pt.nombre, p.tela_id, ptel.nombre, p.color_id, pc.nombre
                ''' + base_sql + f' ORDER BY p.id LIMIT {size} OFFSET {offset}'
                conn = db.get_connection()
                cur = conn.cursor()
                cur.execute(count_sql)
                total = int(cur.fetchone()[0])
                cur.execute(select_sql)
                rows = cur.fetchall()
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
                # El título automático no se edita manualmente por este payload
                update_data.pop("descripcion", None)

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

                attrs_titulo = ("linea", "talle", "tela", "color")
                recalcular_titulo = any(k in update_data for k in attrs_titulo)

                for k, v in update_data.items():
                    setattr(producto, k, v)

                if recalcular_titulo:
                    producto.descripcion = _build_descripcion(
                        producto.linea, producto.talle, producto.tela, producto.color
                    )

                flush()
                commit()

                return {
                    "message": "Producto actualizado correctamente",
                    "producto": _producto_to_response_dict(producto)
                }

            except Exception as e:
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error al actualizar el producto: {str(e)}")

    def update_estado_producto(
        self,
        id: int,
        nuevo_estado: str,
        user,
        modista_id: Optional[int] = None,
        lavanderia_id: Optional[int] = None,
    ) -> dict:
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

                etiqueta_modista = None
                remito_impresion = None
                hoy = date.today()

                if estado_enum == EstadoProducto.LAVANDERIA:
                    if lavanderia_id is None:
                        raise HTTPException(
                            status_code=400,
                            detail="Debe indicar lavanderia_id al enviar el producto a lavandería.",
                        )
                    lavanderia = models.Lavanderia.get(id=lavanderia_id)
                    if not lavanderia:
                        raise HTTPException(status_code=404, detail="Lavandería no encontrada")
                    datos_lav = _resolver_etiqueta_modista(producto)
                    for pl in list(producto.productos_lavanderias):
                        if pl.fecha_salida is None:
                            pl.fecha_salida = hoy
                    pl_kwargs = {
                        "producto": producto,
                        "lavanderia": lavanderia,
                        "fecha_ingreso": hoy,
                    }
                    cn = datos_lav.get("cliente_nombre")
                    if cn:
                        pl_kwargs["cliente_nombre"] = cn
                    cc = datos_lav.get("cliente_celular")
                    if cc:
                        pl_kwargs["cliente_celular"] = cc
                    models.ProductoLavanderia(**pl_kwargs)
                    remito_impresion = _remito_impresion_fila(
                        "LAVANDERIA", lavanderia, producto, datos_lav, hoy
                    )

                if estado_enum == EstadoProducto.MODISTA:
                    if modista_id is None:
                        raise HTTPException(
                            status_code=400,
                            detail="Debe indicar modista_id al enviar el producto a modista.",
                        )
                    modista = models.Modista.get(id=modista_id)
                    if not modista:
                        raise HTTPException(status_code=404, detail="Modista no encontrada")
                    datos_et = _resolver_etiqueta_modista(producto)
                    for pm in list(producto.productos_modistas):
                        if pm.fecha_salida is None:
                            pm.fecha_salida = hoy
                    # No pasar None explícito en Optional(str): Pony puede rechazarlo según mapeo/versión.
                    pm_kwargs = {
                        "producto": producto,
                        "modista": modista,
                        "fecha_ingreso": hoy,
                    }
                    cn = datos_et.get("cliente_nombre")
                    if cn:
                        pm_kwargs["cliente_nombre"] = cn
                    cc = datos_et.get("cliente_celular")
                    if cc:
                        pm_kwargs["cliente_celular"] = cc
                    models.ProductoModista(**pm_kwargs)
                    etiqueta_modista = datos_et
                    remito_impresion = _remito_impresion_fila(
                        "MODISTA", modista, producto, datos_et, hoy
                    )

                producto.estado = estado_enum

                if estado_enum == EstadoProducto.SALON and producto.stock <= 0:
                    producto.stock = 1
                elif estado_enum == EstadoProducto.VENDIDO:
                    producto.stock = 0

                flush()

                out = {
                    "message": "Estado actualizado correctamente",
                    "success": True,
                    "data": _producto_to_response_dict(producto),
                }
                if etiqueta_modista is not None:
                    out["etiqueta_modista"] = etiqueta_modista
                if remito_impresion is not None:
                    out["remito_impresion"] = remito_impresion
                return out
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

    def aplicar_ajuste_masivo_precios(
        self, req: "schemas.AjusteMasivoPreciosRequest", user
    ) -> dict:
        role = getattr(user.rol, "value", str(user.rol))
        if role not in ("ADMIN", "SUPER_ADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Solo administradores pueden aplicar ajustes masivos.",
            )
        ALLOWED = frozenset({
            "precio_alquiler_lista",
            "precio_alquiler_efectivo",
            "precio_venta_nuevo_lista",
            "precio_venta_nuevo_efectivo",
            "precio_de_venta_medio_uso",
            "precio_venta",
            "precio_liquidacion",
            "costo",
        })
        for c in req.campos_precio:
            if c not in ALLOWED:
                raise HTTPException(
                    status_code=400,
                    detail=f"Campo de precio no permitido: {c}",
                )
        with db_session:
            linea = models.ProductoLinea.get(id=req.linea_id)
            if not linea:
                raise HTTPException(status_code=404, detail="Línea no encontrada")
            productos = []
            for p in models.Producto.select():
                if p.linea is None or p.linea.id != req.linea_id:
                    continue
                if req.sucursal_id is not None and p.sucursal.id != req.sucursal_id:
                    continue
                productos.append(p)
            if not productos:
                return {
                    "message": "No hay productos que coincidan con el filtro.",
                    "success": True,
                    "data": {"actualizados": 0},
                }
            sign = 1 if req.direccion == "aumento" else -1
            for p in productos:
                for campo in req.campos_precio:
                    old = float(getattr(p, campo))
                    if req.modo == "porcentaje":
                        factor = 1.0 + sign * (req.valor / 100.0)
                        new_v = old * factor
                    else:
                        new_v = old + sign * req.valor
                    new_v = round(max(0.0, new_v) / 100.0) * 100.0
                    setattr(p, campo, float(new_v))
            flush()
            commit()
            return {
                "message": f"Ajuste aplicado a {len(productos)} producto(s).",
                "success": True,
                "data": {"actualizados": len(productos)},
            }

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
