# Contexto del proyecto para GPT → prompts a Cursor

Este documento sirve para que **otro asistente (p. ej. ChatGPT)** entienda el repositorio **GuapoTrajes** y te devuelva **prompts listos para pegar en Cursor**, de forma que el agente de código pueda ejecutar tareas con contexto, criterios claros y menos ida y vuelta.

**Repositorio:** https://github.com/Fayets/GuapoTrajes  
**Rama de trabajo sugerida:** `franco` (o la que uses con el equipo).  
**Última revisión de código (contexto):** abril 2026.

---

## 1. Qué es el proyecto (resumen operativo)

Sistema web de **gestión operativa** para un negocio de trajes (alquiler / ventas / taller): clientes y preclientes, presupuestos, órdenes de trabajo, contratos, stock, lavandería, modista, caja (diaria, chica, concentradora), ventas, eventos, reportes, usuarios por rol, sucursales, métodos de pago configurables, **cuentas destino** (dónde cae el dinero físico/transferencia), logs, etc.

- **Frontend:** panel bajo rutas `(dashboard)/…` con sidebar en `frontend/my-app/src/components/ui/sidebar.tsx`.
- **Backend:** API REST **FastAPI**; persistencia **Pony ORM** + **PostgreSQL** (p. ej. Neon en desarrollo). Variables en `backend/.env` vía `python-decouple` (no versionar secretos).

---

## 2. Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | **Next.js** (App Router), **React**, **TypeScript**, **Tailwind CSS** |
| UI / cliente | Componentes en `src/components`, contexto de auth (`src/context`), hooks, utilidades en `src/lib` (p. ej. URL base de API) |
| E2E | **Playwright** (`frontend/my-app/e2e/`, scripts `test:e2e`) |
| Backend | **Python 3**, **FastAPI**, **Pony ORM**, **Pydantic**, **JWT** (OAuth2 / Bearer en OpenAPI) |
| DB | **PostgreSQL** (`psycopg2`), migraciones lógicas en `backend/src/migrations.py` + `ensure_*` al arranque en `main.py` |
| Despliegue frontend | Notas en `frontend/my-app/README-NETLIFY.md` |

---

## 3. Estructura de carpetas (referencia rápida)

```
GuapoTrajes/
├── backend/
│   ├── main.py                 # FastAPI: CORS, routers, generate_mapping, migraciones/ensure_*, SUPER_ADMIN inicial
│   ├── requirements.txt, requirements-dev.txt
│   ├── scripts/
│   │   └── limpiar_datos_transaccionales.py   # Borra datos transaccionales (preview por defecto; --apply --confirm LIMPIAR_DATOS)
│   ├── logs/                   # system.log (ruta configurable SYSTEM_LOG_FILE)
│   └── src/
│       ├── controllers/        # Routers por dominio
│       ├── services/           # Lógica de negocio
│       ├── models.py, schemas.py, crud.py, db.py, security.py, …
│       └── migrations.py
└── frontend/my-app/
    ├── src/app/(dashboard)/    # Páginas del panel (ver §5)
    ├── src/components/
    ├── src/context/
    ├── src/hooks/
    ├── src/lib/
    └── e2e/
```

**Regla práctica:** cambios de contrato API → alinear `schemas` / controllers en backend y `fetch`/tipos en páginas o helpers del frontend.

---

## 4. API y dominios (backend)

Routers registrados en `backend/main.py` (prefijos representativos):

| Prefijo / tags | Área |
|----------------|------|
| `/auth` | Autenticación |
| `/sucursales` | Sucursales |
| `/productos` | Productos / stock operativo |
| `/clientes` | Clientes |
| `/lavanderia`, `/modistas` | Taller lavandería / modista |
| `/preclientes` | Preclientes |
| Presupuestos / órdenes | Routers sin prefijo común en el snippet: revisar `presupuestos_controller`, `orden_trabajo_controller` (paths tipo presupuestos, órdenes) |
| `/ventas` | Ventas |
| `/caja` | Caja diaria |
| (sin prefijo único en listado) | Caja chica y concentradora: ver `caja_chica_controller`, `caja_concentradora_controller` |
| `/pagos` | Pagos adicionales y **consultas de cuenta corriente por cliente** (ver §6) |
| `/eventos` | Eventos |
| `/reportes` | Reportes |
| `/cuentas-destino` | **Cuentas destino** (titular / sucursal; ingresos de caja) — no confundir con cuenta corriente del cliente |
| `/metodos-pago` | Métodos y submétodos configurables |
| `/config` | Config de atributos de producto |
| `/logs` | Logs de sistema |
| `/usuarios` | Usuarios |
| `/health` | Health |

