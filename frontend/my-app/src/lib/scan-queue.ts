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

/**
 * Una cotización rápida puede mostrar prendas y precios sin fechas.
 * La disponibilidad por reservas solo se debe consultar cuando la ventana
 * completa del alquiler ya fue definida.
 */
export function shouldValidateQuoteAvailability(
  fechaEvento?: string | null,
  fechaRetiro?: string | null,
  fechaDevolucion?: string | null
): boolean {
  return Boolean(
    fechaEvento?.trim() &&
      fechaRetiro?.trim() &&
      fechaDevolucion?.trim()
  );
}

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

function parseImportPayload(raw: string): ScanQueueRow[] {
  try {
    const parsed = JSON.parse(raw) as { items?: ScanQueueRow[] };
    if (!Array.isArray(parsed?.items)) return [];
    return parsed.items.filter(
      (r) => r && typeof r.productoId === "number" && !Number.isNaN(r.productoId)
    );
  } catch {
    return [];
  }
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("guapo-scan-queue-updated"));
    }
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

/**
 * Memoria de módulo: sobrevive al remount de React Strict Mode.
 * Antes se borraba sessionStorage en el primer mount y el segundo perdía la cola.
 */
let presupuestoImportMemory: ScanQueueRow[] | null = null;
let ventaImportMemory: ScanQueueRow[] | null = null;

/** @internal tests */
export function _resetImportMemoryForTests(): void {
  presupuestoImportMemory = null;
  ventaImportMemory = null;
  lastPresupuestoImportNotifyKey = "";
}

let lastPresupuestoImportNotifyKey = "";

export function stashPresupuestoImport(items: ScanQueueRow[]): boolean {
  if (!items.length) return false;
  presupuestoImportMemory = items;
  lastPresupuestoImportNotifyKey = "";
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        GUAPO_PRESUPUESTO_IMPORT_PAYLOAD,
        JSON.stringify({ items })
      );
    }
    return true;
  } catch {
    return true;
  }
}

export function peekPresupuestoImport(): ScanQueueRow[] | null {
  if (presupuestoImportMemory?.length) return presupuestoImportMemory;
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(GUAPO_PRESUPUESTO_IMPORT_PAYLOAD);
    if (!raw?.trim()) return null;
    const rows = parseImportPayload(raw);
    if (!rows.length) return null;
    presupuestoImportMemory = rows;
    return rows;
  } catch {
    return null;
  }
}

export function clearPresupuestoImport(): void {
  presupuestoImportMemory = null;
  lastPresupuestoImportNotifyKey = "";
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(GUAPO_PRESUPUESTO_IMPORT_PAYLOAD);
    }
  } catch {
    /* ignore */
  }
}

/** Evita toast duplicado por remount de Strict Mode. */
export function shouldNotifyPresupuestoImport(rows: ScanQueueRow[]): boolean {
  const key = rows.map((r) => r.productoId).join(",");
  if (!key || key === lastPresupuestoImportNotifyKey) return false;
  lastPresupuestoImportNotifyKey = key;
  return true;
}

export function stashVentaImport(items: ScanQueueRow[]): boolean {
  if (!items.length) return false;
  ventaImportMemory = items;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        GUAPO_VENTA_IMPORT_PAYLOAD,
        JSON.stringify({ items })
      );
    }
    return true;
  } catch {
    return true;
  }
}

export function peekVentaImport(): ScanQueueRow[] | null {
  if (ventaImportMemory?.length) return ventaImportMemory;
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(GUAPO_VENTA_IMPORT_PAYLOAD);
    if (!raw?.trim()) return null;
    const rows = parseImportPayload(raw);
    if (!rows.length) return null;
    ventaImportMemory = rows;
    return rows;
  } catch {
    return null;
  }
}

export function clearVentaImport(): void {
  ventaImportMemory = null;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(GUAPO_VENTA_IMPORT_PAYLOAD);
    }
  } catch {
    /* ignore */
  }
}
