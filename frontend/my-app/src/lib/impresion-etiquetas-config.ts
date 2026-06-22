export type TipoImpresionEtiqueta = "resumen_conjunto" | "prenda_individual";

export type ConfigImpresionEtiquetas = {
  /** Si QZ Tray está instalado, imprime directo a la impresora configurada */
  usarQzTray: boolean;
  /** Fragmento del nombre de la impresora (ej. "XP-470B") */
  impresoraResumenConjunto: string;
  /** Fragmento del nombre de la impresora Zebra */
  impresoraEtiquetaPrenda: string;
};

const STORAGE_KEY = "guapotrajes:impresion-etiquetas";

export const DEFAULT_CONFIG_IMPRESION_ETIQUETAS: ConfigImpresionEtiquetas = {
  usarQzTray: true,
  impresoraResumenConjunto: "XP-470B",
  impresoraEtiquetaPrenda: "Zebra",
};

export function leerConfigImpresionEtiquetas(): ConfigImpresionEtiquetas {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CONFIG_IMPRESION_ETIQUETAS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG_IMPRESION_ETIQUETAS };
    const parsed = JSON.parse(raw) as Partial<ConfigImpresionEtiquetas>;
    return {
      usarQzTray:
        typeof parsed.usarQzTray === "boolean"
          ? parsed.usarQzTray
          : DEFAULT_CONFIG_IMPRESION_ETIQUETAS.usarQzTray,
      impresoraResumenConjunto:
        (parsed.impresoraResumenConjunto || "").trim() ||
        DEFAULT_CONFIG_IMPRESION_ETIQUETAS.impresoraResumenConjunto,
      impresoraEtiquetaPrenda:
        (parsed.impresoraEtiquetaPrenda || "").trim() ||
        DEFAULT_CONFIG_IMPRESION_ETIQUETAS.impresoraEtiquetaPrenda,
    };
  } catch {
    return { ...DEFAULT_CONFIG_IMPRESION_ETIQUETAS };
  }
}

export function guardarConfigImpresionEtiquetas(
  config: ConfigImpresionEtiquetas
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function patronImpresoraPorTipo(
  tipo: TipoImpresionEtiqueta,
  config: ConfigImpresionEtiquetas = leerConfigImpresionEtiquetas()
): string {
  return tipo === "resumen_conjunto"
    ? config.impresoraResumenConjunto
    : config.impresoraEtiquetaPrenda;
}

export function nombreImpresoraSugerida(tipo: TipoImpresionEtiqueta): string {
  const config = leerConfigImpresionEtiquetas();
  return patronImpresoraPorTipo(tipo, config);
}
