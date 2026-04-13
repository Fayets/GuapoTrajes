"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  SCAN_QUEUE_STORAGE_KEY,
  loadScanQueue,
  saveScanQueue,
  clearScanQueue,
  applyToggleProductInQueue,
  type ScanQueueRow,
} from "@/lib/scan-queue";
import { isPlausibleProductBarcode, shouldIgnoreBarcodeTarget } from "@/lib/barcode-scan";

const BUFFER_MAX = 64;

function toastAfterToggle(
  prev: ScanQueueRow[],
  next: ScanQueueRow[],
  meta: Pick<ScanQueueRow, "productoId" | "descripcion">
) {
  const had = prev.some((x) => x.productoId === meta.productoId);
  const has = next.some((x) => x.productoId === meta.productoId);
  if (!had && has) {
    toast.success(`Agregado a la cola: ${meta.descripcion}`);
    return;
  }
  if (had && !has) {
    toast.success(`Quitado de la cola: ${meta.descripcion}`);
  }
}

export function useScanQueueWithScanner(options: { listen: boolean }) {
  const [items, setItems] = useState<ScanQueueRow[]>(() =>
    typeof window !== "undefined" ? loadScanQueue() : []
  );

  const persist = useCallback((next: ScanQueueRow[]) => {
    setItems(next);
    saveScanQueue(next);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SCAN_QUEUE_STORAGE_KEY) {
        setItems(loadScanQueue());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!options.listen) return;

    const bufferRef = { current: "" };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (shouldIgnoreBarcodeTarget(e.target)) {
        bufferRef.current = "";
        return;
      }
      if (e.key === "Escape") {
        bufferRef.current = "";
        return;
      }
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (!code || !isPlausibleProductBarcode(code)) return;
        e.preventDefault();
        void (async () => {
          const token = localStorage.getItem("token");
          const res = await fetch(
            `${getApiBaseUrl()}/productos/get/${encodeURIComponent(code)}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token ?? ""}`,
              },
            }
          );
          if (!res.ok) {
            toast.error("Código no encontrado.");
            return;
          }
          const p = (await res.json()) as Record<string, unknown>;
          const meta: Pick<
            ScanQueueRow,
            | "productoId"
            | "codigoBarra"
            | "descripcion"
            | "precio_alquiler_efectivo"
          > = {
            productoId: Number(p.id),
            codigoBarra: String(p.codigo_barra ?? ""),
            descripcion: String(p.descripcion ?? ""),
            precio_alquiler_efectivo: Number(p.precio_alquiler_efectivo ?? 0),
          };
          const prev = loadScanQueue();
          const next = applyToggleProductInQueue(prev, meta);
          saveScanQueue(next);
          setItems(next);
          toastAfterToggle(prev, next, meta);
        })();
        return;
      }
      if (e.key.length === 1) {
        const ch = e.key;
        if (ch >= " " && ch <= "~") {
          bufferRef.current += ch;
          if (bufferRef.current.length > BUFFER_MAX) {
            bufferRef.current = bufferRef.current.slice(-BUFFER_MAX);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [options.listen]);

  const clearAll = useCallback(() => {
    clearScanQueue();
    setItems([]);
  }, []);

  const removeLine = useCallback(
    (productoId: number) => {
      const next = loadScanQueue().filter((i) => i.productoId !== productoId);
      persist(next);
    },
    [persist]
  );

  return { items, clearAll, removeLine, persist };
}
