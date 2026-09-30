export type TipoPrecioProducto =
  | "precio_alquiler_lista"
  | "precio_alquiler_efectivo"
  | "precio_venta_nuevo_lista"
  | "precio_venta_nuevo_efectivo"
  | "precio_de_venta_medio_uso"
  | "precio_venta"
  | "precio_liquidacion";

export type ProductoPrecios = Partial<Record<TipoPrecioProducto, number | null | undefined>>;

export const TIPOS_PRECIO_PRODUCTO: ReadonlyArray<{
  value: TipoPrecioProducto;
  label: string;
}> = [
  { value: "precio_alquiler_lista", label: "Alquiler lista" },
  { value: "precio_alquiler_efectivo", label: "Alquiler efectivo" },
  { value: "precio_venta_nuevo_lista", label: "Venta nuevo lista" },
  { value: "precio_venta_nuevo_efectivo", label: "Venta nuevo efectivo" },
  { value: "precio_de_venta_medio_uso", label: "Medio uso" },
  { value: "precio_venta", label: "Venta final" },
  { value: "precio_liquidacion", label: "Liquidación" },
];

const TIPO_PRECIO_DEFAULT: TipoPrecioProducto = "precio_alquiler_lista";

const LEGACY_TIPO_MAP: Record<string, TipoPrecioProducto> = {
  Lista: "precio_alquiler_lista",
  Efectivo: "precio_alquiler_efectivo",
};

export function normalizarTipoPrecioProducto(
  tipo?: string | null
): TipoPrecioProducto {
  if (!tipo) return TIPO_PRECIO_DEFAULT;
  if (tipo in LEGACY_TIPO_MAP) return LEGACY_TIPO_MAP[tipo];
  if (TIPOS_PRECIO_PRODUCTO.some((t) => t.value === tipo)) {
    return tipo as TipoPrecioProducto;
  }
  return TIPO_PRECIO_DEFAULT;
}

export function labelTipoPrecioProducto(tipo?: string | null): string {
  const normalizado = normalizarTipoPrecioProducto(tipo);
  return (
    TIPOS_PRECIO_PRODUCTO.find((t) => t.value === normalizado)?.label ??
    normalizado
  );
}

export function precioProductoPorTipo(
  producto: ProductoPrecios,
  tipo?: string | null
): number {
  const normalizado = normalizarTipoPrecioProducto(tipo);
  const valor = producto[normalizado];
  if (valor != null && Number.isFinite(Number(valor))) {
    return Number(valor);
  }
  if (normalizado === "precio_alquiler_efectivo") {
    return Number(producto.precio_alquiler_lista ?? 0);
  }
  return 0;
}

export function inferirTipoPrecioProducto(
  producto: ProductoPrecios,
  precioUnitario: number
): TipoPrecioProducto {
  const precio = Number(precioUnitario);
  if (!Number.isFinite(precio)) return TIPO_PRECIO_DEFAULT;

  const coincidencias = TIPOS_PRECIO_PRODUCTO.filter(({ value }) => {
    const campo = producto[value];
    return campo != null && Number(campo) === precio;
  });

  if (coincidencias.length === 1) return coincidencias[0].value;
  if (coincidencias.length > 1) {
    const alquilerLista = coincidencias.find(
      (t) => t.value === "precio_alquiler_lista"
    );
    if (alquilerLista) return alquilerLista.value;
    return coincidencias[0].value;
  }

  return TIPO_PRECIO_DEFAULT;
}

const CAMPOS_PRECIO = new Set<string>(TIPOS_PRECIO_PRODUCTO.map((t) => t.value));

export function extraerPrecios(
  fuente: ProductoPrecios | null | undefined
): ProductoPrecios {
  const out: ProductoPrecios = {};
  if (!fuente) return out;
  for (const { value } of TIPOS_PRECIO_PRODUCTO) {
    const crudo = fuente[value];
    if (crudo == null) continue;
    const numero = Number(crudo);
    if (Number.isFinite(numero)) out[value] = numero;
  }
  return out;
}

