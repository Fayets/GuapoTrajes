/**
 * Prueba del modo de cotización rápida. No toca la base de datos.
 * Corre: node --experimental-strip-types scripts/quick-quote-test.mts
 */
import { shouldValidateQuoteAvailability } from "../src/lib/scan-queue.ts";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

assertEqual(
  shouldValidateQuoteAvailability("", "", ""),
  false,
  "permite cotizar sin cliente ni fechas"
);
assertEqual(
  shouldValidateQuoteAvailability("2026-07-18", "", ""),
  false,
  "no valida disponibilidad con ventana incompleta"
);
assertEqual(
  shouldValidateQuoteAvailability("2026-07-18", "2026-07-17", "2026-07-20"),
  true,
  "valida disponibilidad cuando están todas las fechas"
);
assertEqual(
  shouldValidateQuoteAvailability("  ", "2026-07-17", "2026-07-20"),
  false,
  "ignora fechas vacías con espacios"
);

console.log("OK quick quote: todos los asserts pasaron");
