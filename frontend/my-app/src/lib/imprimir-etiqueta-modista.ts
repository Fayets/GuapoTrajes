import JsBarcode from "jsbarcode";

export type EtiquetaModistaDatos = {
  titulo: string;
  cliente_nombre?: string | null;
  fecha_retiro?: string | null;
};

/**
 * Etiqueta 50×25 mm (misma lógica que la de productos): título + líneas opcionales + código de barras.
 */
export function imprimirEtiqueta50x25(
  codigoBarra: string,
  datos: EtiquetaModistaDatos
): void {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, codigoBarra || "000000000000", {
      format: "CODE128",
      lineColor: "#000",
      background: "#ffffff",
      width: 1.15,
      height: 30,
      margin: 0,
      displayValue: true,
      fontSize: 7,
      textMargin: 1,
    });
  } catch {
    return;
  }

  const contenido = svg.cloneNode(true) as SVGSVGElement;
  contenido.style.display = "block";
  contenido.style.marginInline = "auto";

  const titulo = (datos.titulo || "").trim() || "\u00A0";
  const metaLines: string[] = [];
  if (datos.cliente_nombre?.trim()) {
    metaLines.push(`Cliente: ${datos.cliente_nombre.trim()}`);
  }
  if (datos.fecha_retiro?.trim()) {
    metaLines.push(`Retiro: ${datos.fecha_retiro.trim()}`);
  }

  const metaHtml = metaLines
    .map(
      (t) =>
        `<p class="product-meta">${escapeHtml(t)}</p>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: 50mm 25mm; margin: 0; }
    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html, body {
      margin: 0; padding: 0; width: 50mm; height: 25mm; background: #fff;
      overflow: hidden; direction: ltr;
    }
    .wrap {
      width: 50mm; height: 25mm; margin: 0;
      padding: 0.3mm 1mm 0.2mm;
      text-align: center; overflow: hidden;
    }
    .inner {
      display: inline-flex; flex-direction: column; align-items: center;
      justify-content: flex-start; vertical-align: top; max-width: 48mm;
      gap: 0.2mm; text-align: center;
    }
    .product-name {
      margin: 0; padding: 0; width: 100%; max-width: 48mm; text-align: center;
      font: 600 5.5pt/1.1 system-ui, sans-serif; color: #000;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
      overflow: hidden; word-break: break-word;
    }
    .product-meta {
      margin: 0; padding: 0; width: 100%; max-width: 48mm;
      font: 500 4.2pt/1.1 system-ui, sans-serif; color: #222;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .barcode-slot { display: flex; justify-content: center; align-items: flex-start; width: 100%; }
    .barcode-slot svg {
      display: block; margin-inline: auto; max-width: 47mm; max-height: 14mm;
      width: auto; height: auto;
    }
  </style>
</head>
<body>
  <div class="wrap"><div class="inner">
    <p class="product-name">${escapeHtml(titulo)}</p>
    ${metaHtml}
    <div class="barcode-slot"></div>
  </div></div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "50mm",
    height: "25mm",
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const slot = doc.querySelector(".barcode-slot");
  if (slot) {
    slot.appendChild(contenido);
  }

  setTimeout(() => {
    win.focus();
    win.print();
    iframe.remove();
  }, 250);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