export function tienePreciosCatalogo(
  precios: ProductoPrecios | null | undefined
): boolean {
  return Object.keys(extraerPrecios(precios)).length > 0;
}

/** El primer origen que trae un precio gana. Los que faltan se completan con el siguiente. */
export function fusionarPrecios(
  ...fuentes: Array<ProductoPrecios | null | undefined>
): ProductoPrecios {
  const out: ProductoPrecios = {};
  for (const fuente of fuentes) {
    const precios = extraerPrecios(fuente);
    for (const { value } of TIPOS_PRECIO_PRODUCTO) {
      if (out[value] == null && precios[value] != null) {
        out[value] = precios[value];
      }
    }
  }
  return out;
}

export function preciosCatalogoDesdeApi(raw: unknown): ProductoPrecios {
  if (!raw || typeof raw !== "object") return {};
  const item = raw as ProductoPrecios & { producto?: ProductoPrecios | null };
  return fusionarPrecios(item, item.producto ?? undefined);
}

/**
 * Un producto incompleto no pisa el catálogo.
 * Si el que llega trae precios, esos actualizan y lo que falte se conserva.
 */
export function fusionarProductoEnCache<T extends ProductoPrecios>(
  prev: T | undefined,
  incoming: T
): T {
  const incomingPrecios = extraerPrecios(incoming);
  if (!prev) return { ...incoming, ...incomingPrecios };
  const precios = tienePreciosCatalogo(incomingPrecios)
    ? fusionarPrecios(incomingPrecios, extraerPrecios(prev))
    : extraerPrecios(prev);
  const next = { ...prev };
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    if (CAMPOS_PRECIO.has(String(key))) continue;
    const valor = incoming[key];
    if (valor == null) continue;
    next[key] = valor;
  }
  return { ...next, ...precios };
}

export function precioBaseSinDescuento(
  precioGuardado: number,
  porcentaje: number | null | undefined
): number {
  const guardado = Number(precioGuardado);
  const pct = Number(porcentaje ?? 0);
  if (!Number.isFinite(guardado)) return 0;
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return guardado;
  return guardado / (1 - pct / 100);
}

function limiteCercania(catalogo: number): number {
  return Math.max(2, Math.abs(catalogo) * 0.01);
}

function buscarTipoEnCatalogo(
  producto: ProductoPrecios,
  precio: number
): { tipo: TipoPrecioProducto; coincide: boolean } {
  let mejor: { value: TipoPrecioProducto; diff: number } | null = null;
  for (const { value } of TIPOS_PRECIO_PRODUCTO) {
    const campo = producto[value];
    if (campo == null || !Number.isFinite(Number(campo))) continue;
    const catalogo = Number(campo);
    const diff = Math.abs(catalogo - precio);
    if (diff > limiteCercania(catalogo)) continue;
    if (!mejor || diff < mejor.diff - 0.001) {
      mejor = { value, diff };
      continue;
    }
    if (Math.abs(diff - mejor.diff) <= 0.001 && value === TIPO_PRECIO_DEFAULT) {
      mejor = { value, diff };
    }
  }
  if (!mejor) return { tipo: TIPO_PRECIO_DEFAULT, coincide: false };
  return { tipo: mejor.value, coincide: true };
}

/**
 * Precio al cambiar el tipo. Si el catálogo no tiene ese campo, se conserva el actual
 * en lugar de poner 0. Un 0 guardado en el producto sí se respeta.
 */
export function precioAlCambiarTipo(
  precios: ProductoPrecios | null | undefined,
  tipo: string | null | undefined,
  precioActual: number
): number {
  const normalizado = normalizarTipoPrecioProducto(tipo);
  const fuente = extraerPrecios(precios);
  const valor = fuente[normalizado];
  if (valor != null && Number.isFinite(Number(valor))) return Number(valor);
  if (normalizado === "precio_alquiler_efectivo") {
    const lista = fuente.precio_alquiler_lista;
    if (lista != null && Number.isFinite(Number(lista))) return Number(lista);
  }
  const actual = Number(precioActual);
  return Number.isFinite(actual) ? actual : 0;
}

