/**
 * Etiqueta 50×25 mm (Productos, Lavandería, Modista, Etiquetas inventario).
 * Solo descripción + código de barras. Sin encabezados del navegador.
 */
import JsBarcode from "jsbarcode"
import { imprimirHtmlEnQz } from "@/lib/impresion-qz-tray"
import {
  leerConfigImpresionEtiquetas,
  patronImpresoraPorTipo,
} from "@/lib/impresion-etiquetas-config"

/** Opciones JsBarcode compartidas (impresión y preview del modal de productos). */
export const JSBARCODE_OPTS_50X25 = {
  format: "CODE128" as const,
  lineColor: "#000",
  background: "#ffffff",
  width: 1.15,
  height: 18,
  margin: 0,
  displayValue: true,
  fontSize: 7,
  textMargin: 0,
  textAlign: "center" as const,
}

const ETIQUETA_ANCHO_MM = 50
const ETIQUETA_ALTO_MM = 25

/** Estilos del contenido — solo nombre + barcode, sin márgenes extra. */
const ETIQUETA_50X25_CONTENT_CSS = `
  .label {
    width: ${ETIQUETA_ANCHO_MM}mm;
    height: ${ETIQUETA_ALTO_MM}mm;
    margin: 0;
    padding: 0.8mm 1.2mm 0.6mm;
    box-sizing: border-box;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    align-content: stretch;
    overflow: hidden;
    background: #fff;
  }
  .product-name {
    margin: 0;
    padding: 0;
    align-self: start;
    width: 100%;
    text-align: center;
    font: 700 7pt/1.08 system-ui, sans-serif;
    color: #000;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    word-break: break-word;
  }
  .barcode-slot {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 11mm;
    min-height: 11mm;
    max-height: 11mm;
    overflow: hidden;
  }
  .barcode-slot svg {
    display: block;
    margin: 0 auto;
    max-width: 46mm;
    max-height: 10mm;
    width: auto;
    height: auto;
  }
`

const ETIQUETA_50X25_PRINT_BASE = `
  @page {
    size: ${ETIQUETA_ANCHO_MM}mm ${ETIQUETA_ALTO_MM}mm;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    direction: ltr;
  }
  ${ETIQUETA_50X25_CONTENT_CSS}
  .sheet {
    width: ${ETIQUETA_ANCHO_MM}mm;
    height: ${ETIQUETA_ALTO_MM}mm;
    margin: 0;
    padding: 0;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .sheet:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
`

/** CSS para el preview del modal (contenedor escalado en pantalla). */
export const ETIQUETA_50X25_PREVIEW_CSS = `
  .etiqueta-50x25-preview {
    width: 280px;
    height: 140px;
    margin-inline: auto;
    overflow: hidden;
    background: #fff;
  }
  .etiqueta-50x25-preview .label {
    width: 100%;
    height: 100%;
    padding: 3px 5px 2px;
  }
  .etiqueta-50x25-preview .product-name {
    font-size: 10px;
    line-height: 1.08;
    -webkit-line-clamp: 2;
  }
  .etiqueta-50x25-preview .barcode-slot {
    height: 58px;
    min-height: 58px;
    max-height: 58px;
  }
  .etiqueta-50x25-preview .barcode-slot svg {
    max-width: 100%;
    max-height: 52px;
  }
  ${ETIQUETA_50X25_CONTENT_CSS}
`

