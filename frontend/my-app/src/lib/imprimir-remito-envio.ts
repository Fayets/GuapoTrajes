/**
 * Remito administrativo al enviar prendas a lavandería o modista (impresión / guardar como PDF).
 */

export type RemitoImpresionRow = {
  tipo: "MODISTA" | "LAVANDERIA";
  destino_nombre: string;
  destino_telefono?: string | null;
  destino_direccion?: string | null;
  fecha_envio: string;
  producto_id: number;
  codigo_barra?: string | null;
  titulo?: string | null;
  cliente_nombre?: string | null;
  cliente_celular?: string | null;
  fecha_retiro?: string | null;
  fecha_evento?: string | null;
  presupuesto_numero?: string | null;
};

function esc(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function tituloTipo(t: RemitoImpresionRow["tipo"]): string {
  return t === "MODISTA" ? "Envío a modista / taller" : "Envío a lavandería";
}

/**
 * Abre el diálogo de impresión con un documento A4 tabulado (guardar como PDF desde el navegador).
 */
export function imprimirRemitoEnvioLote(rows: RemitoImpresionRow[]): void {
  if (typeof window === "undefined" || !rows.length) return;

  const first = rows[0];
  const tipoLabel = tituloTipo(first.tipo);
  const ahora = new Date().toLocaleString("es-AR");

  const filasHtml = rows
    .map(
      (r) => `<tr>
      <td class="mono">${esc(r.codigo_barra)}</td>
      <td>${esc(r.titulo || "—")}</td>
      <td>${esc(r.cliente_nombre || "—")}</td>
      <td>${esc(r.cliente_celular || "—")}</td>
      <td class="nowrap">${esc(r.presupuesto_numero || "—")}</td>
      <td class="nowrap">${fmtFecha(r.fecha_retiro)}</td>
      <td class="nowrap">${fmtFecha(r.fecha_evento)}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(tipoLabel)} — Guapo Trajes</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { font-family: system-ui, "Segoe UI", Roboto, sans-serif; font-size: 11pt; color: #111; margin: 0; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    .meta { font-size: 10pt; color: #444; margin-bottom: 1rem; }
    .box { border: 1px solid #ccc; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem; background: #fafafa; }
    .box strong { display: inline-block; min-width: 7rem; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th, td { border: 1px solid #bbb; padding: 0.35rem 0.45rem; text-align: left; vertical-align: top; }
    th { background: #e9ecef; font-weight: 600; }
    .mono { font-family: ui-monospace, monospace; font-size: 9pt; }
    .nowrap { white-space: nowrap; }
    .foot { margin-top: 1rem; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <h1>${esc(tipoLabel)}</h1>
  <p class="meta">Generado: ${esc(ahora)} · ${rows.length} prenda${rows.length === 1 ? "" : "s"}</p>
  <div class="box">
    <div><strong>Destino</strong> ${esc(first.destino_nombre)}</div>
    ${first.destino_telefono ? `<div><strong>Teléfono</strong> ${esc(first.destino_telefono)}</div>` : ""}
    ${first.destino_direccion ? `<div><strong>Dirección</strong> ${esc(first.destino_direccion)}</div>` : ""}
    <div><strong>Fecha de envío</strong> ${fmtFecha(first.fecha_envio)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Prenda (título)</th>
        <th>Cliente</th>
        <th>Celular</th>
        <th>Presup.</th>
        <th>Retiro previsto</th>
        <th>Evento</th>
      </tr>
    </thead>
    <tbody>${filasHtml}</tbody>
  </table>
  <p class="foot">Guapo Trajes — documento para archivo / taller. Fechas de retiro y evento surgen del presupuesto vinculado a la prenda, si existe.</p>
</body>
</html>`;

  /* iframe: evita bloqueo de popups tras operaciones async (cola por lote). */
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "210mm",
    height: "297mm",
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
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    iframe.remove();
  }, 350);
}
