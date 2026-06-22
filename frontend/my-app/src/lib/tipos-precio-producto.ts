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

export function resumenPreciosProducto(producto: ProductoPrecios): string {
  return TIPOS_PRECIO_PRODUCTO.map(
    ({ value, label }) =>
      `${label}: $${precioProductoPorTipo(producto, value).toLocaleString("es-AR")}`
  ).join(" · ");
}
