/**
 * Etiqueta 50×25 mm (misma lógica que Productos → acción Etiqueta / Imprimir).
 * Impresión vía iframe oculto + window.print().
 */
import JsBarcode from "jsbarcode"

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
  textMargin: 1,
  textAlign: "center" as const,
}

const ETIQUETA_50X25_CONTENT_CSS = `
    .wrap {
      width: 50mm;
      height: 25mm;
      margin: 0;
      padding: 0.4mm 1mm 0.3mm;
      text-align: center;
      overflow: hidden;
    }
    .inner {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      vertical-align: top;
      max-width: 48mm;
      gap: 0.35mm;
      text-align: center;
    }
    .product-name {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 48mm;
      text-align: center;
      font: 600 8.5pt/1.15 system-ui, sans-serif;
      color: #000;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
      word-break: break-word;
      hyphens: auto;
    }
    .barcode-slot {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      margin-top: 0.2mm;
    }
    .barcode-slot svg {
      display: block;
      margin-inline: auto;
      max-width: 47mm;
      max-height: 5mm;
      width: auto;
      height: auto;
    }
`

const ETIQUETA_HTML_SHELL = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: 50mm 25mm;
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
      width: 50mm;
      height: 25mm;
      background: #fff;
      overflow: hidden;
      direction: ltr;
    }
    body {
      display: block;
    }
    ${ETIQUETA_50X25_CONTENT_CSS}
  </style>
</head>
<body>
  <div class="wrap"><div class="inner"></div></div>
</body>
</html>`

const JSBARCODE_OPTS = JSBARCODE_OPTS_50X25

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
    width: "50mm",
    height: "25mm",
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

/** Clona el SVG ya generado en el modal de producto (misma apariencia al imprimir). */
export function imprimirEtiqueta50x25DesdeSvg(
  svg: SVGSVGElement,
  descripcion: string
): Promise<void> {
  return new Promise((resolve) => {
    const contenido = svg.cloneNode(true) as SVGSVGElement
    contenido.style.display = "block"
    contenido.style.marginInline = "auto"

    const ctx = crearIframeImpresion()
    if (!ctx) {
      resolve()
      return
    }
    const { iframe, doc, win } = ctx

    doc.open()
    doc.write(ETIQUETA_HTML_SHELL)
    doc.close()

    const inner = doc.querySelector(".inner")
    if (inner) {
      const titulo = doc.createElement("p")
      titulo.className = "product-name"
      titulo.textContent = descripcion.trim() || "\u00A0"
      const slot = doc.createElement("div")
      slot.className = "barcode-slot"
      slot.appendChild(contenido)
      inner.appendChild(titulo)
      inner.appendChild(slot)
    }

    setTimeout(() => {
      win.focus()
      win.print()
      iframe.remove()
      resolve()
    }, 250)
  })
}

/** Genera el código de barras en el iframe (mismas opciones que el modal de productos). */
export function imprimirEtiqueta50x25DesdeCodigo(
  codigoBarra: string,
  descripcion: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const code = (codigoBarra || "").trim() || "0"
    const ctx = crearIframeImpresion()
    if (!ctx) {
      resolve()
      return
    }
    const { iframe, doc, win } = ctx

    doc.open()
    doc.write(ETIQUETA_HTML_SHELL)
    doc.close()

    const inner = doc.querySelector(".inner")
    if (!inner) {
      iframe.remove()
      resolve()
      return
    }

    const titulo = doc.createElement("p")
    titulo.className = "product-name"
    titulo.textContent = (descripcion || "").trim() || "\u00A0"

    const slot = doc.createElement("div")
    slot.className = "barcode-slot"
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg")
    slot.appendChild(svg)
    inner.appendChild(titulo)
    inner.appendChild(slot)

    try {
      JsBarcode(svg, code, JSBARCODE_OPTS)
    } catch (e) {
      iframe.remove()
      reject(e)
      return
    }

    setTimeout(() => {
      win.focus()
      win.print()
      iframe.remove()
      resolve()
    }, 280)
  })
}

export type ItemEtiqueta50x25 = { codigoBarra: string; descripcion: string }

/** Resultado alineado por índice con el array `items` pasado al lote. */
export type ImpresionLote50x25Resultado = { porIndice: Array<"ok" | "error"> }

const ETIQUETA_LOTE_STYLES = `<style>
  @page {
    size: 50mm 25mm;
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
  .sheet {
    width: 50mm;
    height: 25mm;
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
  ${ETIQUETA_50X25_CONTENT_CSS}
</style>`

/**
 * Varias etiquetas 50×25 mm en un solo documento: un solo cuadro de impresión del navegador.
 * Las que fallen al generar el código de barras no se incluyen y quedan como "error" en el resultado.
 */
export function imprimirEtiquetas50x25Lote(
  items: ItemEtiqueta50x25[]
): Promise<ImpresionLote50x25Resultado> {
  return new Promise((resolve) => {
    const porIndice: Array<"ok" | "error"> = items.map(() => "error")
    if (items.length === 0) {
      resolve({ porIndice: [] })
      return
    }

    const ctx = crearIframeImpresion()
    if (!ctx) {
      resolve({ porIndice })
      return
    }
    const { iframe, doc, win } = ctx

    doc.open()
    doc.write(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Etiquetas</title>${ETIQUETA_LOTE_STYLES}</head><body></body></html>`
    )
    doc.close()

    const body = doc.body
    if (!body) {
      iframe.remove()
      resolve({ porIndice })
      return
    }

    for (let i = 0; i < items.length; i++) {
      const { codigoBarra, descripcion } = items[i]
      const code = (codigoBarra || "").trim() || "0"

      const sheet = doc.createElement("div")
      sheet.className = "sheet"
      const wrap = doc.createElement("div")
      wrap.className = "wrap"
      const inner = doc.createElement("div")
      inner.className = "inner"
      const titulo = doc.createElement("p")
      titulo.className = "product-name"
      titulo.textContent = (descripcion || "").trim() || "\u00A0"
      const slot = doc.createElement("div")
      slot.className = "barcode-slot"
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg")
      slot.appendChild(svg)
      inner.appendChild(titulo)
      inner.appendChild(slot)
      wrap.appendChild(inner)
      sheet.appendChild(wrap)
      body.appendChild(sheet)

      try {
        JsBarcode(svg, code, JSBARCODE_OPTS)
        porIndice[i] = "ok"
      } catch {
        body.removeChild(sheet)
        porIndice[i] = "error"
      }
    }

    const imprimibles = porIndice.some((s) => s === "ok")
    if (!imprimibles) {
      iframe.remove()
      resolve({ porIndice })
      return
    }

    setTimeout(() => {
      win.focus()
      win.print()
      iframe.remove()
      resolve({ porIndice })
    }, 320)
  })
}