Usá estos nombres al pedir features para que GPT/Cursor ubiquen archivos.

---

## 5. Frontend: rutas principales del dashboard

Rutas con `page.tsx` bajo `src/app/(dashboard)/` (no todas están en el sidebar; el menú vive en `sidebar.tsx`):

- `/dashboard`, `/preclientes`, `/clientes`, `/productos`, `/stock`, `/presupuestos`, `/ordenes`, `/contratos`, `/devoluciones`, `/ventas`, `/caja`, `/caja-chica`, `/caja-concentradora`, `/reportes`, `/eventos`, `/modista`, `/lavanderia`, `/sucursales`, `/cuentas-destino`, `/metodos-pago`, `/configuraciones/productos`, `/usuarios`, `/logs`.

**Roles:** en el sidebar, ítems con `allow` restringen visibilidad (p. ej. caja concentradora y muchos ajustes solo `ADMIN` / `SUPER_ADMIN`).

---

## 6. Cuenta corriente del cliente — estado actual y oportunidad de módulo

### Qué es hoy en el modelo

En `backend/src/models.py`, la entidad **`CuentaCorriente`** registra movimientos por **`Cliente`**: `fecha`, `concepto`, `tipo` (`"credito"` / `"debito"`), `monto`, `saldo_post`, `referencia_orden` opcional, y opcionalmente `metodo_pago_id` / `submetodo_pago_id` (pagos adicionales vía métodos configurables).

### Dónde se escribe hoy

- **`orden_trabajo_services`:** al crear la orden desde presupuesto (seña con cliente); al registrar pagos adicionales sobre la orden (flujo de órdenes).
- **`pagos_services`:** `registrar_pago_adicional` (endpoint bajo `/pagos`) también actualiza orden y puede crear `CuentaCorriente` con cálculo de saldo a partir del último movimiento.

Solo aplica cuando el presupuesto/orden tiene **cliente** (no precliente): si no hay cliente, no se generan filas en `CuentaCorriente`.

### Qué API ya existe (sin pantalla dedicada)

En `backend/src/controllers/pagos_controller.py` (prefijo `/pagos`):

- `POST /pagos/adicional` — pago adicional (presupuesto con orden).
- `GET /pagos/movimientos/{cliente_id}` — listado de movimientos de cuenta corriente.
- `GET /pagos/saldo/{cliente_id}` — saldo actual y metadata básica.

**Frontend:** no hay sección “Cuenta corriente” en el menú ni página dedicada que consuma estos `GET` de forma centralizada. En **clientes**, al intentar borrar un cliente, el backend expone conteo de relaciones (incluye movimientos de cuenta corriente) vía `cliente_services`.

### Cuenta destino vs cuenta corriente

- **Cuenta destino:** a qué “caja lógica” o titular se imputa un **ingreso de caja** (UI en `/cuentas-destino`).
- **Cuenta corriente:** historial / saldo **por cliente** asociado a pagos de alquiler (señas, pagos adicionales, etc.), distinto del destino del dinero.

### Idea de módulo futuro (para tu próximo prompt)

Objetivo típico: **pantalla y/o flujos** para ver saldo, movimientos, filtros por fecha/orden, exportación, o ajustes manuales (débitos/créditos) con permisos y auditoría.

**Archivos probables al planificar:**

