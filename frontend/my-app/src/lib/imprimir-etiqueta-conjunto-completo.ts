/**
 * Etiqueta resumen del conjunto a armar (50×100 mm, vertical) — Xprinter XP-470B.
 * Una sola etiqueta por orden con cliente, fechas, evento, lugar y listado de prendas.
 * Separada de las etiquetas individuales por prenda (con código de barras).
 */

import { imprimirEtiquetaConRouting } from "@/lib/imprimir-etiqueta-routing";

/** Etiqueta física 100×50 mm impresa en vertical → 50 mm ancho × 100 mm alto */
export const ETIQUETA_RESUMEN_ANCHO_MM = 50;
export const ETIQUETA_RESUMEN_ALTO_MM = 100;

const ETIQUETA_ANCHO_MM = ETIQUETA_RESUMEN_ANCHO_MM;
const ETIQUETA_ALTO_MM = ETIQUETA_RESUMEN_ALTO_MM;
const ETIQUETA_MARGEN_MM = 1.5;
const LOGO_GUAPO_RUTA = "/guapo-logo.png";

let logoGuapoDataUrlCache: string | null = null;

/** Logo embebido en base64 para impresión fiable (navegador y QZ Tray). */
export async function obtenerLogoGuapoDataUrl(): Promise<string | null> {
  if (logoGuapoDataUrlCache) return logoGuapoDataUrlCache;
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch(
      `${window.location.origin}${LOGO_GUAPO_RUTA}`,
      { cache: "force-cache" }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    logoGuapoDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

export type PrendaResumenEntrada = {
  linea: string | null;
  talle: string | null;
  color: string | null;
  descripcion: string;
  cantidad: number;
};

export type ItemEtiquetaResumenConjunto = {
  ordenId: number;
  clienteNombre: string;
  fechaRetiro: string;
  fechaEvento: string;
  categoriaEvento: string;
  lugarEvento: string;
  lineasPrendas: string[];
};

export type ImpresionResumenConjuntoResultado = {
  resultado: "ok" | "error";
  metodo?: "qz" | "navegador";
  impresora?: string;
  mensajeAyuda?: string;
};

const ETIQUETA_RESUMEN_STYLES = `<style>
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body {
    margin: 0; padding: 0; background: #fff; direction: ltr;
    font-family: system-ui, -apple-system, sans-serif; color: #000;
  }
  .sheet { margin: 0; padding: 0; overflow: hidden; }
  .wrap {
    display: flex; flex-direction: column; gap: 0.6mm;
    width: 100%; height: 100%;
    padding: ${ETIQUETA_MARGEN_MM}mm;
  }
  .logo-wrap {
    display: flex; justify-content: center; align-items: center;
    flex-shrink: 0; width: 100%;
    margin-bottom: 0.2mm;
  }
  .logo-wrap img {
    display: block; max-width: 100%; width: auto;
    max-height: 11mm; height: auto; object-fit: contain;
  }
  .fila-orden {
    display: flex; flex-direction: column; gap: 0.3mm;
    font: 800 13.2pt/1.1 system-ui, sans-serif;
  }
  .orden-id { white-space: nowrap; }
  .fecha-ev { font-weight: 700; font-size: 12pt; }
  .cliente {
    font: 800 14.4pt/1.15 system-ui, sans-serif;
    white-space: normal; word-break: break-word; overflow-wrap: anywhere;
  }
  .meta, .lugar {
    font: 700 11.4pt/1.15 system-ui, sans-serif; color: #111;
    white-space: normal; word-break: break-word; overflow-wrap: anywhere;
  }
  .sep { border-top: 0.25mm solid #000; margin: 0.4mm 0; flex-shrink: 0; }
  .prendas {
    flex: 1; min-height: 0; overflow: hidden;
    display: flex; flex-direction: column; gap: 0.6mm;
  }
  .prenda-item {
    display: flex; align-items: flex-start; gap: 1mm;
    font: 700 11.4pt/1.2 system-ui, sans-serif;
  }
  .prenda-num { flex-shrink: 0; min-width: 4mm; font-weight: 800; }
  .prenda-text {
    flex: 1; min-width: 0;
    white-space: normal; word-break: break-word; overflow-wrap: anywhere;
  }

  /* Vista previa en iframe (tamaño real de la etiqueta) */
  @media screen {
    html, body, .sheet {
      width: ${ETIQUETA_ANCHO_MM}mm;
      height: ${ETIQUETA_ALTO_MM}mm;
      overflow: hidden;
    }
  }

  /*
   * Impresión: ocupar el 100% del papel que Chrome/driver reporta.
   * Evita el contenido chico centrado cuando el driver usa otro tamaño nominal.
   */
  @media print {
    @page {
      margin: 0 !important;
      size: ${ETIQUETA_ANCHO_MM}mm ${ETIQUETA_ALTO_MM}mm portrait;
    }
    html, body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .sheet {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-after: avoid;
      break-after: avoid;
    }
    .wrap {
      width: 100% !important;
      height: 100% !important;
    }
  }
</style>`;

export function formatearLineaPrendaCompacta(prenda: PrendaResumenEntrada): string {
  const base = (prenda.descripcion || "").trim() || "Prenda";
  const cant = prenda.cantidad > 1 ? ` ×${prenda.cantidad}` : "";
  return `${base}${cant}`;
}

export function construirEtiquetaResumenConjunto(input: {
  ordenId: number;
  clienteNombre: string;
  fechaRetiro: string;
  fechaEvento: string;
  categoriaEvento: string;
  lugarEvento: string;
  productos: PrendaResumenEntrada[];
}): ItemEtiquetaResumenConjunto {
  return {
    ordenId: input.ordenId,
    clienteNombre: (input.clienteNombre || "").trim() || "Cliente",
    fechaRetiro: (input.fechaRetiro || "").trim() || "—",
    fechaEvento: (input.fechaEvento || "").trim() || "—",
    categoriaEvento: (input.categoriaEvento || "").trim(),
    lugarEvento: (input.lugarEvento || "").trim(),
    lineasPrendas: input.productos.map(formatearLineaPrendaCompacta),
  };
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generarHtmlEtiquetaResumenConjunto(
  item: ItemEtiquetaResumenConjunto,
  logoSrc?: string | null
): string {
  const metaPartes = [
    item.fechaRetiro !== "—" ? `Retiro ${item.fechaRetiro}` : "",
    item.categoriaEvento || "",
  ].filter(Boolean);
  const metaLinea = metaPartes.join(" · ") || "—";
  const lugarLinea = item.lugarEvento || "—";

  const prendasHtml = item.lineasPrendas
    .map(
      (l, i) =>
        `<div class="prenda-item"><span class="prenda-num">${i + 1}.</span><span class="prenda-text">${esc(l)}</span></div>`
    )
    .join("");

  const logoHtml =
    logoSrc?.trim()
      ? `<div class="logo-wrap"><img src="${logoSrc}" alt="Guapo Trajes" /></div>`
      : "";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=${ETIQUETA_ANCHO_MM}mm, initial-scale=1"/><title>ResumenConjunto${item.ordenId}</title>${ETIQUETA_RESUMEN_STYLES}</head><body>
      <div class="sheet"><div class="wrap">
        ${logoHtml}
        <div class="fila-orden">
          <span class="orden-id">ORDEN #${esc(String(item.ordenId))}</span>
          <span class="fecha-ev">Evento ${esc(item.fechaEvento)}</span>
        </div>
        <div class="cliente">${esc(item.clienteNombre)}</div>
        <div class="meta">${esc(metaLinea)}</div>
        <div class="lugar">${esc(lugarLinea)}</div>
        <div class="sep"></div>
        <div class="prendas">${prendasHtml}</div>
      </div></div>
    </body></html>`;
}

export async function imprimirEtiquetaResumenConjunto(
  item: ItemEtiquetaResumenConjunto
): Promise<ImpresionResumenConjuntoResultado> {
  const logoSrc = await obtenerLogoGuapoDataUrl();
  const html = generarHtmlEtiquetaResumenConjunto(item, logoSrc);
  const impresion = await imprimirEtiquetaConRouting(
    "resumen_conjunto",
    html,
    { anchoMm: ETIQUETA_ANCHO_MM, altoMm: ETIQUETA_ALTO_MM },
    "portrait"
  );

  return {
    resultado: impresion.resultado,
    metodo: impresion.metodo,
    impresora: impresion.impresora,
    mensajeAyuda: impresion.mensajeAyuda,
  };
}
