export const SCAN_QUEUE_STORAGE_KEY = "guapo_scan_queue_v1";

/** Payload one-shot al navegar a Presupuestos con la cola actual. */
export const GUAPO_PRESUPUESTO_IMPORT_PAYLOAD =
  "guapo_presupuesto_import_from_scan_queue";

/** Payload one-shot al navegar a Ventas con la cola actual. */
export const GUAPO_VENTA_IMPORT_PAYLOAD = "guapo_venta_import_from_scan_queue";

/** Cada prenda es única: una entrada por producto (sin cantidad). */
export type ScanQueueRow = {
  productoId: number;
  codigoBarra: string;
  descripcion: string;
  precio_alquiler_efectivo: number;
};

type ScanQueueFileV2 = { v: 2; items: ScanQueueRow[] };
type ScanQueueFileV1 = {
  v: 1;
  items: Array<
    ScanQueueRow & {
      cantidad?: number;
    }
  >;
};

function migrateV1ToRows(items: ScanQueueFileV1["items"]): ScanQueueRow[] {
  const seen = new Set<number>();
  const out: ScanQueueRow[] = [];
  for (const it of items) {
    const id = Number(it.productoId);
    if (Number.isNaN(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      productoId: id,
      codigoBarra: String(it.codigoBarra ?? ""),
      descripcion: String(it.descripcion ?? ""),
      precio_alquiler_efectivo: Number(it.precio_alquiler_efectivo ?? 0),
    });
  }
  return out;
}

function parseStored(raw: string): ScanQueueRow[] {
  try {
    const data = JSON.parse(raw) as ScanQueueFileV2 | ScanQueueFileV1;
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
      return [];
    }
    if (data.v === 2) {
      return data.items.filter(
        (r) =>
          r &&
          typeof r.productoId === "number" &&
          !Number.isNaN(r.productoId)
      );
    }
    if (data.v === 1) {
      return migrateV1ToRows(data.items);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function loadScanQueue(): ScanQueueRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCAN_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return parseStored(raw);
  } catch {
    return [];
  }
}

export function saveScanQueue(items: ScanQueueRow[]): void {
  try {
    localStorage.setItem(
      SCAN_QUEUE_STORAGE_KEY,
      JSON.stringify({ v: 2, items } satisfies ScanQueueFileV2)
    );
  } catch {
    /* ignore */
  }
}

export function clearScanQueue(): void {
  try {
    localStorage.removeItem(SCAN_QUEUE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Si el producto ya está en cola: lo quita.
 * Si no está: lo agrega (una unidad — prenda única).
 */
export function applyToggleProductInQueue(
  items: ScanQueueRow[],
  meta: Pick<
    ScanQueueRow,
    "productoId" | "codigoBarra" | "descripcion" | "precio_alquiler_efectivo"
  >
): ScanQueueRow[] {
  const idx = items.findIndex((i) => i.productoId === meta.productoId);
  if (idx >= 0) {
    const next = [...items];
    next.splice(idx, 1);
    return next;
  }
  return [
    ...items,
    {
      productoId: meta.productoId,
      codigoBarra: meta.codigoBarra,
      descripcion: meta.descripcion,
      precio_alquiler_efectivo: meta.precio_alquiler_efectivo,
    },
  ];
}