type ItemPrecioEditable = {
  precioUnitario: number;
  cantidad: number;
  tipoPrecio?: string | null;
  preciosCatalogo?: ProductoPrecios | null;
};

export function prepararItemsParaEdicion<T extends ItemPrecioEditable>(
  items: T[],
  porcentaje: number | null | undefined
): {
  items: Array<
    T & {
      tipoPrecio: TipoPrecioProducto;
      precioUnitario: number;
      subtotal: number;
      preciosCatalogo?: ProductoPrecios;
    }
  >;
  porcentajeDescuento: number | null;
  totalConDescuento: number | null;
} {
  const pct = Number(porcentaje ?? 0);
  const hayPorcentaje = Number.isFinite(pct) && pct > 0 && pct < 100;
  const todosConCatalogo =
    items.length > 0 &&
    items.every((item) => tienePreciosCatalogo(item.preciosCatalogo));
  const restaurarDescuento = hayPorcentaje && todosConCatalogo;

  const next = items.map((item) => {
    const precios = extraerPrecios(item.preciosCatalogo);
    const cantidad = Number(item.cantidad) || 0;
    const guardado = Number(item.precioUnitario);
    const conCatalogo = tienePreciosCatalogo(precios)
      ? { preciosCatalogo: precios }
      : {};

    if (!restaurarDescuento) {
      if (tienePreciosCatalogo(precios) && !hayPorcentaje) {
        const hallado = buscarTipoEnCatalogo(precios, guardado);
        const precioUnitario = hallado.coincide
          ? precioProductoPorTipo(precios, hallado.tipo)
          : guardado;
        return {
          ...item,
          ...conCatalogo,
          tipoPrecio: hallado.tipo,
          precioUnitario,
          subtotal: precioUnitario * cantidad,
        };
      }
      return {
        ...item,
        ...conCatalogo,
        tipoPrecio: normalizarTipoPrecioProducto(item.tipoPrecio),
        precioUnitario: guardado,
        subtotal: guardado * cantidad,
      };
    }

    const base = precioBaseSinDescuento(guardado, pct);
    const hallado = buscarTipoEnCatalogo(precios, base);
    const precioUnitario = hallado.coincide
      ? precioProductoPorTipo(precios, hallado.tipo)
      : Math.round(base);
    return {
      ...item,
      preciosCatalogo: precios,
      tipoPrecio: hallado.tipo,
      precioUnitario,
      subtotal: precioUnitario * cantidad,
    };
  });

  if (!restaurarDescuento) {
    return { items: next, porcentajeDescuento: null, totalConDescuento: null };
  }
  const totalOriginal = next.reduce((suma, item) => suma + item.subtotal, 0);
  return {
    items: next,
    porcentajeDescuento: pct,
    totalConDescuento: Math.round(totalOriginal * (1 - pct / 100)),
  };
}

export function aplicarTipoPrecioAItems<T extends ItemPrecioEditable>(
  items: T[],
  tipo: string | null | undefined,
  porcentajeDescuento: number | null | undefined
): {
  items: Array<
    T & {
      tipoPrecio: TipoPrecioProducto;
      precioUnitario: number;
      subtotal: number;
    }
  >;
  totalConDescuento: number | null;
} {
  const tipoNorm = normalizarTipoPrecioProducto(tipo);
  const next = items.map((item) => {
    const precioUnitario = precioAlCambiarTipo(
      item.preciosCatalogo,
      tipoNorm,
      item.precioUnitario
    );
    const cantidad = Number(item.cantidad) || 0;
    return {
      ...item,
      tipoPrecio: tipoNorm,
      precioUnitario,
      subtotal: precioUnitario * cantidad,
    };
  });
  const pct = Number(porcentajeDescuento ?? 0);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
    return { items: next, totalConDescuento: null };
  }
  const total = next.reduce((suma, item) => suma + item.subtotal, 0);
  return {
    items: next,
    totalConDescuento: Math.round(total * (1 - pct / 100)),
  };
}
