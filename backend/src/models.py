from pony.orm import *
from enum import Enum
from decimal import Decimal
from .db import db
from datetime import date, datetime 

# Definicion de los roles
class Roles(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    EMPLEADO = "EMPLEADO"

class Sucursal(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    direccion = Required(str)
    provincia = Required(str)
    usuarios = Set("Usuario") # UNA SUCURSAL TIENE VARIOS USUARIOS
    productos = Set("Producto")
    ventas = Set("Venta")  # UNA SUCURSAL TIENE VARIAS VENTAS
    movimientos_caja = Set("CajaMovimiento")  # UNA SUCURSAL TIENE VARIOS MOVIMIENTOS DE CAJA
    caja_chica_movimientos = Set("CajaChica")
    caja_concentradora_movimientos = Set("CajaConcentradora")
    cuentas_destino = Set("CuentaDestino")  # UNA SUCURSAL TIENE VARIAS CUENTAS DESTINO
    metodos_pago = Set("MetodoPagoConfigurable")  # UNA SUCURSAL TIENE VARIOS MÉTODOS DE PAGO
    cierres_caja = Set("CierreCaja")
    _table_ = "Sucursales"

class CuentaDestino(db.Entity):
    id = PrimaryKey(int, auto=True)
    sucursal = Required(Sucursal)  # UNA CUENTA DESTINO PERTENECE A UNA SUCURSAL
    nombre_titular = Required(str)  # Nombre del titular de la cuenta
    activa = Required(bool, default=True)  # Activa / Inactiva
    movimientos_caja = Set("CajaMovimiento")  # UNA CUENTA DESTINO TIENE VARIOS MOVIMIENTOS DE CAJA
    ventas = Set("Venta")  # UNA CUENTA DESTINO TIENE VARIAS VENTAS
    _table_ = "CuentasDestino"

class EstadoProducto(str, Enum):
    SALON = "SALON"
    CLIENTE = "CLIENTE"
    LAVANDERIA = "LAVANDERIA"
    MODISTA = "MODISTA"
    VENDIDO = "VENDIDO"


# Catálogos de atributos de producto (configuración)
class ProductoLinea(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str, unique=True)
    codigo = Required(str, unique=True)
    productos = Set("Producto")
    _table_ = "ProductoLineas"


class ProductoTalle(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str, unique=True)
    codigo = Required(str, unique=True)
    productos = Set("Producto")
    _table_ = "ProductoTalles"


class ProductoTela(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str, unique=True)
    codigo = Required(str, unique=True)
    productos = Set("Producto")
    _table_ = "ProductoTelas"


class ProductoColor(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str, unique=True)
    codigo = Required(str, unique=True)
    productos = Set("Producto")
    _table_ = "ProductoColores"


class Usuario(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str)
    email = Required(str)
    password = Required(str)
    nombre = Required(str, column="nombre")
    apellido = Required(str, column="apellido")
    rol = Required(Roles)
    sucursal = Required(Sucursal) #UN USUARIO PERTENECE A UNA SUCURSAL
    ventas = Set("Venta")  # UN USUARIO PUEDE TENER VARIAS VENTAS
    movimientos_caja = Set("CajaMovimiento")  # UN USUARIO PUEDE TENER VARIOS MOVIMIENTOS DE CAJA
    caja_chica_movimientos = Set("CajaChica")
    caja_concentradora_envios = Set("CajaConcentradora", reverse="usuario_envio")
    caja_concentradora_movimientos = Set("CajaConcentradora", reverse="usuario")
    caja_concentradora_vaciados = Set("CajaConcentradora", reverse="vaciado_por")
    cierres_caja = Set("CierreCaja")
    presupuestos_con_descuento_extra = Set("Presupuesto", reverse="extra_discount_applied_by")
    ordenes_con_descuento_extra = Set("OrdenTrabajo", reverse="extra_discount_applied_by")
    ventas_con_descuento_extra = Set("Venta", reverse="extra_discount_applied_by")
    _table_ = "Usuarios"

class Producto(db.Entity):
    id = PrimaryKey(int, auto=True)
    codigo_barra = Required(str, unique=True)
    linea = Optional("ProductoLinea", column="linea_id")
    talle = Optional("ProductoTalle", column="talle_id")
    tela = Optional("ProductoTela", column="tela_id")
    color = Optional("ProductoColor", column="color_id")
    descripcion = Required(str)
    descripcion_libre = Optional(str)
    costo = Required(float)
    precio_alquiler_lista = Required(float)
    precio_alquiler_efectivo = Required(float)
    precio_venta_nuevo_lista = Required(float)
    precio_venta_nuevo_efectivo = Required(float)
    precio_de_venta_medio_uso = Required(float)
    precio_venta = Required(float)
    precio_liquidacion = Required(float)
    stock = Required(int, default=1)
    stock_minimo = Required(int)
    fecha_alta = Required(date)
    estado = Required(EstadoProducto)
    sucursal = Required(Sucursal)
    inmovilizado = Required(bool, default=False)
    veces_alquilado = Required(int, default=0)  # Contador de veces que se ha alquilado
    productos_modistas = Set("ProductoModista")  # Añadir esta línea
    productos_lavanderias = Set("ProductoLavanderia")  # Añadir esta línea
    productos_reservados = Set("ProductoReservado")
    items_presupuesto = Set("ItemPresupuesto")
    detalles = Set("DetalleVenta")
    _table_ = "Productos"

class Cliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required (str)
    dni = Required(str, unique=True)
    direccion = Required(str)
    celular = Required(str)
    fecha_nacimiento = Optional(date)
    notas = Optional(str)
    presupuestos = Set("Presupuesto")
    cuentas_corrientes = Set("CuentaCorriente")
    ventas = Set("Venta")
    _table_ = "Cliente"

class Precliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required(str)
    celular = Required(str)
    presupuestos = Set("Presupuesto", reverse="precliente")
    _table_ = "Precliente"

class Modista(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    telefono = Optional(str)
    direccion = Optional(str)
    productos = Set("ProductoModista")
    _table_ = "Modistas"

class Lavanderia(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    telefono = Optional(str)
    direccion = Optional(str)
    productos = Set("ProductoLavanderia")
    _table_ = "Lavanderias"

class Evento(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    _table_ = "Eventos"

class ProductoModista(db.Entity):
    id = PrimaryKey(int, auto=True)
    producto = Required(Producto)
    modista = Required(Modista)
    fecha_ingreso = Required(date, default=lambda: date.today())
    fecha_salida = Optional(date)
    notas = Optional(str)
    cliente_nombre = Optional(str)
    cliente_celular = Optional(str)
    _table_ = "ProductosModistas"

class ProductoLavanderia(db.Entity):
    id = PrimaryKey(int, auto=True)
    producto = Required(Producto)
    lavanderia = Required(Lavanderia)
    fecha_ingreso = Required(date, default=lambda: date.today())
    fecha_salida = Optional(date)
    notas = Optional(str)
    cliente_nombre = Optional(str)
    cliente_celular = Optional(str)
    _table_ = "ProductosLavanderias"

#Presupuestos

class Presupuesto(db.Entity):
    id = PrimaryKey(int, auto=True)
    numero = Required(str)
    cliente = Optional(Cliente)
    precliente = Optional(Precliente, reverse="presupuestos")
    fecha_evento = Required(date)
    fecha_retiro = Optional(date)
    fecha_devolucion = Optional(date)
    fecha_creacion = Required(datetime, default=lambda: datetime.now())
    categoria_evento = Optional(str)
    nombre_agasajado = Optional(str)
    lugar_evento = Optional(str)
    observaciones = Optional(str)
    total = Required(float)
    estado = Required(str, default="pendiente")
    items = Set("ItemPresupuesto") 
    orden_trabajo = Optional("OrdenTrabajo", reverse="presupuesto")
    # Campos de descuento extra
    extra_discount_percentage = Optional(float)
    extra_discount_amount = Optional(float)
    extra_discount_reason = Optional(str)
    extra_discount_applied_by = Optional(Usuario, reverse="presupuestos_con_descuento_extra")
    extra_discount_created_at = Optional(datetime)
    _table_ = "Presupuesto" 

class ItemPresupuesto(db.Entity):
    id = PrimaryKey(int, auto=True)
    presupuesto = Required(Presupuesto)
    producto = Required(Producto)
    cantidad = Required(int)
    precio_unitario = Required(float)
    subtotal = Required(float)
    _table_ = "ItemPresupuesto"


class OrdenTrabajo(db.Entity):
    id = PrimaryKey(int, auto=True)
    presupuesto = Required(Presupuesto, reverse="orden_trabajo")  # FK
    fecha_creacion = Required(datetime, default=lambda: datetime.now())
    fecha_evento = Required(date)
    estado = Required(str, default='pendiente')  # pendiente, lista, cancelada, completada
    seña_pagada = Required(float)
    saldo_pendiente = Required(float)
    recibo_emitido = Optional(str)  # URL o ID de comprobante
    metodo_pago = Required(str)  # Compatibilidad hacia atrás
    metodo_pago_configurable = Optional("MetodoPagoConfigurable", column="metodo_pago_id")  # Nueva relación con método configurable
    submetodo_pago = Optional("SubmetodoPago", column="submetodo_pago_id")  # Nueva relación con submétodo
    productos_reservados = Set('ProductoReservado')
    recibos = Set('ReciboOrden', reverse="orden_trabajo")
    # Campos de descuento extra
    extra_discount_percentage = Optional(float)
    extra_discount_amount = Optional(float)
    extra_discount_reason = Optional(str)
    extra_discount_applied_by = Optional(Usuario, reverse="ordenes_con_descuento_extra")
    extra_discount_created_at = Optional(datetime)
    contrato_generado_at = Optional(datetime)  # Fecha en que se generó el contrato (manual)
    _table_ = "OrdenesTrabajo"

class ReciboOrden(db.Entity):
    """Recibo generado por cada pago (seña o adicional). Siempre se guarda para historial."""
    id = PrimaryKey(int, auto=True)
    orden_trabajo = Required(OrdenTrabajo, reverse="recibos")
    fecha_hora = Required(datetime, default=lambda: datetime.now())
    monto = Required(float)
    motivo = Required(str, default="Pago")  # Seña, Alquilado, Cancelación, etc.
    cliente_nombre = Required(str)
    presupuesto_numero = Required(str)
    movimiento_caja_id = Optional(int)  # Opcional: referencia al CajaMovimiento
    _table_ = "RecibosOrden"


class ProductoReservado(db.Entity):
    id = PrimaryKey(int, auto=True)
    orden_trabajo = Required(OrdenTrabajo)
    producto = Required('Producto')
    estado = Required(str, default='reservado')  # reservado, entregado, no disponible
    fecha_bloqueo = Required(date)
    observaciones = Optional(str)
    _table_ = "ProductosReservados"


class CuentaCorriente(db.Entity):
    id = PrimaryKey(int, auto=True)
    cliente = Required(Cliente)
    fecha = Required(datetime, default=lambda: datetime.now())
    concepto = Required(str)
    tipo = Required(str)  # "credito" (entra dinero) o "debito" (sale dinero)
    monto = Required(float)
    saldo_post = Required(float)  # saldo luego de aplicar ese movimiento
    referencia_orden = Optional(int)
    metodo_pago_configurable = Optional("MetodoPagoConfigurable", column="metodo_pago_id")  # Para pagos adicionales
    submetodo_pago = Optional("SubmetodoPago", column="submetodo_pago_id")  # Para pagos adicionales
    _table_ = "CuentaCorriente"

class TipoPrecio(str, Enum):
    LISTA = "Lista"
    EFECTIVO = "Efectivo"
    MEDIO_USO = "Medio Uso"
    LIQUIDACION = "Liquidacion"

class MetodoPago(str, Enum):
    EFECTIVO = "EFECTIVO"
    DEBITO = "DEBITO"
    CREDITO = "CREDITO"
    BILLETERA_VIRTUAL = "BILLETERA_VIRTUAL"
    TRANSFERENCIA = "TRANSFERENCIA"

class TipoMovimiento(str, Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"
    AJUSTE_NEGATIVO = "AJUSTE_NEGATIVO"
    AJUSTE_POSITIVO = "AJUSTE_POSITIVO"

class CategoriaIngreso(str, Enum):
    VENTAS = "VENTAS"
    SEÑAS = "SEÑAS"
    PAGOS_ADICIONALES = "PAGOS_ADICIONALES"
    SERVICIOS = "SERVICIOS"
    OTROS_INGRESOS = "OTROS_INGRESOS"

class CategoriaEgreso(str, Enum):
    ADMINISTRATIVOS = "ADMINISTRATIVOS"
    OPERATIVOS = "OPERATIVOS"
    COMERCIALES = "COMERCIALES"
    OTROS_EGRESOS = "OTROS_EGRESOS"

class TipoMovimientoCajaChica(str, Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"

class MetodoPagoCajaChica(str, Enum):
    EFECTIVO = "EFECTIVO"
    DEBITO = "DEBITO"
    CREDITO = "CREDITO"
    TRANSFERENCIA = "TRANSFERENCIA"
    OTROS = "OTROS"

class TipoEgresoCajaChica(str, Enum):
    ADMINISTRATIVO = "ADMINISTRATIVO"
    COMERCIAL = "COMERCIAL"
    OPERATIVO = "OPERATIVO"
    OTROS = "OTROS"

class EstadoMovimientoCajaChica(str, Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"

class Venta(db.Entity):
    id = PrimaryKey(int, auto=True)
    fecha = Required(date, default=lambda: date.today())  # Columna que existe en la BD
    fecha_hora = Required(datetime, default=lambda: datetime.now())
    cliente = Required(Cliente, column="cliente")  # Columna que existe en la BD
    tipo_precio = Required(str)  # <- Usa str y validalo como Enum desde FastAPI
    payment_method = Required(str)  # Cambiado a str para coincidir con la BD (compatibilidad hacia atrás)
    metodo_pago_configurable = Optional("MetodoPagoConfigurable", column="metodo_pago_id")  # Nueva relación con método configurable
    submetodo_pago = Optional("SubmetodoPago", column="submetodo_pago_id")  # Nueva relación con submétodo
    total = Required(float, default=0.0)
    detalles = Set("DetalleVenta")
    sucursal = Required(Sucursal, column="sucursal")  # Columna que existe en la BD
    usuario = Required(Usuario, column="usuario_id")  # Relación con Usuario
    movimientos_caja = Set("CajaMovimiento")  # UNA VENTA PUEDE TENER VARIOS MOVIMIENTOS DE CAJA
    cuenta_destino = Optional("CuentaDestino", column="cuenta_destino_id")  # Cuenta destino (obligatoria)
    # Campos de descuento extra
    extra_discount_percentage = Optional(float)
    extra_discount_amount = Optional(float)
    extra_discount_reason = Optional(str)
    extra_discount_applied_by = Optional(Usuario, reverse="ventas_con_descuento_extra")
    extra_discount_created_at = Optional(datetime)
    _table_ = "Ventas"

class DetalleVenta(db.Entity):
    id = PrimaryKey(int, auto=True)
    venta = Required(Venta)
    producto = Required(Producto)
    cantidad = Required(int, default=1)
    precio_unitario = Required(float)
    subtotal = Required(float)  # cantidad * precio_unitario
    _table_ = "DetallesVenta"

class CajaMovimiento(db.Entity):
    id = PrimaryKey(int, auto=True)
    fecha_hora = Required(datetime, default=lambda: datetime.now())
    tipo = Required(TipoMovimiento)
    monto = Required(float)
    payment_method = Optional(MetodoPago)  # Compatibilidad hacia atrás (opcional)
    metodo_pago_configurable = Optional("MetodoPagoConfigurable", column="metodo_pago_id")  # Nueva relación con método configurable
    submetodo_pago = Optional("SubmetodoPago", column="submetodo_pago_id")  # Nueva relación con submétodo
    origen = Required(str)  # Ej: "VENTA:123", "AJUSTE", etc.
    categoria = Optional(str, column="categoria")  # Categoría del movimiento (ingreso o egreso)
    destino = Optional(str, column="destino")
    venta = Optional(Venta, column="venta_id")  # FK nullable
    usuario = Required(Usuario, column="usuario_id")  # Relación con Usuario
    sucursal = Required(Sucursal, column="sucursal_id")  # Relación con Sucursal
    cuenta_destino = Optional("CuentaDestino", column="cuenta_destino_id")  # Cuenta destino (obligatoria para INGRESO)
    _table_ = "CajaMovimientos"


class CajaChica(db.Entity):
    id = PrimaryKey(int, auto=True)
    sucursal = Required(Sucursal)
    usuario = Required(Usuario)
    fecha = Required(datetime, default=lambda: datetime.now())
    tipo = Required(TipoMovimientoCajaChica, column="tipo")
    metodo_pago = Required(MetodoPagoCajaChica, column="metodo_pago", default=MetodoPagoCajaChica.EFECTIVO)
    tipo_egreso = Optional(TipoEgresoCajaChica, column="tipo_egreso")
    monto = Required(Decimal, 10, 2)
    descripcion = Optional(str, 255)
    estado = Required(EstadoMovimientoCajaChica, default=EstadoMovimientoCajaChica.PENDIENTE, column="estado")
    referencia = Optional(str, column="referencia")
    enviado_concentradora = Required(bool, default=False)
    caja_diaria_id = Optional(int)
    caja_movimiento_id = Optional(int, column="caja_movimiento_id")
    movimiento_concentradora = Optional("CajaConcentradora", reverse="movimiento_origen")
    _table_ = "CajaChica"


class TipoMovimientoConcentradora(str, Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"

class OrigenConcentradora(str, Enum):
    CAJA_DIARIA = "Caja Diaria"
    CAJA_CHICA = "Caja Chica"
    MANUAL = "Manual"
    OTRO = "Otro"

class DestinoConcentradora(str, Enum):
    CAJA_CHICA = "Caja Chica"
    OTRO = "Otro"

class EstadoConcentradora(str, Enum):
    PENDIENTE = "Pendiente"
    CONFIRMADO = "Confirmado"
    RECHAZADO = "Rechazado"

class CajaConcentradora(db.Entity):
    id = PrimaryKey(int, auto=True)
    sucursal = Required(Sucursal)
    usuario_envio = Optional(Usuario)
    usuario = Optional(Usuario, column="usuario_id")  # Usuario que realiza el movimiento
    monto = Required(Decimal, 10, 2)
    descripcion = Optional(str, 255)
    fecha = Required(datetime, default=lambda: datetime.now(), column="fecha_envio")  # Campo principal (fecha_envio en BD para compatibilidad)
    tipo_movimiento = Optional(TipoMovimientoConcentradora, default=TipoMovimientoConcentradora.INGRESO, column="tipo_movimiento")
    origen = Optional(OrigenConcentradora, default=OrigenConcentradora.CAJA_DIARIA, column="origen")
    destino = Optional(DestinoConcentradora, column="destino")
    estado = Optional(EstadoConcentradora, default=EstadoConcentradora.CONFIRMADO, column="estado")
    vaciado_por = Optional(Usuario)
    fecha_vaciado = Optional(datetime)
    activo = Required(bool, default=True)
    movimiento_origen = Optional(CajaChica)
    caja_movimiento_id = Optional(int, column="caja_movimiento_id")  # Referencia al movimiento de caja diaria
    _table_ = "CajaConcentradora"


class CierreCaja(db.Entity):
    """Registro de cierre de caja diaria: la sucursal cerró con efectivo en cero."""
    id = PrimaryKey(int, auto=True)
    fecha = Required(date)  # Día que se cierra
    sucursal = Required(Sucursal)
    usuario = Required(Usuario, column="usuario_id")  # Quién cerró
    fecha_hora = Required(datetime, default=lambda: datetime.now())  # Momento del cierre
    _table_ = "CierresCaja"


# Métodos de Pago Configurables
class MetodoPagoConfigurable(db.Entity):
    id = PrimaryKey(int, auto=True)
    sucursal = Required(Sucursal)  # UN MÉTODO DE PAGO PERTENECE A UNA SUCURSAL
    nombre = Required(str)  # Ej: "Tarjeta", "Billetera Virtual", "Efectivo", "Transferencia"
    activo = Required(bool, default=True)  # Si está activo o no
    tiene_submetodos = Required(bool, default=False)  # Si tiene submétodos o no
    orden = Optional(int, default=0)  # Orden de visualización
    submétodos = Set("SubmetodoPago")  # UN MÉTODO DE PAGO TIENE VARIOS SUBMÉTODOS
    ventas = Set("Venta")  # Relación con ventas
    ordenes_trabajo = Set("OrdenTrabajo")  # Relación con órdenes de trabajo
    movimientos_caja = Set("CajaMovimiento")  # Relación con movimientos de caja
    pagos_adicionales = Set("CuentaCorriente")  # Para pagos adicionales que usen este método
    fecha_creacion = Required(datetime, default=lambda: datetime.now())
    _table_ = "MetodosPagoConfigurables"

class SubmetodoPago(db.Entity):
    id = PrimaryKey(int, auto=True)
    metodo_pago = Required(MetodoPagoConfigurable)  # UN SUBMÉTODO PERTENECE A UN MÉTODO DE PAGO
    nombre = Required(str)  # Ej: "Visa", "Master", "Mercado Pago", "Naranja X"
    activo = Required(bool, default=True)  # Si está activo o no
    orden = Optional(int, default=0)  # Orden de visualización
    ventas = Set("Venta")  # Relación con ventas
    ordenes_trabajo = Set("OrdenTrabajo")  # Relación con órdenes de trabajo
    movimientos_caja = Set("CajaMovimiento")  # Relación con movimientos de caja
    pagos_adicionales = Set("CuentaCorriente")  # Para pagos adicionales que usen este submétodo
    fecha_creacion = Required(datetime, default=lambda: datetime.now())
    _table_ = "SubmetodosPago"
