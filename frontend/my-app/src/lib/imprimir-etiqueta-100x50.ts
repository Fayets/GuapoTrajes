import JsBarcode from "jsbarcode";
import { imprimirEtiquetaConRouting } from "@/lib/imprimir-etiqueta-routing";

export type ItemEtiqueta100x50 = {
  codigoBarra: string;
  clienteNombre: string;
  prendaDescripcion: string;
};

export type ImpresionLote100x50Resultado = {
  porIndice: Array<"ok" | "error">;
  metodo?: "qz" | "navegador";
  impresora?: string;
  mensajeAyuda?: string;
};

export const ETIQUETA_PRENDA_ANCHO_MM = 100;
export const ETIQUETA_PRENDA_ALTO_MM = 50;

const JSBARCODE_OPTS_100x50 = {
  format: "CODE128" as const,
  lineColor: "#000",
  background: "#ffffff",
  width: 1.6,
  height: 58,
  margin: 0,
  displayValue: true,
  fontSize: 10,
  textMargin: 2,
  textAlign: "center" as const,
};

const ETIQUETA_100x50_STYLES = `<style>
  @page { size: 100mm 50mm; margin: 0; }
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; direction: ltr; }
  .sheet { width: 100mm; height: 50mm; margin: 0; padding: 0; page-break-after: always; break-after: page; overflow: hidden; }
  .sheet:last-of-type { page-break-after: auto; break-after: auto; }
  .wrap { width: 100mm; height: 50mm; padding: 3mm; display: flex; flex-direction: column; gap: 1.5mm; }
  .cliente { font: 700 14pt/1.15 system-ui, sans-serif; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prenda { font: 600 11pt/1.2 system-ui, sans-serif; color: #111; min-height: 13mm; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .barcode-slot { margin-top: auto; display: flex; justify-content: center; align-items: flex-end; }
  .barcode-slot svg { display: block; max-width: 94mm; width: auto; height: auto; }
</style>`;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generarSvgBarcode(codigo: string): string | null {
  if (typeof document === "undefined") return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, codigo, JSBARCODE_OPTS_100x50);
    return svg.outerHTML;
  } catch {
    return null;
  }
}

export function generarHtmlEtiquetas100x50(items: ItemEtiqueta100x50[]): {
  html: string;
  porIndice: Array<"ok" | "error">;
} {
  const porIndice: Array<"ok" | "error"> = items.map(() => "error");
  const sheets: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const code = (item.codigoBarra || "").trim() || "0";
    const svg = generarSvgBarcode(code);
    if (!svg) continue;

    porIndice[i] = "ok";
    sheets.push(`<div class="sheet"><div class="wrap">
      <div class="cliente">${esc((item.clienteNombre || "").trim() || "Cliente")}</div>
      <div class="prenda">${esc((item.prendaDescripcion || "").trim() || "Prenda para armar")}</div>
      <div class="barcode-slot">${svg}</div>
    </div></div>`);
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Etiquetas100x50</title>${ETIQUETA_100x50_STYLES}</head><body>${sheets.join("")}</body></html>`;
  return { html, porIndice };
}

export async function imprimirEtiquetas100x50Lote(
  items: ItemEtiqueta100x50[]
): Promise<ImpresionLote100x50Resultado> {
  const porIndice: Array<"ok" | "error"> = items.map(() => "error");
  if (items.length === 0) {
    return { porIndice: [] };
  }

  const { html, porIndice: generados } = generarHtmlEtiquetas100x50(items);
  const imprimibles = generados.some((s) => s === "ok");
  if (!imprimibles) {
    return { porIndice: generados };
  }

  const impresion = await imprimirEtiquetaConRouting(
    "prenda_individual",
    html,
    { anchoMm: ETIQUETA_PRENDA_ANCHO_MM, altoMm: ETIQUETA_PRENDA_ALTO_MM },
    "landscape"
  );

  if (impresion.resultado === "error") {
    return {
      porIndice: generados.map((estado) => (estado === "ok" ? "error" : estado)),
      metodo: impresion.metodo,
      impresora: impresion.impresora,
      mensajeAyuda: impresion.mensajeAyuda,
    };
  }

  return {
    porIndice: generados,
    metodo: impresion.metodo,
    impresora: impresion.impresora,
    mensajeAyuda: impresion.mensajeAyuda,
  };
}
