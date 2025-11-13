Guapo Trajes - Descripción Técnica del Proyecto
===============================================

Visión general
--------------
- Monorepo con dos carpetas principales:
  - `backend`: API REST construida con FastAPI, Pony ORM y JWT. Gestiona autenticación, inventario, clientes, presupuestos, órdenes de trabajo, ventas y caja diaria.
  - `frontend/my-app`: Aplicación Next.js (React 19) con autenticación por contexto, UI Bootstrap/Tailwind y consumo directo del API (`http://127.0.0.1:8000`).
- Modelo de negocio: alquiler y venta de trajes con sucursales, gestión de clientes/preclientes, presupuestos, producción (modistas/lavandería), cobranzas y reportes financieros.

Backend (FastAPI + Pony ORM)
----------------------------
### Configuración
- `backend/main.py` instancia FastAPI, aplica CORS abierto y registra routers para cada dominio (`/auth`, `/sucursales`, `/productos`, `/clientes`, `/preclientes`, `/presupuestos`, `/ordenes`, `/ventas`, `/caja`, `/pagos`, `/eventos`, `/lavanderia`, `/modistas`).
- `src/db.py` vincula Pony ORM mediante variables de entorno (`DB_PROVIDER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_NAME`). Requiere base de datos con tablas ya creadas (`db.generate_mapping(create_tables=False, check_tables=True)`).
- `src/security.py` define secreto JWT (`SECRET`), algoritmo HS256 y helpers para emitir/validar tokens.
- Ejecutar con `uvicorn backend.main:app --reload` tras instalar dependencias (`pip install -r requirements.txt`).

### Modelado de datos (`src/models.py`)
- Entidades principales: `Sucursal`, `Usuario` (roles `ADMIN`, `EMPLEADO`), `Producto` (enum `EstadoProducto`), `Cliente`, `Precliente`, `Modista`, `Lavanderia`, `Evento`.
- Flujo comercial:
  - `Presupuesto` + `ItemPresupuesto` → generan `OrdenTrabajo` con `ProductoReservado`.
  - `Venta` + `DetalleVenta` → descuentan stock y actualizan `CajaMovimiento`.
  - `CuentaCorriente` mantiene movimientos por cliente.
  - `CajaMovimiento` guarda ingresos/egresos con método de pago (`MetodoPago`).

### Esquemas (`src/schemas.py`)
- Pydantic define estructuras de entrada/salida para cada recurso: Sucursales, Productos, Clientes, Preclientes, Eventos, Presupuestos, Órdenes de Trabajo, Ventas, Caja, Pagos.
- Incluye validaciones cruzadas (p. ej. `OrdenTrabajoCreateSchema` exige `payment_method` o `metodo_pago`) y respuestas agregadas (reportes de caja, balances, saldos pendientes).

### Autenticación
- `controllers/auth_controller.py`:
  - `/auth/register` registra usuarios hashando contraseña (bcrypt) vía `UsuariosServices`.
  - `/auth/login` genera JWT (expira en 60 minutos) usando `SECRET`.
  - `/auth/me` devuelve usuario autenticado (id, email, rol) con dependencia `get_current_user` (`src/deps.py`).
- `UsuariosServices` maneja CRUD de usuarios, verificación de credenciales y hash/chequeo de contraseñas.

### Servicios destacados (ubicados en `src/services/`)
- **Sucursales**: alta, listado, actualización y baja con validaciones.
- **Productos** (`productos_services.py`):
  - CRUD completo con validación de enums, fechas y sucursal.
  - Paginación/filtro por estado, métricas (stock bajo, valor inventario, estadísticas por estado).
- **Clientes** (`cliente_services.py`):
  - Alta/edición/baja con cascada controlada: antes de eliminar un cliente remueve presupuestos, órdenes, cuenta corriente y ventas relacionadas.
  - Conversión de precliente a cliente y consulta de relaciones.
