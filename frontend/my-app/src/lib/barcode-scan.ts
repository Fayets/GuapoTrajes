/** Clave en sessionStorage para código pendiente (navegación a presupuestos). */
export const GUAPO_PENDING_BARCODE_KEY = "guapo_pending_barcode";

/** Nombre del evento cuando se leyó un código (misma ruta /presupuestos sin remount). */
export const GUAPO_BARCODE_SCAN_EVENT = "guapo:barcode-scan";

export type GuapoBarcodeScanDetail = { code: string };

export function isPlausibleProductBarcode(code: string): boolean {
  const t = code.trim();
  if (t.length < 6 || t.length > 48) return false;
  return /^[A-Za-z0-9]+$/.test(t);
}

export function shouldIgnoreBarcodeTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  if (el.closest("[data-no-barcode]")) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}
