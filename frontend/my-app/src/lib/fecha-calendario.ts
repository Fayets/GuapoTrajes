/** Zona horaria fija del negocio (no usar la del navegador para fechas de alquiler). */
export const ZONA_HORA_ARGENTINA = "America/Argentina/Buenos_Aires" as const;

/** Parsea "YYYY-MM-DD" en medianoche local del navegador (solo para inputs sin TZ). */
export function parseDateLocal(iso: string): Date {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date(iso);
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/** Formatea un Date en YYYY-MM-DD según el calendario local del navegador. */
export function formatDateYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Día civil YYYY-MM-DD en Argentina a partir de un instante (Date). */
export function formatDateYmdArgentina(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORA_ARGENTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

/** Toma solo YYYY-MM-DD inicial de un string (API o input). */
export function fechaIsoCalendario(val: string | null | undefined): string {
  const t = (val ?? "").trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/**
 * Día civil YYYY-MM-DD para presupuestos (Argentina).
 * - Solo "YYYY-MM-DD" → tal cual (día civil sin conversión).
 * - Cualquier ISO con hora → día del calendario en America/Argentina/Buenos_Aires.
 */
export function fechaNegocioYmd(val: string | null | undefined): string {
  const t = (val ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  try {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return fechaIsoCalendario(t);
    }
    return formatDateYmdArgentina(d);
  } catch {
    return fechaIsoCalendario(t);
  }
}

/** Compara YYYY-MM-DD (orden lexicográfico = orden cronológico). */
export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Suma días a YYYY-MM-DD (calendario gregoriano, aritmética UTC interna, sin TZ del navegador). */
export function addDaysYmd(ymd: string, delta: number): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const t = Date.UTC(y, mo, d) + delta * 86400000;
  const x = new Date(t);
  const yy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(x.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Día de la semana 0=domingo … 6=sábado para el triple civil YYYY-MM-DD. */
export function ymdWeekdayUtc(ymd: string): number {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

export function formatDdMmYyyyDesdeIso(iso: string): string {
  const base = fechaNegocioYmd(iso);
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return base || "";
  const [y, m, d] = base.split("-");
  return `${d}/${m}/${y}`;
}
