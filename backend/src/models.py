from pony.orm import *
from enum import Enum
from .db import db
from datetime import date 

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
    _table_ = "Productos"

class Cliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required (str)
    dni = Required(str, unique=True)
    direccion = Required(str)
    celular = Required(str)
    notas = Optional(str)
    _table_ = "Cliente"

class Precliente(db.Entity):
    id = PrimaryKey(int, auto=True)
    nombre = Required(str)
    apellido = Required(str)
    celular = Required(str)
    table = "Precliente"

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