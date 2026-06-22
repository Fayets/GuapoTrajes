export type TamanoEtiquetaMm = {
  anchoMm: number;
  altoMm: number;
};

export function imprimirHtmlEnNavegador(
  html: string,
  tamano: TamanoEtiquetaMm
): Promise<"ok" | "error"> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${tamano.anchoMm}mm`,
      height: `${tamano.altoMm}mm`,
      border: "none",
      opacity: "0",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      resolve("error");
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
      resolve("ok");
    }, 400);
  });
}
