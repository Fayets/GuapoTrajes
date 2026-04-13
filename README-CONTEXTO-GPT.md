# Contexto del proyecto para GPT → prompts a Cursor

Este documento sirve para que **otro asistente (p. ej. ChatGPT)** entienda el repositorio **GuapoTrajes** y te devuelva **prompts listos para pegar en Cursor**, de forma que el agente de código pueda ejecutar tareas con contexto, criterios claros y menos ida y vuelta.

**Repositorio:** https://github.com/Fayets/GuapoTrajes  
**Rama de trabajo sugerida:** `franco` (o la que uses con el equipo).

---

## 1. Qué es el proyecto (resumen operativo)

Sistema web de **gestión operativa** para un negocio de trajes (alquiler / ventas / taller): clientes, presupuestos, órdenes de trabajo, stock, caja, pagos, eventos, reportes, usuarios por rol, sucursales, etc.  
**Frontend:** panel (dashboard) con muchas secciones bajo rutas `(dashboard)/…`.  
**Backend:** API REST que alimenta el frontend; persistencia con **Pony ORM** y **PostgreSQL** (según dependencias y uso típico).

---

## 2. Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | **Next.js** (App Router), **React**, **TypeScript**, **Tailwind CSS** |
| UI / datos en cliente | Componentes propios bajo `src/components`, hooks, contexto de auth y sucursal |
| E2E | **Playwright** (`frontend/my-app/e2e/`, scripts `test:e2e`) |
| Backend | **Python**, **FastAPI**, **Pony ORM**, **Pydantic**, **JWT** (auth) |
| Config | `python-decouple` / `.env` en `backend/` (no versionar secretos) |
| Despliegue frontend | Notas en `frontend/my-app/README-NETLIFY.md` |

---

## 3. Estructura de carpetas (referencia rápida)

```
GuapoTrajes/
├── backend/
│   ├── main.py                 # App FastAPI, routers, CORS, migraciones al arranque
│   ├── requirements.txt
│   ├── src/
│   │   ├── controllers/        # Endpoints por dominio (auth, ventas, caja, …)
│   │   ├── services/           # Lógica de negocio
│   │   ├── models.py, schemas.py, crud.py, db.py, security.py, …
│   │   └── migrations.py
│   └── tests/                  # pytest
└── frontend/my-app/
    ├── src/app/                # Rutas Next (App Router)
    ├── src/components/
    ├── src/context/
    ├── src/hooks/
    ├── src/lib/                # api-config, utilidades
    └── e2e/                    # Playwright
```

**Regla práctica:** cambios de contrato API → coordinar `schemas` / controllers en backend y llamadas en `src/lib` o páginas del frontend.

---

## 4. Dominios que ya existen en el backend (orientación)

Routers en `backend/main.py` cubren, entre otros: **auth**, **sucursales**, **productos**, **clientes**, **lavandería**, **modista**, **preclientes**, **presupuestos**, **órdenes de trabajo**, **ventas**, **caja** / **caja chica** / **caja concentradora**, **pagos**, **eventos**, **reportes**, **cuentas destino**, **métodos de pago**, **logs**, **usuarios**, **health**, **config productos**.

Usá estos nombres al pedir features para que GPT/Cursor ubiquen archivos.

---

## 5. Instrucciones para GPT: cómo debe armar cada prompt para Cursor

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

## 6. Mensaje corto que el usuario puede pegarle a GPT junto con este README

> Leé el archivo `README-CONTEXTO-GPT.md` del repo GuapoTrajes (adjunto o pegado abajo). Con esa información, armame **un prompt único en español** para pegar en Cursor y que el agente pueda implementar: [DESCRIBÍ ACÁ TU IDEA]. Incluí alcance, criterios de aceptación y archivos probables.

---

## 7. Buenas prácticas de prompts (para el usuario)

- **Una tarea por prompt** si es grande; si es épica, pedile a GPT que la **parta en 2–4 prompts** ordenados.  
- Pedir **tests** solo cuando aporten (pytest en backend, Playwright si es flujo UI crítico).  
- Mencionar **sucursal / rol** si el cambio toca permisos.  
- Si algo falla en runtime, el siguiente prompt puede incluir **mensaje de error literal** y pasos para reproducir.

---

## 8. Comandos útiles (referencia; Cursor puede ejecutarlos)

- Frontend: `cd frontend/my-app` → `npm install` → `npm run dev`  
- Backend: entorno virtual + `pip install -r requirements.txt` → ejecutar según indique el equipo (p. ej. `uvicorn`).  
- E2E: `npm run test:e2e` desde `frontend/my-app`.

---

*Documento generado para coordinar GPT (planificación / redacción de prompts) con Cursor (implementación). Actualizalo si cambia el stack o la estructura importante del repo.*
