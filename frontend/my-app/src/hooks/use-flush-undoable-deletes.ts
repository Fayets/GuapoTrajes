"use client";

import { useEffect } from "react";
import { flushPendingDeletes } from "@/lib/undoable-delete";

/**
 * Al desmontar o cerrar/recargar la pestaña, confirma los DELETE diferidos pendientes.
 */
export function useFlushUndoableDeletesOnLeave(): void {
  useEffect(() => {
    const onBeforeUnload = () => {
      flushPendingDeletes();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushPendingDeletes();
    };
  }, []);
}
