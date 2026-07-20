/**
 * Eliminación diferida con deshacer (patrón Gmail).
 * El DELETE a la API se ejecuta a los 10s o al salir de la página;
 * Deshacer / cerrar el toast cancela y restaura en UI.
 */

import { toast } from "sonner";

export const UNDOABLE_DELETE_MS = 10_000;

type PendingDelete = {
  id: string;
  status: "pending" | "undone" | "committed";
  timer: ReturnType<typeof setTimeout>;
  toastId: string | number;
  executeDelete: () => Promise<void>;
  onRestore: () => void;
};

const pendingDeletes = new Map<string, PendingDelete>();

export type ScheduleUndoableDeleteOptions = {
  /** Clave estable (ej. `orden-12`). Si se omite, se genera una. */
  id?: string;
  /** Título del toast */
  message: string;
  /** Texto secundario opcional */
  description?: string;
  durationMs?: number;
  /** Quitar de la lista / UI de inmediato */
  onOptimisticRemove: () => void;
  /** Volver a mostrar el ítem si se deshace */
  onRestore: () => void;
  /** DELETE real (o lógica equivalente) */
  executeDelete: () => Promise<void>;
  /** Mensaje si el DELETE falla tras el timeout */
  errorMessage?: string;
};

function genId(): string {
  return `del-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function commitPending(entry: PendingDelete): Promise<void> {
  if (entry.status !== "pending") return;
  entry.status = "committed";
  clearTimeout(entry.timer);
  pendingDeletes.delete(entry.id);
  try {
    toast.dismiss(entry.toastId);
  } catch {
    /* ignore */
  }
  try {
    await entry.executeDelete();
  } catch (err) {
    entry.onRestore();
    const msg =
      err instanceof Error ? err.message : "No se pudo completar la eliminación";
    toast.error(msg);
  }
}

function undoPending(entry: PendingDelete): void {
  if (entry.status !== "pending") return;
  entry.status = "undone";
  clearTimeout(entry.timer);
  pendingDeletes.delete(entry.id);
  try {
    toast.dismiss(entry.toastId);
  } catch {
    /* ignore */
  }
  entry.onRestore();
}

/**
 * Programa una eliminación diferida y muestra toast con Deshacer.
 * @returns id del pendiente (útil para tests / cancelación manual)
 */
export function scheduleUndoableDelete(
  options: ScheduleUndoableDeleteOptions
): string {
  const id = options.id ?? genId();
  const durationMs = options.durationMs ?? UNDOABLE_DELETE_MS;

  // Si ya había un pendiente con el mismo id, confirmar el anterior primero
  const existing = pendingDeletes.get(id);
  if (existing && existing.status === "pending") {
    void commitPending(existing);
  }

  options.onOptimisticRemove();

  const entry: PendingDelete = {
    id,
    status: "pending",
    timer: setTimeout(() => {
      void commitPending(entry);
    }, durationMs),
    toastId: "",
    executeDelete: options.executeDelete,
    onRestore: options.onRestore,
  };

  const toastId = toast(options.message, {
    description: options.description,
    // Duración infinita: el timer propio confirma el DELETE; así onDismiss
    // solo corre por X / dismiss manual o tras commit/undo ya marcados.
    duration: Infinity,
    position: "bottom-right",
    action: {
      label: "Deshacer",
      onClick: () => undoPending(entry),
    },
    onDismiss: () => {
      if (entry.status === "pending") {
        undoPending(entry);
      }
    },
  });

  entry.toastId = toastId;
  pendingDeletes.set(id, entry);
  return id;
}

/** Cancela y restaura sin ejecutar DELETE (si sigue pendiente). */
export function cancelUndoableDelete(id: string): boolean {
  const entry = pendingDeletes.get(id);
  if (!entry || entry.status !== "pending") return false;
  undoPending(entry);
  return true;
}

/**
 * Ejecuta todos los DELETE pendientes (navegación / cierre de pestaña).
 * Fire-and-forget; en beforeunload el navegador puede cortar awaits.
 */
export function flushPendingDeletes(): void {
  const entries = Array.from(pendingDeletes.values());
  for (const entry of entries) {
    if (entry.status === "pending") {
      void commitPending(entry);
    }
  }
}

export function hasPendingDeletes(): boolean {
  return pendingDeletes.size > 0;
}

/** Cantidad de eliminaciones aún no confirmadas en API (tests / debug). */
export function pendingDeletesCount(): number {
  return pendingDeletes.size;
}