- Backend: `src/models.py` (`CuentaCorriente`), `src/services/pagos_services.py`, `src/services/orden_trabajo_services.py`, `src/controllers/pagos_controller.py` (o nuevo `cuenta_corriente_controller` si conviene separar), `schemas.py`, tests en `backend/tests/`.
- Frontend: nueva ruta bajo `(dashboard)/`, entradas en `sidebar.tsx`, llamadas con token a `/pagos/...` o nuevos endpoints; reutilizar patrones de tablas/fetch de `clientes` o `caja`.

**Nota técnica para el agente:** existen **varios puntos de escritura** en `CuentaCorriente`; al extender el módulo conviene **centralizar la regla de saldo** (último `saldo_post` + movimiento) para que todos los flujos queden alineados y evitar inconsistencias.

---

## 7. Scripts operativos (datos)

- **`backend/scripts/limpiar_datos_transaccionales.py`:** borra datos transaccionales (ventas, órdenes, presupuestos, movimientos de caja, **incluye `CuentaCorriente`**, etc.) y normaliza productos; **sin `--apply`** solo muestra conteos. Requiere conexión a la misma BD que el backend.

---

## 8. Instrucciones para GPT: cómo debe armar cada prompt para Cursor

Cuando el usuario te describa una idea vaga, **convertila en un único bloque de prompt** que incluya siempre:

1. **Objetivo** en una oración.  
2. **Alcance:** qué sí hace y qué **no** hace en esta tarea.  
3. **Archivos o zonas probables** (aunque sean hipótesis: “revisar `…_controller` y `…_services`”).  
4. **Criterios de aceptación** verificables (comportamiento, pantallas, API, tests).  
5. **Riesgos / datos sensibles:** no commitear `.env`, no exponer claves; respetar roles si aplica.  
6. **Idioma:** el usuario prefiere comunicación en **español** con Cursor.

**Formato sugerido del prompt final (copiar/pegar):**

```markdown
## Contexto
[1–3 frases: negocio + stack + carpeta relevante]

## Tarea
[Qué hay que implementar o corregir]

## Alcance
- Incluye: …
- Excluye: …

## Archivos / áreas a revisar
- …

## Criterios de aceptación
1. …
2. …

## Notas
- No commitear secretos; usar `.env.template` si hace falta documentar variables.
- Mantener estilo existente; cambios mínimos fuera del pedido.
```

---

## 9. Mensaje corto que el usuario puede pegarle a GPT junto con este README

> Leé el archivo `README-CONTEXTO-GPT.md` del repo GuapoTrajes (adjunto o pegado abajo). Con esa información, armame **un prompt único en español** para pegar en Cursor y que el agente pueda implementar: [DESCRIBÍ ACÁ TU IDEA]. Incluí alcance, criterios de aceptación y archivos probables. Si toca **cuenta corriente**, distinguí cuenta corriente del cliente vs cuenta destino de caja y mencioná los endpoints existentes bajo `/pagos` o si preferís un router nuevo.

---

## 10. Buenas prácticas de prompts (para el usuario)

- **Una tarea por prompt** si es grande; si es épica, pedile a GPT que la **parta en 2–4 prompts** ordenados.  
- Pedir **tests** solo cuando aporten (pytest en backend, Playwright si es flujo UI crítico).  
- Mencionar **sucursal / rol** si el cambio toca permisos.  
- Si algo falla en runtime, el siguiente prompt puede incluir **mensaje de error literal** y pasos para reproducir.

---

## 11. Comandos útiles (referencia; Cursor puede ejecutarlos)

- Frontend: `cd frontend/my-app` → `npm install` → `npm run dev`  
- Backend: entorno virtual + `pip install -r requirements.txt` → levantar con **uvicorn** según el equipo (típicamente módulo `main:app` desde `backend/`).  
- E2E: `npm run test:e2e` desde `frontend/my-app`.  
- Limpieza transaccional (con cuidado, borra datos): desde `backend/`, `python scripts/limpiar_datos_transaccionales.py` (preview) o con `--apply --confirm LIMPIAR_DATOS`.

---

*Documento para coordinar GPT (planificación / redacción de prompts) con Cursor (implementación). Actualizalo si cambia el stack, el modelo de datos o la navegación principal del panel.*
