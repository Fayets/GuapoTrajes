from pony.orm import *
from enum import Enum
from .db import db
from datetime import date, datetime 

# Definicion de los roles
class Roles(str, Enum):
    ADMIN = "ADMIN"
    EMPLEADO = "EMPLEADO"

class Sucursal(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    direccion = Required(str)
    provincia = Required(str)
    usuarios = Set("Usuario") # UNA SUCURSAL TIENE VARIOS USUARIOS
    productos = Set("Producto")
    _table_ = "Sucursales"

class EstadoProducto(str, Enum):
    SALON = "SALON"
    CLIENTE = "CLIENTE"
    LAVANDERIA = "LAVANDERIA"
    MODISTA = "MODISTA"
    VENDIDO = "VENDIDO"

class Usuario(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str)
    email = Required(str)
    password = Required(str)
    nombre = Required(str, column="nombre")
    apellido = Required(str, column="apellido")
    rol = Required(Roles)
    sucursal = Required(Sucursal) #UN USUARIO PERTENECE A UNA SUCURSAL
    _table_ = "Usuarios"

class Producto(db.Entity):
    id = PrimaryKey(int, auto=True)
    codigo_barra = Required(str, unique=True)
    linea = Required(str)
    talle = Required(str)
    tela = Required(str)
    color = Required(str)
    descripcion = Required(str)
    costo = Required(float)
    precio_alquiler_lista = Required(float)
    precio_alquiler_efectivo = Required(float)
    precio_venta_nuevo_lista = Required(float)
    precio_venta_nuevo_efectivo = Required(float)
    precio_de_venta_medio_uso = Required(float)
    precio_venta = Required(float)
    precio_liquidacion = Required(float)
    stock = Required(int)
    stock_minimo = Required(int)
    fecha_alta = Required(date)
    estado = Required(EstadoProducto)
    sucursal = Required(Sucursal)
    inmovilizado = Required(bool, default=False)
    productos_modistas = Set("ProductoModista")  # Añadir esta línea
    productos_lavanderias = Set("ProductoLavanderia")  # Añadir esta línea
    productos_reservados = Set("ProductoReservado")
    items_presupuesto = Set("ItemPresupuesto")
    _table_ = "Productos"

class Cliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required (str)
    dni = Required(str, unique=True)
    direccion = Required(str)
    celular = Required(str)
    notas = Optional(str)
    presupuestos = Set("Presupuesto")
    cuentas_corrientes = Set("CuentaCorriente")
    _table_ = "Cliente"

class Precliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required(str)
    celular = Required(str)
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

class ProductoModista(db.Entity):
    id = PrimaryKey(int, auto=True)
    producto = Required(Producto)
    modista = Required(Modista)
    fecha_ingreso = Required(date, default=lambda: date.today())
    fecha_salida = Optional(date)
    notas = Optional(str)
    _table_ = "ProductosModistas"

class ProductoLavanderia(db.Entity):
    id = PrimaryKey(int, auto=True)
    producto = Required(Producto)
    lavanderia = Required(Lavanderia)
    fecha_ingreso = Required(date, default=lambda: date.today())
    fecha_salida = Optional(date)
    notas = Optional(str)
    _table_ = "ProductosLavanderias"

#Presupuestos

class Presupuesto(db.Entity):
    id = PrimaryKey(int, auto=True)
    numero = Required(str)
    cliente = Required(Cliente)
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
    orden_trabajo = Optional("OrdenTrabajo")
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
    presupuesto = Required('Presupuesto')  # FK
    fecha_creacion = Required(datetime, default=lambda: datetime.now())
    fecha_evento = Required(date)
    estado = Required(str, default='pendiente')  # pendiente, lista, cancelada, completada
    seña_pagada = Required(float)
    saldo_pendiente = Required(float)
    recibo_emitido = Optional(str)  # URL o ID de comprobante
    productos_reservados = Set('ProductoReservado')
    _table_ = "OrdenesTrabajo"

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
    _table_ = "CuentaCorriente"
