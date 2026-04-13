# GuapoTrajes - Sistema de Gestión de Alquiler y Venta de Trajes

---

## Para GPT / Uso como contexto para IA

**Este README es la fuente de verdad del proyecto.** Al pasarlo a un asistente (GPT u otro):

1. **Antes de modificar código**: Lee las secciones "Arquitectura", "Estructura del Proyecto" y "Consideraciones para Modificaciones" para saber dónde va cada cambio (modelos → schemas → services → controllers → frontend).
2. **Reglas de negocio**: La sección "Reglas de Negocio del Backend" describe validaciones y comportamientos que deben respetarse; no las contradigas sin indicarlo.
3. **Rutas y archivos clave**: Usa "Estructura del Proyecto" y "Estructura de API" para localizar controladores, servicios y páginas del frontend.
4. **Al agregar funcionalidades**: Sigue el checklist en "Consideraciones para Modificaciones → Al Agregar Nuevas Funcionalidades".
5. **Tests**: "Guía Rápida para Casos de Test" resume escenarios que deben seguir funcionando.

Si el usuario pide "hacer cambios" sin detallar, pregúntale qué quiere cambiar (backend, frontend, regla de negocio, nueva pantalla, etc.) y usa este README como contexto.

---

## Índice

- [Descripción General](#descripción-general)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Funcionalidades Principales](#funcionalidades-principales)
- [Consideraciones Técnicas](#consideraciones-técnicas-importantes)
- [Reglas de Negocio del Backend](#reglas-de-negocio-del-backend-para-pruebas)
- [Instalación y Configuración](#instalación-y-configuración)
- [Estructura de API](#estructura-de-api)
- [Consideraciones para Modificaciones](#consideraciones-para-modificaciones)

---

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
- **Framework**: Next.js 16.x
- **Lenguaje**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Componentes**: shadcn/ui
- **Gráficos**: Recharts
- **Códigos de barras**: jsbarcode

## Estructura del Proyecto

```
GuapoTrajes/
├── backend/
│   ├── main.py                    # Punto de entrada FastAPI; aquí se registran todos los routers
│   ├── requirements.txt           # Dependencias Python
│   ├── .env / .env.template       # Variables de entorno
│   └── src/
│       ├── models.py              # Modelos de base de datos (Pony ORM)
│       ├── schemas.py             # Esquemas Pydantic para validación
│       ├── db.py                  # Configuración de base de datos
│       ├── security.py            # JWT, bcrypt, verificación de tokens
│       ├── deps.py                # Dependencias FastAPI (get_current_user, etc.)
│       ├── crud.py                # Operaciones CRUD genéricas si se usan
│       ├── migrations.py          # Migraciones de esquema (aplicar antes del mapeo)
│       ├── run_models.py          # Script de inicialización de modelos
│       ├── controllers/           # Un router por dominio (rutas API)
│       │   ├── auth_controller.py
│       │   ├── sucursal_controller.py
│       │   ├── productos_controller.py
│       │   ├── cliente_controller.py
│       │   ├── precliente_controller.py
│       │   ├── presupuestos_controller.py
│       │   ├── orden_trabajo_controller.py
│       │   ├── ventas_controller.py
│       │   ├── caja_controller.py
│       │   ├── caja_chica_controller.py
│       │   ├── caja_concentradora_controller.py
│       │   ├── pagos_controller.py
│       │   ├── eventos_controller.py
│       │   ├── modista_controller.py
│       │   ├── lavanderia_controller.py
│       │   ├── cuenta_destino_controller.py
│       │   ├── metodos_pago_controller.py
│       │   ├── reportes_controller.py
│       │   ├── logs_controller.py
│       │   ├── usuario_controller.py
│       │   ├── disponibilidad_controller.py
│       │   └── health_controller.py
│       └── services/              # Lógica de negocio (un servicio por dominio)
│           ├── *_services.py      # Ej: ventas_services, presupuestos_services, etc.
├── frontend/
│   └── my-app/
│       ├── src/
│       │   ├── app/                        # Next.js App Router
│       │   │   ├── layout.tsx, page.tsx
│       │   │   ├── login/page.tsx
│       │   │   └── (dashboard)/
│       │   │       ├── layout.tsx
│       │   │       ├── clientes/page.tsx
│       │   │       ├── productos/page.tsx
│       │   │       ├── presupuestos/page.tsx
│       │   │       ├── stock/page.tsx
│       │   │       ├── caja/page.tsx
│       │   │       ├── caja-concentradora/page.tsx
│       │   │       ├── devoluciones/page.tsx
│       │   │       ├── reportes/page.tsx
│       │   │       ├── modista/page.tsx
│       │   │       └── logs/page.tsx
│       │   ├── components/         # UI y modales (app-sidebar, RoleGate, modales/*)
│       │   ├── context/            # auth-context.tsx, sucursal-context.tsx
│       │   ├── hooks/              # use-productos, use-toast, use-mobile
│       │   └── lib/                # api-config.ts, utils.ts
│       └── package.json
```

## Funcionalidades Principales

### 1. Gestión de Usuarios y Autenticación
- Sistema de autenticación con JWT
- Tres roles: **SUPER_ADMIN**, **ADMIN** y **EMPLEADO**
- Los usuarios están asociados a una sucursal
- Los empleados solo pueden operar en su sucursal asignada
- Los administradores y super administradores tienen acceso ampliado a las sucursales y configuraciones

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
El sistema usa `python-decouple` (archivo `.env`). Requeridas:
- `DB_PROVIDER`: Proveedor de base de datos (postgres)
- `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_NAME`: Conexión PostgreSQL
- `SECRET`: Clave secreta para JWT

Opcionales:
- `SUPER_ADMIN_SUCURSAL_ID`: ID de sucursal para el usuario SUPER_ADMIN por defecto (si no existe, se usa la primera sucursal)
- `SYSTEM_LOG_FILE`: Ruta del archivo de log (default: `logs/system.log`)

Al arrancar, si no existe un SUPER_ADMIN, se crea uno por defecto: usuario `DesarrolloGuapo`, contraseña `Roma123!`, email `desarrollo@guapotrajes.com`.

### Permisos y Roles
- **SUPER_ADMIN**: Acceso total al sistema (usuarios, sucursales, logs, reportes, etc.).
- **ADMIN**: Acceso completo a la operativa de su sucursal (y, según la configuración, a otras sucursales).
- **EMPLEADO**: Acceso limitado a la sucursal asignada.
- Los empleados no pueden:
  - Acceder a caja concentradora.
  - Gestionar eventos.
  - Gestionar sucursales.
  - Gestionar modistas/lavanderías.
  - Ver reportes ni logs del sistema.

### Flujos de Trabajo Clave

1. **Flujo de Alquiler**:
   - Cliente solicita presupuesto → Presupuesto creado → Orden de trabajo generada → Productos reservados → Seña pagada → Retiro de productos → Devolución → Productos a lavandería

2. **Flujo de Venta**:
   - Cliente selecciona productos → Venta registrada → Movimiento de caja generado → Producto marcado como VENDIDO

3. **Flujo de Caja**:
   - Ventas generan ingresos automáticos en caja diaria → Caja chica para gastos menores → Caja concentradora centraliza fondos (solo ADMIN)

### Estados y Enums Importantes

- **EstadoProducto**: SALON, CLIENTE, LAVANDERIA, MODISTA, VENDIDO
- **Roles**: SUPER_ADMIN, ADMIN, EMPLEADO
- **TipoMovimiento**: INGRESO, EGRESO, AJUSTE_NEGATIVO, AJUSTE_POSITIVO
- **MetodoPago**: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA
- **EstadoOrdenTrabajo**: pendiente, lista, cancelada, completada

## Reglas de Negocio del Backend (para pruebas)

### Reglas de Roles y Sucursales

- **Asociación obligatoria**: cada usuario pertenece a una sucursal.
- **EMPLEADO**:
  - Solo puede operar dentro de su sucursal (por ejemplo, no puede registrar ventas en otra sucursal).
  - Solo puede ver cuentas destino de su propia sucursal.
- **ADMIN / SUPER_ADMIN**:
  - Pueden gestionar sucursales, cuentas destino, reportes y flujos globales.

### Productos

- **Estados de producto** (`EstadoProducto`):
  - `SALON`: disponible para vender o reservar en alquiler.
  - `CLIENTE`: en poder del cliente.
  - `LAVANDERIA`: en lavandería.
  - `MODISTA`: en modista.
  - `VENDIDO`: ya vendido.
- **Reglas clave**:
  - **No se puede vender un producto que no esté en estado `SALON`**.  
    Si el producto está en `CLIENTE`, `LAVANDERIA`, `MODISTA`, `VENDIDO`, etc., la venta falla con error 400.
  - **Stock obligatorio**:
    - En ventas, si `producto.stock < cantidad` se rechaza la operación (stock insuficiente).
    - Al vender, se descuenta stock; si llega a 0 o menos, el estado pasa a `VENDIDO`.
  - **Código de barras**: debe ser único por producto.
  - **Campo `inmovilizado`**: marca productos que no deberían moverse (se tiene en cuenta en reportes/gestión de stock).

### Clientes y Preclientes

- **Clientes**:
  - Campos obligatorios: `nombre`, `apellido`, `dni`, `direccion`, `celular`.
  - Si alguno de estos campos está vacío o solo contiene espacios, se devuelve error 400 con un mensaje específico.
  - El `dni` debe ser único.
- **Preclientes**:
  - Se crean con datos mínimos (nombre, apellido, celular).
  - Para convertir un precliente a cliente se exige al menos `direccion` y `dni`.

### Disponibilidad de Productos (Alquiler)

La función `verificar_disponibilidad(producto_id, fecha_retiro, fecha_devolucion)` determina si se puede reservar un producto en un rango de fechas.

- Se revisan:
  - **Presupuestos** en estado `pendiente` o `aprobado` que contengan ese producto.
  - **Órdenes de trabajo** y sus `ProductoReservado` asociados a ese producto.
- Se considera que hay **solapamiento de fechas** si:
  - `fecha_inicio <= fecha_devolucion` **y** `fecha_fin >= fecha_retiro`
  - Donde `fecha_inicio = presupuesto.fecha_evento` y `fecha_fin = presupuesto.fecha_devolucion` (o `fecha_evento` si no hay devolución).
- Si existe solapamiento, la función indica que el producto **no está disponible**.

Esta función se usa en:

- Creación de presupuesto.
- Edición de presupuesto (ignorando el propio presupuesto para no bloquearse).

Si un producto no está disponible para las fechas elegidas, el backend devuelve error 400 indicando que ya está reservado en otro presupuesto u orden de trabajo.

### Presupuestos

- **Creación**:
  - El cliente debe existir.
  - Todos los productos deben existir y estar disponibles para el rango \[fecha_retiro, fecha_devolucion\].
- **Descuento extra**:
  - Si `extra_discount_percentage > 15%` es obligatorio enviar `extra_discount_reason` no vacío.
- **Edición**:
  - No se puede editar un presupuesto que ya tenga una orden de trabajo generada.
  - Se vuelve a verificar disponibilidad de productos para las nuevas fechas.
- **Eliminación**:
  - No se puede eliminar un presupuesto con orden de trabajo asociada.

### Órdenes de Trabajo

- **Creación**:
  - El presupuesto debe existir y no tener otra orden de trabajo.
  - Se requiere una **cuenta destino** válida:
    - Debe existir en la base de datos.
    - Debe pertenecer a la misma sucursal que el usuario que crea la orden.
    - Debe estar activa (`activa = True`).
  - Método de pago:
    - Puede llegar por el sistema viejo (`payment_method` usando Enum `MetodoPago`) o por el nuevo (`metodo_pago_id` configurable por sucursal).
    - Si el método de pago no es válido, se rechaza.
- **Reserva de productos**:
  - Por cada ítem del presupuesto se crea un `ProductoReservado`:
    - `fecha_bloqueo = fecha_evento - 5 días`.
    - Si el producto está en estado `lavanderia` o `alquilado`, se marca como `no disponible`.
    - En caso contrario se marca como `reservado`.
  - El presupuesto pasa a estado `Aprobado`.
- **Cambio de estado**:
  - Estados permitidos: `"En proceso"`, `"Completada"`, `"Cancelada"`, `"Entregada"`.
  - Al pasar a `"Completada"` por primera vez se incrementa el contador `veces_alquilado` de cada producto del presupuesto.

### Pagos de Orden de Trabajo

- **Pago de saldo pendiente**:
  - La orden debe existir.
  - Debe tener `saldo_pendiente > 0`, si no se rechaza.
  - `monto_pagado` debe ser menor o igual al saldo pendiente; si lo supera se rechaza.
  - Se exige una cuenta destino válida (mismas reglas que en creación de orden).
  - Si el saldo pendiente llega a 0 después del pago, la orden se marca como `"Pagada"`.

### Devoluciones

- **Devolución completa**:
  - La orden debe existir.
  - Si ya está `"Completada"` o `"Cancelada"`, no se puede volver a completar la devolución.
  - Se eliminan todos los `ProductoReservado` asociados (los productos quedan nuevamente disponibles).
  - La orden pasa a estado `"Completada"`.
- **Devolución parcial**:
  - Debe enviarse una lista no vacía de IDs de productos.
  - Todos los productos de la lista deben pertenecer a la orden; si no, se devuelve error indicando qué IDs son inválidos.
  - Los productos devueltos parcialmente se marcan con estado `"EN_REVISION"` y se agrega un texto a `observaciones` con fecha y descripción del problema.

### Ventas

- **Validaciones principales**:
  - Usuario, cliente y sucursal deben existir.
  - Si el usuario es `EMPLEADO` no puede registrar ventas en una sucursal distinta a la suya.
  - La venta requiere una cuenta destino:
    - Debe existir.
    - Debe pertenecer a la sucursal de la venta.
    - Debe estar activa.
  - Método de pago:
    - Puede usarse el sistema viejo (`payment_method`) o el nuevo (`metodo_pago_id` y `submetodo_pago_id`).
- **Restricciones sobre productos**:
  - El producto debe existir.
  - **Solo se pueden vender productos en estado `SALON`**:
    - Si el estado es distinto, se devuelve error 400 con un mensaje del tipo:
      > El producto 'X' no se puede vender porque está en estado 'Y'.
  - Se comprueba el stock:
    - Si `stock < cantidad`, se devuelve error 400 de stock insuficiente.
    - Si después de la venta `stock <= 0`, se deja `stock = 0` y el estado pasa a `VENDIDO`.

### Caja Diaria

- Tipos de movimiento permitidos:
  - `INGRESO`, `EGRESO`, `AJUSTE_NEGATIVO`, `AJUSTE_POSITIVO`.
- Cada movimiento debe tener:
  - `usuario`, `sucursal`, `monto`, `origen` y opcionalmente `payment_method` o `metodo_pago_id`.
- Para ingresos automáticos generados por ventas o señas:
  - El monto y ciertos campos de origen/tipo no pueden modificarse manualmente (se valida en servicios de caja y caja concentradora).

### Caja Chica

- `tipo_movimiento` solo puede ser `INGRESO` o `EGRESO`.
- `estado` ∈ `PENDIENTE`, `APROBADO`, `RECHAZADO`.
- Restricciones:
  - El monto de un ingreso automático no se puede modificar.
  - Los ingresos que provienen de Caja Diaria no pueden ser eliminados manualmente.

### Caja Concentradora

- Solo accesible para roles altos (ADMIN / SUPER_ADMIN según ruta).
- No se puede dejar el saldo en negativo:
  - Si se intenta extraer más que el saldo disponible, se devuelve error 400 indicando el saldo actual.
- Ingresos automáticos desde Caja Diaria:
  - No se puede modificar el `monto`.
  - No se pueden cambiar los campos `origen`, `destino` ni `tipo_movimiento`.

### Pagos Adicionales de Presupuestos

- La solicitud de pago adicional (`PagoAdicionalRequest`) exige:
  - `presupuesto_id` válido.
  - `monto` > 0.
  - Cuenta destino obligatoria y válida (pertenece a sucursal y está activa).
  - Debe enviarse **o** `metodo_pago` (sistema viejo) **o** `metodo_pago_id` (sistema nuevo); si no se provee ninguno se devuelve error 400.

### Lavanderías, Modistas y Eventos

- Si no hay registros configurados:
  - Se devuelven errores 404 del tipo:
    - "No hay lavanderías disponibles"
    - "No hay modistas disponibles"
    - "No hay eventos disponibles"

### Guía Rápida para Casos de Test

Algunos escenarios recomendados para pruebas unitarias/integración:

- Intentar vender un producto que:
  - Está alquilado, en lavandería, en modista o vendido → **debe fallar**.
- Crear dos presupuestos con el mismo producto y fechas solapadas → el segundo debe ser rechazado por disponibilidad.
- Editar o eliminar un presupuesto que ya tiene orden de trabajo → **debe fallar**.
- Crear una orden de trabajo sin cuenta destino o con cuenta de otra sucursal / inactiva → **debe fallar**.
- Registrar un pago de orden por un monto mayor al saldo pendiente → **debe fallar**.
- EMPLEADO intentando registrar una venta en otra sucursal → **debe fallar**.
- Modificar montos de ingresos automáticos en Caja Chica o Caja Concentradora → **debe fallar**.
- Intentar retirar más saldo del disponible en Caja Concentradora → **debe fallar**.

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
- `/cuentas-destino` - Cuentas destino por sucursal (obligatorias para ventas/órdenes)
- `/metodos-pago` - Métodos de pago configurables por sucursal
- `/logs` - Logs del sistema (solo SUPER_ADMIN)
- `/usuarios` - Gestión de usuarios
- `/health` - Endpoint de healthcheck

## Consideraciones para Modificaciones

### Dónde tocar según el tipo de cambio (referencia rápida)

| Tipo de cambio | Backend | Frontend |
|----------------|---------|----------|
| Nueva entidad o campo en DB | `models.py` → migración en `migrations.py` → `schemas.py` → `services/` → `controllers/` → `main.py` | Si hay pantalla: `app/(dashboard)/.../page.tsx`, componentes, hooks, `app-sidebar` |
| Cambiar validación o regla de negocio | `services/` del dominio correspondiente (y a veces `schemas.py`) | Solo si cambia el flujo o mensajes mostrados |
| Nuevo endpoint API | `schemas.py` (request/response) → `services/` → `controllers/` → registrar en `main.py` | Llamada en hooks o en `lib/api-config` / fetch desde página |
| Nueva pantalla o ruta | — | `app/(dashboard)/ruta/page.tsx` + enlace en `app-sidebar.tsx` |
| Permisos por rol | `deps.py`, `security.py`, y en cada `controller` (dependencia de usuario/rol) | `RoleGate.tsx`, ocultar menús en sidebar |

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
- Frontend puede desplegarse en Netlify (`frontend/my-app/netlify.toml`, `README-NETLIFY.md`)

---

**Al usar este README con GPT u otra IA:** Este documento contiene la descripción completa del proyecto GuapoTrajes. Usa el índice para ir a la sección relevante según el cambio que quieras hacer (modelos, API, reglas de negocio, frontend, instalación). No inventes rutas ni archivos que no figuren aquí; si falta algo, indícalo en tu respuesta.