/** Normaliza texto para la etiqueta: máx. ~2 líneas legibles. */
export function descripcionParaEtiqueta50x25(descripcion: string): string {
  const texto = (descripcion || "").replace(/\s+/g, " ").trim()
  if (!texto) return "\u00A0"
  const max = 72
  if (texto.length <= max) return texto
  const corte = texto.lastIndexOf(" ", max - 1)
  const idx = corte > 24 ? corte : max
  return `${texto.slice(0, idx).trim()}…`
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function generarSvgBarcode(codigoBarra: string): string {
  if (typeof document === "undefined") return ""
  const code = (codigoBarra || "").trim() || "0"
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  JsBarcode(svg, code, JSBARCODE_OPTS_50X25)
  return new XMLSerializer().serializeToString(svg)
}

function htmlEtiquetaUnica(codigoBarra: string, descripcion: string): string {
  const svg = generarSvgBarcode(codigoBarra)
  const nombre = escaparHtml(descripcionParaEtiqueta50x25(descripcion))
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title></title>
<style>${ETIQUETA_50X25_PRINT_BASE}
html, body { width: ${ETIQUETA_ANCHO_MM}mm; height: ${ETIQUETA_ALTO_MM}mm; overflow: hidden; }
</style></head><body>
<div class="label">
  <p class="product-name">${nombre}</p>
  <div class="barcode-slot">${svg}</div>
</div>
</body></html>`
}

export type ItemEtiqueta50x25 = { codigoBarra: string; descripcion: string }

function htmlEtiquetasLote(items: ItemEtiqueta50x25[]): {
  html: string
  porIndice: Array<"ok" | "error">
} {
  const porIndice: Array<"ok" | "error"> = items.map(() => "error")
  const hojas: string[] = []

  for (let i = 0; i < items.length; i++) {
    const { codigoBarra, descripcion } = items[i]
    try {
      const svg = generarSvgBarcode(codigoBarra)
      const nombre = escaparHtml(descripcionParaEtiqueta50x25(descripcion))
      hojas.push(`<div class="sheet"><div class="label">
  <p class="product-name">${nombre}</p>
  <div class="barcode-slot">${svg}</div>
</div></div>`)
      porIndice[i] = "ok"
    } catch {
      porIndice[i] = "error"
    }
  }

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title></title>
<style>${ETIQUETA_50X25_PRINT_BASE}</style></head><body>${hojas.join("")}</body></html>`

  return { html, porIndice }
}

function crearIframeImpresion(): {
  iframe: HTMLIFrameElement
  doc: Document
  win: Window
} | null {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${ETIQUETA_ANCHO_MM}mm`,
    height: `${ETIQUETA_ALTO_MM}mm`,
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  } as Partial<CSSStyleDeclaration>)
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    return null
  }
  return { iframe, doc, win }
}

/** Evita que Chrome imprima título/URL de la app en la etiqueta. */
function imprimirHtmlEnNavegadorEtiqueta(html: string): Promise<void> {
  return new Promise((resolve) => {
    const ctx = crearIframeImpresion()
    if (!ctx) {
      resolve()
      return
    }
    const { iframe, doc, win } = ctx
    const tituloPadre = document.title

    doc.open()
    doc.write(html)
    doc.close()
    doc.title = ""

    setTimeout(() => {
      document.title = ""
      win.focus()
      win.print()
      setTimeout(() => {
        document.title = tituloPadre
        iframe.remove()
        resolve()
      }, 400)
    }, 280)
  })
}

async function imprimirHtmlEtiqueta50x25(html: string): Promise<{
  metodo: "qz" | "navegador"
}> {
  const config = leerConfigImpresionEtiquetas()
  if (config.usarQzTray) {
    const patron = patronImpresoraPorTipo("prenda_individual", config)
    const qz = await imprimirHtmlEnQz(
      html,
      patron,
      { anchoMm: ETIQUETA_ANCHO_MM, altoMm: ETIQUETA_ALTO_MM },
      "portrait"
    )
    if (qz.ok) return { metodo: "qz" }
  }
  await imprimirHtmlEnNavegadorEtiqueta(html)
  return { metodo: "navegador" }
}

/** Clona el SVG ya generado en el modal de producto (misma apariencia al imprimir). */
export function imprimirEtiqueta50x25DesdeSvg(
  svg: SVGSVGElement,
  descripcion: string
): Promise<void> {
  const svgHtml = new XMLSerializer().serializeToString(svg)
  const nombre = escaparHtml(descripcionParaEtiqueta50x25(descripcion))
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title></title>
<style>${ETIQUETA_50X25_PRINT_BASE}
html, body { width: ${ETIQUETA_ANCHO_MM}mm; height: ${ETIQUETA_ALTO_MM}mm; overflow: hidden; }
</style></head><body>
<div class="label">
  <p class="product-name">${nombre}</p>
  <div class="barcode-slot">${svgHtml}</div>
</div>
</body></html>`
  return imprimirHtmlEtiqueta50x25(html).then(() => undefined)
}

/** Genera el código de barras e imprime (mismas opciones que el modal de productos). */
export function imprimirEtiqueta50x25DesdeCodigo(
  codigoBarra: string,
  descripcion: string
): Promise<void> {
  try {
    const html = htmlEtiquetaUnica(codigoBarra, descripcion)
    return imprimirHtmlEtiqueta50x25(html).then(() => undefined)
  } catch (e) {
    return Promise.reject(e)
  }
}

/** Resultado alineado por índice con el array `items` pasado al lote. */
export type ImpresionLote50x25Resultado = {
  porIndice: Array<"ok" | "error">
  metodo?: "qz" | "navegador"
}

/**
 * Varias etiquetas 50×25 mm: un solo envío (QZ Tray directo o diálogo del navegador).
 */
export function imprimirEtiquetas50x25Lote(
  items: ItemEtiqueta50x25[]
): Promise<ImpresionLote50x25Resultado> {
  if (items.length === 0) {
    return Promise.resolve({ porIndice: [] })
  }

  const { html, porIndice } = htmlEtiquetasLote(items)
  if (!porIndice.some((s) => s === "ok")) {
    return Promise.resolve({ porIndice })
  }

  return imprimirHtmlEtiqueta50x25(html).then(({ metodo }) => ({
    porIndice,
    metodo,
  }))
}