- **Preclientes**: altas rápidas y conversión a cliente solicitando datos faltantes (dirección, DNI).
- **Presupuestos** (`presupuestos_services.py`):
  - Genera número correlativo `PRES-XXX`, valida productos, calcula totales y persiste ítems.
  - Listado detallado con items, seña, método de pago y fechas; bloquea edición/eliminación si existe orden asociada.
- **Órdenes de trabajo** (`orden_trabajo_services.py`):
  - Crea orden desde presupuesto (valida métodos de pago, registra seña en caja/cuenta corriente, marca productos reservados, cambia estado de presupuesto).
  - Permite listar, actualizar estado, registrar pagos adicionales (actualiza saldo pendiente y caja), obtener historial y agenda semanal.
- **Disponibilidad** (`disponibilidad_services.py`): chequea solapamiento de productos en presupuestos aprobados.
- **Ventas** (`ventas_services.py`):
  - Crea venta: valida cliente, sucursal y stock; selecciona precio según tipo (`Lista`, `Efectivo`, `Medio Uso`, `Liquidacion`); descuenta stock y crea movimiento de caja automático (`VENTA:<id>`).
  - Listado detallado y eliminación con reversión de stock.
- **Caja** (`caja_services.py`):
  - Alta de movimientos (ingresos/egresos/ajustes) con categorización automática.
  - Reportes diarios (movimientos + totales por método), reportes de ingresos/egresos por rango, balance financiero, búsqueda por texto y saldos pendientes de clientes.
- **Pagos** (`pagos_services.py`): registra pagos adicionales, actualiza saldo/seña de orden, crea movimiento en cuenta corriente y expone movimientos/saldo cliente.
- **Lavandería/Modista/Eventos**: catálogos simples con asignación de productos y seguimiento de fechas de ingreso/salida.

### Controladores
- Cada archivo en `src/controllers/` declara un `APIRouter` que delega en el servicio correspondiente y aplica autenticación (generalmente `Depends(get_current_user)`).
- Endpoints exponen operaciones estándar REST más acciones específicas:
  - `caja_controller`: `/diaria`, `/registrar-movimiento`, `/balance-financiero`, `/saldos-pendientes`, `/buscar`.
  - `orden_trabajo_controller`: creación, listado, pagos, historial, calendario semanal.
  - `ventas_controller`: CRUD + reportes.
  - `cliente_controller`: relaciones previas a eliminar, conversión de precliente.
  - `precliente_controller`: alta rápida, conversión a cliente solicitando dirección y DNI.
- Errores controlados con `HTTPException`; muchas rutas devuelven objeto `{message, success, data}` consistente.

Frontend (Next.js 15 + React 19)
--------------------------------
### Arquitectura
- Se ejecuta con `npm install` + `npm run dev` dentro de `frontend/my-app`.
- `src/app/layout.tsx` envuelve la app con `AuthProvider` y `SucursalProvider`, importa Bootstrap (CSS + JS) y mantiene `lang="es"`.
- Routing por segmentos:
  - `/login`: formulario de acceso (Bootstrap), usa `AuthContext`.
  - `/dashboard` (protegido): layout con sidebar y módulos, renderiza children (clientes, productos, etc.).
  - Cada subruta (`clientes`, `preclientes`, `presupuestos`, `ordenes`, `ventas`, `caja`, `sucursales`, `stock`, `eventos`, `modista`, `lavanderia`, `reportes`) tiene su propia página y `loading.tsx`.
- `globals.css` combina estilos Bootstrap, layout propio (sidebar, content-wrapper) y tokens CSS personalizados.

### Autenticación en cliente
- `context/auth-context.tsx`:
  - Administra `token`, `me`, banderas `isAdmin`, `isEmpleado`.
  - Persistencia en `localStorage`, `fetch` a `/auth/login` y `/auth/me`.
  - Redirige al dashboard y controla logout.
- `RoleGate` oculta UI según roles.
- `Sidebar` muestra enlaces filtrados por rol, con estado colapsado y acciones (logout).

