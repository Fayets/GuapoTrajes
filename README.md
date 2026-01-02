# GuapoTrajes - Sistema de Gestión de Alquiler y Venta de Trajes

## Descripción General

GuapoTrajes es un sistema integral de gestión diseñado para administrar un negocio de alquiler y venta de trajes. El sistema permite gestionar inventario, clientes, presupuestos, órdenes de trabajo, ventas, control de caja y múltiples sucursales.

## Arquitectura del Sistema

### Backend
- **Framework**: FastAPI (Python)
- **ORM**: Pony ORM
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT (JSON Web Tokens)
- **Seguridad**: bcrypt para hash de contraseñas, python-jose para tokens

### Frontend
- **Framework**: Next.js 15.2.4
- **Lenguaje**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Componentes**: shadcn/ui
- **Gráficos**: Recharts
- **Códigos de barras**: jsbarcode

## Estructura del Proyecto

```
GuapoTrajes/
├── backend/
│   ├── main.py                 # Punto de entrada de FastAPI
│   ├── requirements.txt        # Dependencias Python
│   └── src/
│       ├── models.py           # Modelos de base de datos (Pony ORM)
│       ├── schemas.py          # Esquemas Pydantic para validación
│       ├── db.py               # Configuración de base de datos
│       ├── security.py         # Funciones de seguridad y JWT
│       ├── controllers/        # Controladores de rutas API
│       └── services/           # Lógica de negocio
├── frontend/
│   └── my-app/
│       ├── src/
│       │   ├── app/            # Rutas de Next.js
│       │   ├── components/     # Componentes React
│       │   ├── context/       # Contextos (auth, sucursal)
│       │   └── hooks/         # Custom hooks
│       └── package.json
```

## Funcionalidades Principales

### 1. Gestión de Usuarios y Autenticación
- Sistema de autenticación con JWT
- Dos roles: **ADMIN** y **EMPLEADO**
- Los usuarios están asociados a una sucursal
- Los empleados solo pueden operar en su sucursal asignada
- Los administradores tienen acceso completo a todas las sucursales

### 2. Gestión de Sucursales
- Sistema multi-sucursal
- Cada sucursal tiene sus propios productos, ventas y movimientos de caja
- Los usuarios están vinculados a una sucursal específica

### 3. Gestión de Productos
- **Estados de productos**:
  - `SALON`: Disponible en el salón
  - `CLIENTE`: En poder del cliente
  - `LAVANDERIA`: En proceso de lavado
  - `MODISTA`: En proceso de arreglo/modificación
  - `VENDIDO`: Producto vendido
- **Campos importantes**:
  - Código de barras único
  - Múltiples precios (alquiler lista/efectivo, venta nuevo lista/efectivo, medio uso, liquidación)
  - Control de stock y stock mínimo
  - Campo `inmovilizado` para productos que no deben moverse
- **Tracking**: Seguimiento de productos en modista y lavandería con fechas de ingreso/salida

### 4. Gestión de Clientes
- Registro completo de clientes con DNI único
- **Preclientes**: Clientes potenciales sin registro completo
- **Cuenta Corriente**: Sistema de créditos y débitos para cada cliente
- Historial de presupuestos y ventas por cliente

### 5. Presupuestos
- Creación de presupuestos con múltiples productos
- Asociación a clientes y eventos
- Campos: fecha de evento, fecha de retiro, fecha de devolución
- Estados: pendiente, aprobado, etc.
- Cálculo automático de totales

### 6. Órdenes de Trabajo
- Generadas a partir de presupuestos aprobados
- **Estados**: pendiente, lista, cancelada, completada
- **Reserva de productos**: Los productos se reservan automáticamente
- Control de seña pagada y saldo pendiente
- Método de pago registrado

### 7. Ventas
- Registro de ventas con múltiples productos
- **Tipos de precio**: Lista, Efectivo, Medio Uso, Liquidación
- **Métodos de pago**: Efectivo, Débito, Crédito, Billetera Virtual, Transferencia
- Asociación automática a sucursal y usuario
- Generación de movimientos de caja automáticos

### 8. Control de Caja

#### Caja Diaria
- Registro de ingresos y egresos
- **Tipos de movimiento**: INGRESO, EGRESO, AJUSTE_NEGATIVO, AJUSTE_POSITIVO
- **Categorías de ingreso**: Ventas, Señas, Pagos Adicionales, Servicios, Otros Ingresos
- **Categorías de egreso**: Administrativos, Operativos, Comerciales, Otros Egresos
- Vinculación con ventas para trazabilidad

#### Caja Chica
- Movimientos menores de la sucursal
- **Estados**: Pendiente, Aprobado, Rechazado
- **Tipos de egreso**: Administrativo, Comercial, Operativo, Otros
- Puede enviarse a caja concentradora

#### Caja Concentradora
- **Solo ADMIN**: Acceso restringido a administradores
- Centraliza fondos de múltiples sucursales
- **Orígenes**: Caja Diaria, Caja Chica, Manual, Otro
- **Estados**: Pendiente, Confirmado, Rechazado
- Sistema de vaciado con registro de usuario y fecha

### 9. Gestión de Servicios Externos

#### Modistas
- Registro de modistas externos
- Tracking de productos enviados a modista
- Fechas de ingreso y salida
- Notas y observaciones

#### Lavandería
- Registro de lavanderías externas
- Tracking de productos enviados a lavandería
- Fechas de ingreso y salida
- Notas y observaciones

