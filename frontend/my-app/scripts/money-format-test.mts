/**
 * Prueba de formato de montos ($1.000). No toca base de datos.
 * Corre: node --experimental-strip-types scripts/money-format-test.mts
 */
import {
  formatMoneyAr,
  formatPesosAr,
  parseMontoInput,
  roundPesos,
} from "../src/lib/money.ts";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

assertEqual(formatPesosAr(1000), "1.000", "miles simples");
assertEqual(formatPesosAr(40059), "40.059", "caso 40059");
assertEqual(formatPesosAr(1000000), "1.000.000", "millon");
assertEqual(formatPesosAr(0), "0", "cero");
assertEqual(formatPesosAr(-2500), "-2.500", "negativo");
assertEqual(formatMoneyAr(1000), "$1.000", "con simbolo");
assertEqual(formatMoneyAr(40059), "$40.059", "con simbolo 40059");
assertEqual(formatMoneyAr(-1500), "-$1.500", "negativo con simbolo");
assertEqual(formatMoneyAr(999), "$999", "sin miles");
assertEqual(parseMontoInput("1.000"), 1000, "parse miles AR");
assertEqual(parseMontoInput("40.059"), 40059, "parse 40.059");
assertEqual(roundPesos(1000.4), 1000, "round");

const mil = formatPesosAr(1000);
if (!mil.includes(".")) {
  throw new Error(`1000 debe verse como 1.000, quedó ${mil}`);
}
if (formatMoneyAr(1000) === "$1000" || formatMoneyAr(1000) === "1000") {
  throw new Error("formatMoneyAr(1000) no debe ser $1000 sin separador");
}

console.log("OK money.format: todos los asserts pasaron");
