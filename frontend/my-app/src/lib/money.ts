/** Montos en pesos argentinos (enteros). */

export function roundPesos(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/** Parsea input de monto: acepta 7000, 7.000 o 7.000,50 */
export function parseMontoInput(raw: string): number {
  if (!raw?.trim()) return NaN;
  let normalized = raw.trim().replace(/\s/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return NaN;
  return roundPesos(n);
}

export function formatPesosAr(value: number): string {
  return roundPesos(value).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
