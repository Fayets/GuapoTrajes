/** Montos en pesos argentinos (enteros). */

export function roundPesos(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * Parsea input de monto: acepta 7000, 7.000, 7.000,50, 7,000 (miles) o 7,50.
 * Siempre redondea a peso entero para evitar 7000 → 6999 por float.
 */
export function parseMontoInput(raw: string): number {
  if (!raw?.trim()) return NaN;
  let normalized = raw.trim().replace(/\s/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // El separador decimal es el que aparece último
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 7.000,50 (AR)
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // 7,000.50 (US)
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
      // 7,000 → miles
      normalized = normalized.replace(/,/g, "");
    } else {
      // 7,50 → decimal
      normalized = normalized.replace(",", ".");
    }
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // 7.000 → miles AR
    normalized = normalized.replace(/\./g, "");
  }

  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return NaN;
  return roundPesos(n);
}

/**
 * Formatea pesos con separador de miles argentino (punto), sin símbolo.
 * Ej: 1000 → "1.000", 40059 → "40.059"
 *
 * No depende del locale del navegador (evita "1000" o "1,000").
 */
export function formatPesosAr(value: number): string {
  const n = roundPesos(value);
  const neg = n < 0;
  const digits = String(Math.abs(n));
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg ? `-${withDots}` : withDots;
}

/**
 * Formatea pesos con símbolo $ y miles con punto.
 * Ej: 1000 → "$1.000", -2500 → "-$2.500"
 */
export function formatMoneyAr(value: number): string {
  const formatted = formatPesosAr(value);
  if (formatted.startsWith("-")) return `-$${formatted.slice(1)}`;
  return `$${formatted}`;
}
