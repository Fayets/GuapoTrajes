import JsBarcode from "jsbarcode";
import { imprimirEtiquetaConRouting } from "@/lib/imprimir-etiqueta-routing";

export type ItemEtiquetaModista = {
  tipo: "stock" | "orden";
  codigoBarra: string;
  prendaDescripcion: string;
  notasTrabajo: string;
  /** Solo tipo orden */
  clienteNombre?: string;
  clienteDni?: string;
  clienteCelular?: string;
  fechaRetiro?: string;
};

export type ImpresionEtiquetaModistaResultado = {
  porIndice: Array<"ok" | "error">;
  metodo?: "qz" | "navegador";
  impresora?: string;
  mensajeAyuda?: string;
};

export const ETIQUETA_MODISTA_ANCHO_MM = 100;
export const ETIQUETA_MODISTA_ALTO_MM = 50;

const JSBARCODE_OPTS = {
  format: "CODE128" as const,
  lineColor: "#000",
  background: "#ffffff",
  width: 1.4,
  height: 36,
  margin: 0,
  displayValue: true,
  fontSize: 9,
  textMargin: 1,
  textAlign: "center" as const,
};

const STYLES = `<style>
  @page { size: 100mm 50mm; margin: 0; }
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; direction: ltr; }
  .sheet { width: 100mm; height: 50mm; margin: 0; padding: 0; page-break-after: always; break-after: page; overflow: hidden; }
  .sheet:last-of-type { page-break-after: auto; break-after: auto; }
  .wrap { width: 100mm; height: 50mm; padding: 2.5mm 3mm; display: flex; flex-direction: column; gap: 0.8mm; }
  .titulo { font: 700 10pt/1 system-ui, sans-serif; letter-spacing: 0.06em; color: #000; }
  .subtitulo { font: 600 8pt/1.1 system-ui, sans-serif; color: #222; }
  .cliente { font: 700 11pt/1.1 system-ui, sans-serif; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dato { font: 600 8pt/1.15 system-ui, sans-serif; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prenda { font: 600 9pt/1.15 system-ui, sans-serif; color: #111; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .notas { font: 700 8pt/1.15 system-ui, sans-serif; color: #000; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
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
    JsBarcode(svg, codigo, JSBARCODE_OPTS);
    return svg.outerHTML;
  } catch {
    return null;
  }
}

function htmlEtiquetaStock(item: ItemEtiquetaModista, svg: string): string {
  const notas = (item.notasTrabajo || "").trim();
  const prenda = (item.prendaDescripcion || "").trim() || "Prenda";
  return `<div class="sheet"><div class="wrap">
    <div class="titulo">STOCK — MODISTA</div>
    <div class="prenda">${esc(prenda)}</div>
    <div class="notas">Trabajo: ${esc(notas || "—")}</div>
    <div class="barcode-slot">${svg}</div>
  </div></div>`;
}

function htmlEtiquetaOrden(item: ItemEtiquetaModista, svg: string): string {
  const notas = (item.notasTrabajo || "").trim();
  const prenda = (item.prendaDescripcion || "").trim() || "Prenda";
  const cliente = (item.clienteNombre || "").trim() || "Cliente";
  const dni = (item.clienteDni || "").trim();
  const cel = (item.clienteCelular || "").trim();
  const retiro = (item.fechaRetiro || "").trim() || "—";
  return `<div class="sheet"><div class="wrap">
    <div class="titulo">MODISTA — ORDEN</div>
    <div class="cliente">${esc(cliente)}</div>
    ${dni ? `<div class="dato">DNI: ${esc(dni)}</div>` : ""}
    ${cel ? `<div class="dato">Cel: ${esc(cel)}</div>` : ""}
    <div class="dato">Retiro: ${esc(retiro)}</div>
    <div class="prenda">${esc(prenda)}</div>
    <div class="notas">Trabajo: ${esc(notas || "—")}</div>
    <div class="barcode-slot">${svg}</div>
  </div></div>`;
}

export function generarHtmlEtiquetasModista(items: ItemEtiquetaModista[]): {
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
    sheets.push(
      item.tipo === "stock"
        ? htmlEtiquetaStock(item, svg)
        : htmlEtiquetaOrden(item, svg)
    );
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>EtiquetaModista</title>${STYLES}</head><body>${sheets.join("")}</body></html>`;
  return { html, porIndice };
}

export async function imprimirEtiquetasModistaLote(
  items: ItemEtiquetaModista[]
): Promise<ImpresionEtiquetaModistaResultado> {
  if (items.length === 0) {
    return { porIndice: [] };
  }

  const { html, porIndice: generados } = generarHtmlEtiquetasModista(items);
  if (!generados.some((s) => s === "ok")) {
    return { porIndice: generados };
  }

  const impresion = await imprimirEtiquetaConRouting(
    "prenda_individual",
    html,
    { anchoMm: ETIQUETA_MODISTA_ANCHO_MM, altoMm: ETIQUETA_MODISTA_ALTO_MM },
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