### Estado y hooks
- `context/sucursal-context.tsx` simula sucursales (en memoria + localStorage) con métodos para seleccionar/agregar/editar/eliminar.
- `hooks/use-productos.ts` (mock) consume `/api/productos` (Next route handler pendiente) para listar/CRUD productos.
- `hooks/use-toast` y `components/ui/*` implementan wrappers de UI (botones, tablas, select, tabs, etc.) inspirados en shadcn.

### Páginas representativas
- `clientes/page.tsx`: CRUD completo con modales Bootstrap, paginación (`react-paginate`), eliminación segura con verificación de relaciones (`/clientes/relaciones/:id`) y conversión de preclientes.
- `presupuestos/page.tsx`: gestiona formularios complejos con `PresupuestoModal`, consulta clientes/productos/eventos, verifica disponibilidad vía backend y calcula totales.
- `ordenes/page.tsx`: crea órdenes desde presupuestos, muestra reservas de productos y permite registrar pagos adicionales.
- `caja/page.tsx`: dashboard financiero con pestañas (carga diaria, nuevos movimientos, reportes, búsqueda, saldos pendientes). Usa componentes personalizados, `toast` y múltiples llamadas a `/caja/*`.
- Resto de módulos (productos, sucursales, eventos, modista, lavandería, ventas, stock, reportes) siguen patrón similar: estado local, uso de `fetch` con token guardado, tablas y modales.

Comunicación Front ↔ Back
-------------------------
- El frontend consume directamente la API FastAPI (`http://127.0.0.1:8000/...`) mediante `fetch`.
- Se espera que FastAPI esté corriendo en local con CORS abierto (ya configurado).
- Token JWT se envía en `Authorization: Bearer`.
- Muchas páginas asumen usuario autenticado y sucursal `id=1` hasta integrar contexto real.

Ejecución y variables necesarias
--------------------------------
1. Backend:
   - Definir variables de entorno (o `.env` con `python-decouple`):
     - `DB_PROVIDER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_NAME`.
     - `SECRET` (clave JWT).
   - Instalar dependencias (`pip install -r requirements.txt`).
   - Lanzar `uvicorn backend.main:app --reload`.
2. Frontend:
   - `npm install` dentro de `frontend/my-app`.
   - `npm run dev` (Next.js en puerto 3000).
3. Base de datos debe contener tablas correspondientes; `db.generate_mapping` se ejecuta en modo `check_tables=True` (no auto-crea).

Puntos clave para ChatGPT
-------------------------
- Entender que la lógica de negocio está encapsulada en servicios; los controladores son delgados.
- Los enums de modelos y Pydantic usan strings (coinciden con base de datos).
- Pony ORM requiere `@db_session` en funciones o contexto `with db_session`.
- Al crear órdenes/ventas/pagos se encadenan efectos secundarios (movimientos de caja, cuenta corriente, actualización de estados/stock).
- El frontend usa muchos placeholders (p. ej. usuario ID = 1, sucursal fija); idealmente integrarlo con datos reales desde `/auth/me`.
- Si se crean nuevas rutas, respetar los esquemas existentes y la estructura `{message, success, data}`.
- Mantener concordancia con enums: `MetodoPago` (`EFECTIVO`, `DEBITO`, `CREDITO`, `BILLETERA_VIRTUAL`, `TRANSFERENCIA`) y `EstadoProducto`.
- CORS está abierto; producción debería restringirse.

Sugerencias de pruebas/manual
-----------------------------
- Autenticación: registrar usuario (requiere sucursal existente) y probar `/auth/login` + `/auth/me`.
- Inventario: crear producto (`POST /productos/register`), consultar lista y actualizar stock/estado.
- Clientes: alta → presupuesto → orden → registrar pago adicional → verificar saldo en caja/cuenta corriente.
- Caja diaria: `GET /caja/diaria?fecha=YYYY-MM-DD&sucursal_id=1` y `POST /caja/registrar-movimiento`.
- Frontend: login, navegar al dashboard, verificar que RoleGate oculte botones según rol y que páginas comunican correctamente (ver consola de red).

Con esta descripción, otro asistente puede navegar el repositorio rápidamente, comprender la responsabilidad de cada módulo y extender o depurar la solución sin necesidad de releer todo el código fuente.

