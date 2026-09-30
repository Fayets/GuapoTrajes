import assert from "node:assert/strict";
import {
  aplicarTipoPrecioAItems,
  fusionarProductoEnCache,
  prepararItemsParaEdicion,
  precioAlCambiarTipo,
} from "./tipos-precio-producto.ts";

const catalogo = {
  precio_alquiler_lista: 100000,
  precio_alquiler_efectivo: 80000,
  precio_venta_nuevo_lista: 250000,
  precio_venta_nuevo_efectivo: 220000,
  precio_de_venta_medio_uso: 150000,
  precio_venta: 90000,
  precio_liquidacion: 40000,
};

const itemEfectivoConDescuento = {
  productoId: 7,
  cantidad: 1,
  precioUnitario: 72000,
  tipoPrecio: "precio_alquiler_lista" as const,
  preciosCatalogo: catalogo,
};

const editado = prepararItemsParaEdicion([itemEfectivoConDescuento], 10);
assert.equal(editado.items[0].tipoPrecio, "precio_alquiler_efectivo");
assert.equal(editado.items[0].precioUnitario, 80000);
assert.equal(editado.porcentajeDescuento, 10);
assert.equal(editado.totalConDescuento, 72000);

const alCambiar = aplicarTipoPrecioAItems(editado.items, "precio_de_venta_medio_uso", 10);
assert.equal(alCambiar.items[0].precioUnitario, 150000);
assert.equal(alCambiar.items[0].tipoPrecio, "precio_de_venta_medio_uso");
assert.equal(alCambiar.totalConDescuento, 135000);
assert.notEqual(alCambiar.items[0].precioUnitario, 0);

const liquidacion = aplicarTipoPrecioAItems(
  editado.items,
  "precio_liquidacion",
  10
);
assert.equal(liquidacion.items[0].precioUnitario, 40000);
assert.equal(liquidacion.totalConDescuento, 36000);

const sinCampo = precioAlCambiarTipo(
  { precio_alquiler_lista: 72000 },
  "precio_de_venta_medio_uso",
  72000
);
assert.equal(sinCampo, 72000);

const liquidacionCero = precioAlCambiarTipo(
  { ...catalogo, precio_liquidacion: 0 },
  "precio_liquidacion",
  80000
);
assert.equal(liquidacionCero, 0);

const cachePrevio = {
  id: 7,
  descripcion: "Ambo",
  ...catalogo,
};
const stubIncompleto = {
  id: 7,
  descripcion: "Ambo",
  inmovilizado: false,
};
const cache = fusionarProductoEnCache(cachePrevio, stubIncompleto);
assert.equal(cache.precio_alquiler_efectivo, 80000);
assert.equal(cache.precio_de_venta_medio_uso, 150000);
assert.equal(cache.precio_liquidacion, 40000);

const sinCatalogo = prepararItemsParaEdicion(
  [{ cantidad: 1, precioUnitario: 72000, tipoPrecio: "precio_alquiler_efectivo" }],
  10
);
assert.equal(sinCatalogo.items[0].precioUnitario, 72000);
assert.equal(sinCatalogo.porcentajeDescuento, null);
assert.equal(sinCatalogo.totalConDescuento, null);

const factor = (editado.totalConDescuento ?? 0) / editado.items[0].precioUnitario;
assert.equal(Math.round(editado.items[0].precioUnitario * factor), 72000);
assert.notEqual(Math.round(72000 * factor), 72000);

console.log("tipos-precio-producto: ok");