### 10. Eventos
- Catálogo de eventos (solo ADMIN)
- Asociación con presupuestos

### 11. Reportes
- Acceso solo para ADMIN
- Visualización de datos y estadísticas del negocio

## Consideraciones Técnicas Importantes

### Base de Datos
- **ORM**: Pony ORM con PostgreSQL
- **Migraciones**: Sistema de migraciones automáticas en `migrations.py`
- Las migraciones se aplican antes de generar el mapeo de entidades
- Las tablas se crean automáticamente si no existen

### Seguridad
- **JWT**: Tokens con expiración de 60 minutos
- **CORS**: Configurado para permitir todas las origenes (configurar en producción)
- **Validación**: Pydantic schemas para validación de datos
- **Autenticación**: OAuth2PasswordBearer para protección de rutas

### Variables de Entorno
El sistema requiere las siguientes variables de entorno (usar `python-decouple`):
- `DB_PROVIDER`: Proveedor de base de datos (postgres)
- `DB_USER`: Usuario de base de datos
- `DB_PASS`: Contraseña de base de datos
- `DB_HOST`: Host de base de datos
- `DB_NAME`: Nombre de la base de datos
- `SECRET`: Clave secreta para JWT

### Permisos y Roles
- **ADMIN**: Acceso completo a todas las funcionalidades y todas las sucursales
- **EMPLEADO**: Acceso limitado a su sucursal asignada
- Los empleados no pueden:
  - Acceder a caja concentradora
  - Gestionar eventos
  - Gestionar sucursales
  - Gestionar modistas/lavanderías
  - Ver reportes

### Flujos de Trabajo Clave

1. **Flujo de Alquiler**:
   - Cliente solicita presupuesto → Presupuesto creado → Orden de trabajo generada → Productos reservados → Seña pagada → Retiro de productos → Devolución → Productos a lavandería

2. **Flujo de Venta**:
   - Cliente selecciona productos → Venta registrada → Movimiento de caja generado → Producto marcado como VENDIDO

3. **Flujo de Caja**:
   - Ventas generan ingresos automáticos en caja diaria → Caja chica para gastos menores → Caja concentradora centraliza fondos (solo ADMIN)

### Estados y Enums Importantes

- **EstadoProducto**: SALON, CLIENTE, LAVANDERIA, MODISTA, VENDIDO
- **Roles**: ADMIN, EMPLEADO
- **TipoMovimiento**: INGRESO, EGRESO, AJUSTE_NEGATIVO, AJUSTE_POSITIVO
- **MetodoPago**: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA
- **EstadoOrdenTrabajo**: pendiente, lista, cancelada, completada

## Instalación y Configuración

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Configurar variables de entorno en archivo `.env`:
```
DB_PROVIDER=postgres
DB_USER=tu_usuario
DB_PASS=tu_contraseña
DB_HOST=localhost
DB_NAME=guapotrajes
SECRET=tu_clave_secreta_jwt
```

Ejecutar:
```bash
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend/my-app
npm install
npm run dev
```

## Estructura de API

El backend expone las siguientes rutas principales:
- `/auth` - Autenticación (login, register, verify-token, me)
- `/sucursales` - Gestión de sucursales
- `/productos` - Gestión de productos
- `/clientes` - Gestión de clientes
- `/preclientes` - Gestión de preclientes
- `/presupuestos` - Gestión de presupuestos
- `/ordenes` - Gestión de órdenes de trabajo
- `/ventas` - Gestión de ventas
- `/caja` - Caja diaria
- `/caja-chica` - Caja chica
- `/caja-concentradora` - Caja concentradora
- `/pagos` - Gestión de pagos
- `/eventos` - Gestión de eventos
- `/modistas` - Gestión de modistas
- `/lavanderia` - Gestión de lavandería

## Consideraciones para Modificaciones

### Al Modificar Modelos
1. **Siempre actualizar `models.py`** primero
2. **Crear migración** en `migrations.py` si se agregan/modifican columnas
3. **Actualizar `schemas.py`** para validación de datos
4. **Actualizar servicios** en `services/` si cambia la lógica
5. **Actualizar controladores** en `controllers/` si cambian los endpoints

### Al Agregar Nuevas Funcionalidades
1. Crear el modelo en `models.py`
2. Crear el schema en `schemas.py`
3. Crear el servicio en `services/`
4. Crear el controlador en `controllers/`
5. Registrar la ruta en `main.py`
6. Crear componentes frontend si es necesario
7. Agregar ruta en el sidebar si requiere navegación

### Validaciones Importantes
- Los productos deben tener código de barras único
- Los clientes deben tener DNI único
- Los usuarios deben estar asociados a una sucursal
- Los movimientos de caja deben tener usuario y sucursal
- Los empleados solo pueden operar en su sucursal

### Relaciones Críticas
- Usuario → Sucursal (Many-to-One)
- Producto → Sucursal (Many-to-One)
- Venta → Cliente, Usuario, Sucursal (Many-to-One)
- Presupuesto → Cliente (Many-to-One)
- OrdenTrabajo → Presupuesto (One-to-One)
- ProductoReservado → OrdenTrabajo, Producto (Many-to-One)

## Notas Adicionales

- El sistema usa `Decimal` para montos monetarios para precisión
- Las fechas se manejan con `date` y `datetime` de Python
- El frontend usa contextos de React para estado global (auth, sucursal)
- Los tokens JWT expiran en 60 minutos
- El sistema tiene protección CORS configurada (ajustar en producción)

