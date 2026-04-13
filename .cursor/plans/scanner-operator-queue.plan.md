# Cola de escaneos en /dashboard y acciones posteriores (plan finiquitado)

## Alcance y comportamiento (confirmado)

- **Ruta de la cola:** solo [`/dashboard`](frontend/my-app/src/app/(dashboard)/dashboard/page.tsx). El escáner **no** redirige a presupuestos desde el layout global; el paso previo obligatorio es **ver la lista y elegir una acción** (botones en modal u otra UI en home).
- **Mismo código otra vez:** **decrementar cantidad**; en 0 se elimina la línea.
- **Persistencia:** la cola **sobrevive** recarga de página, navegación a otras secciones del sistema y **reinicio de sesión del navegador** (medio típico: `localStorage` o equivalente, con versión de esquema). El operador puede **vaciar** la cola manualmente si no la usará.
- **Cierre de sesión (logout):** **vaciar la cola** al cerrar sesión (PC compartido; evita mezclar datos entre usuarios).
- **Códigos inexistentes:** **no** entrar a la cola; **rechazo inmediato** con feedback claro (toast y opcional sonido).
- **Tras usar una acción** (ej. enviar a presupuesto, venta, etc.): **vaciar toda la cola** al concluir ese trámite (ver detalle de momento exacto abajo).

## Anulación del flujo anterior

- Se **elimina** el comportamiento actual por el que un escaneo en (casi) cualquier página del dashboard llama a `useBarcodeScanToPresupuestos` y **navega a `/presupuestos`** ([`layout.tsx`](frontend/my-app/src/app/(dashboard)/layout.tsx)). Sustituir por captura solo en `/dashboard` + persistencia; en el resto del dashboard el lector actúa como teclado (incluye `shouldIgnoreBarcodeTarget` cuando hay foco en inputs).

## Detalle de “consume all” (momento de vaciar)

Decisión de producto: **una acción consume y muestra la cola vacía** al cerrar el circuito.

- **Recomendación de implementación:** vaciar cuando la acción tiene **éxito en el destino** (ej. presupuesto guardado OK), para no perder la cola si el usuario abre el modal de presupuesto y **cancela**. Si se prefiere vaciar **al pulsar** “Ir a presupuesto” desde el modal de cola, documentar el riesgo de abandono y alinear con negocio.
- Ajuste en plan: dejar explícito en desarrollo cuál de las dos variantes se codifica (preferencia técnica: **éxito en destino**).

## Complicaciones ya acotadas

| Tema | Resolución en plan |
|------|---------------------|
| Hook global | Condicionar por `pathname`; quitar navegación forzada a presupuestos. |
| Lista olvidada | Badge/contador en `/dashboard` + acceso al modal. |
| Foco en input en home | Documentar o modo “Acumular escaneos” solo en home. |
| Presupuestos sin atajo | **Sin** atajo global; opcional en una fase 2 solo en `/presupuestos` (no solicitado; no incluido). |

## Acciones del modal (fases de producto)

Orden sugerido de implementación:

1. **Presupuesto:** pasar líneas (código → `producto_id` + cantidad) al flujo existente; integrar con [`presupuestos/page.tsx`](frontend/my-app/src/app/(dashboard)/presupuestos/page.tsx) (query, `sessionStorage` estructurado, o estado global tras login).
2. **Venta / lavandería / modista:** definir contrato por módulo ([`ventas`](frontend/my-app/src/app/(dashboard)/ventas/page.tsx), [`lavanderia`](frontend/my-app/src/app/(dashboard)/lavanderia/page.tsx), [`modista`](frontend/my-app/src/app/(dashboard)/modista/page.tsx)) para no duplicar reglas; botones pueden navegar con payload y dejar que cada pantalla confirme.

## Implementación técnica (resumen)

1. Reemplazar o refactorizar [`use-barcode-scan.ts`](frontend/my-app/src/hooks/use-barcode-scan.ts) / registro en layout: solo escucha “cola” si `pathname === '/dashboard'`; resto sin captura global de Enter.
2. Contexto o hook + **persistencia** (`localStorage`), clave con prefijo y versión; **borrar** en evento de logout (integrar con [`auth-context`](frontend/my-app/src/context/auth-context.tsx) o donde se haga `logout`).
3. UI `/dashboard`: badge, modal lista + acciones + “Vaciar cola”.
4. Validación: `GET` o endpoint existente por código al agregar; si 404, no encolar.

## Preguntas abiertas

Ninguna bloqueante; decisión fina opcional en implementación: **vaciar cola al confirmar navegación** vs **al éxito en destino** (recomendado lo segundo).

---

*Plan finiquitado a nivel producto; pendiente de ejecución por el usuario.*
