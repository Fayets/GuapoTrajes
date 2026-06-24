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
  width: 1.1,
  height: 16,
  margin: 0,
  displayValue: true,
  fontSize: 7,
  textMargin: 0,
  textAlign: "center" as const,
}

/** Estilos del contenido (nombre + barcode) — compartidos entre impresión y preview. */
const ETIQUETA_50X25_CONTENT_CSS = `
  .wrap {
    width: 50mm;
    height: 25mm;
    margin: 0;
    padding: 0.5mm 1mm 0.4mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    max-width: 48mm;
    gap: 0.3mm;
    text-align: center;
  }
  .product-name {
    margin: 0;
    padding: 0;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    max-height: 12.5mm;
    text-align: center;
    font: 600 8pt/1.12 system-ui, sans-serif;
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
    align-items: flex-end;
    width: 100%;
    flex: 0 0 9.5mm;
    min-height: 9.5mm;
    max-height: 9.5mm;
    overflow: hidden;
  }
  .barcode-slot svg {
    display: block;
    margin-inline: auto;
    max-width: 47mm;
    max-height: 9mm;
    width: auto;
    height: auto;
  }
`

/** CSS para el preview del modal (mismas reglas, contenedor escalado en pantalla). */
export const ETIQUETA_50X25_PREVIEW_CSS = `
  .etiqueta-50x25-preview {
    width: 280px;
    height: 140px;
    margin-inline: auto;
    overflow: hidden;
    background: #fff;
  }
  .etiqueta-50x25-preview .wrap {
    width: 100%;
    height: 100%;
    padding: 2px 4px 1px;
    display: flex;
    flex-direction: column;
  }
  .etiqueta-50x25-preview .inner {
    max-width: 100%;
    gap: 2px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .etiqueta-50x25-preview .product-name {
    max-width: 100%;
    max-height: 70px;
    font-size: 11px;
    line-height: 1.12;
    -webkit-line-clamp: 3;
  }
  .etiqueta-50x25-preview .barcode-slot {
    flex: 0 0 52px;
    min-height: 52px;
    max-height: 52px;
  }
  .etiqueta-50x25-preview .barcode-slot svg {
    max-width: 100%;
    max-height: 48px;
  }
  ${ETIQUETA_50X25_CONTENT_CSS}
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
      JsBarcode(svg, code, JSBARCODE_OPTS_50X25)
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
        JsBarcode(svg, code, JSBARCODE_OPTS_50X25)
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
