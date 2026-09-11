/**
 * Contrato + pagaré en una sola hoja A4.
 * Texto alineado a «PAGARE ALTERNATIVO Contrato_Guapo_Trajes_final sistema.docx».
 * Márgenes y cuerpo compactos para que el pagaré quede entero y legible al pie.
 */

import {
  ahoraArgentinaPartes,
  parseDateTimeArgentina,
} from "@/lib/fecha-calendario";
import { resolverLocatarioContrato } from "@/lib/contrato-locatario";

export type OrdenParaContratoImpreso = {
  id: number;
  cliente_nombre?: string | null;
  cliente_dni?: string | null;
  cliente_direccion?: string | null;
  cliente_celular?: string | null;
  firmante_nombre?: string | null;
  firmante_dni?: string | null;
  firmante_direccion?: string | null;
  firmante_celular?: string | null;
  tiene_firmante_anexo?: boolean;
  total_presupuesto?: number | null;
  total?: number | null;
  seña_pagada?: number | null;
  saldo_pendiente?: number | null;
  contrato_generado_at?: string | null;
  productos_reservados?: Array<{
    producto_descripcion?: string | null;
    producto_nombre?: string | null;
  }> | null;
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrecioAr(valor: number): string {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function precioTotalOrden(orden: OrdenParaContratoImpreso): number {
  const presupuesto = Number(orden.total_presupuesto ?? 0);
  if (presupuesto > 0) return presupuesto;
  const total = Number(orden.total ?? 0);
  if (total > 0) return total;
  return Number(orden.seña_pagada ?? 0) + Number(orden.saldo_pendiente ?? 0);
}

function partesFechaFirma(orden: OrdenParaContratoImpreso): {
  dia: number;
  mes: string;
  año: number;
} {
  if (orden.contrato_generado_at) {
    const fuente = parseDateTimeArgentina(orden.contrato_generado_at);
    if (fuente) {
      const p = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).formatToParts(fuente);
      return {
        dia: Number(p.find((x) => x.type === "day")?.value ?? "1"),
        mes: p.find((x) => x.type === "month")?.value ?? "",
        año: Number(p.find((x) => x.type === "year")?.value ?? "2000"),
      };
    }
  }
  return ahoraArgentinaPartes();
}

function nombresPrendasOracion(orden: OrdenParaContratoImpreso): string {
  const nombres = (orden.productos_reservados || [])
    .map((p) =>
      (p.producto_descripcion || p.producto_nombre || "").trim()
    )
    .filter(Boolean)
    .map((nombre) => `• ${nombre}`);
  return nombres.join(", ");
}

function linea(valor: string, minEm: number): string {
  const v = (valor || "").trim();
  return `<span class="u" style="min-width:${minEm}em">${v ? esc(v) : "&nbsp;"}</span>`;
}

export function generarHtmlContratoAlquiler(
  orden: OrdenParaContratoImpreso
): string {
  const locatario = resolverLocatarioContrato(orden);
  const fecha = partesFechaFirma(orden);
  const precioAlquiler = precioTotalOrden(orden);
  const precio = formatPrecioAr(precioAlquiler);
  const valorPagare = formatPrecioAr(precioAlquiler * 5);
  const anio = String(fecha.año);
  const ordenNro = String(orden.id).padStart(6, "0");
  const prendas = nombresPrendasOracion(orden);
  const menciónPrendas = prendas ? `: ${esc(prendas)}.` : ".";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Contrato de Alquiler — Orden ${esc(ordenNro)}</title>
  <style>
    @page { size: A4; margin: 10mm 18mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      line-height: 1.28;
      padding: 0;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .cabecera {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin: 0 0 1px;
    }
    .cabecera h1 {
      flex: 1;
      font-size: 14pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.4px;
      margin: 0;
      line-height: 1.15;
    }
    .cabecera .orden {
      flex-shrink: 0;
      font-size: 13pt;
      font-weight: 700;
      white-space: nowrap;
      line-height: 1.15;
    }
    .sub {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      margin: 0 0 8px;
    }
    .cl { margin: 0 0 6px; text-align: justify; }
    .cl h2 {
      font-size: 10pt;
      font-weight: 700;
      margin: 0 0 1.5px;
      line-height: 1.15;
    }
    .cl p {
      margin: 0;
      overflow-wrap: anywhere;
      word-wrap: break-word;
    }
    .firma-loc {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin: 10px 0 8px;
      font-size: 11pt;
    }
    .firma-loc td {
      padding: 8px 0 0;
      vertical-align: bottom;
    }
    .firma-loc .spacer { width: 50%; }
    .firma-loc .etiq {
      width: 1%;
      white-space: nowrap;
      padding-right: 8px;
    }
    .firma-loc .campo {
      border-bottom: 1px solid #000;
      height: 1.25em;
    }
    .u {
      display: inline-block;
      border-bottom: 1px solid #000;
      padding: 0 2px 1px;
      line-height: 1.15;
      vertical-align: baseline;
      max-width: 100%;
    }
    .pagare {
      margin-top: 10px;
      width: 100%;
      max-width: 100%;
      border: 1.5pt solid #000;
      padding: 10px 10px 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pagare h1 {
      font-size: 16pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 5px;
      margin: 0 0 8px;
    }
    .pagare .vence {
      text-align: right;
      font-size: 12pt;
      margin: 0 0 6px;
      line-height: 1.35;
    }
    .pagare p {
      font-size: 12pt;
      line-height: 1.42;
      margin: 0 0 5px;
      text-align: left;
      overflow-wrap: anywhere;
      word-wrap: break-word;
    }
    .pagare p.monto-vista {
      white-space: nowrap;
      overflow-wrap: normal;
      word-wrap: normal;
    }
    .pagare p.monto-vista .u {
      min-width: 6.5em !important;
    }
    .pagare .firma-unica {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
    }
    .pagare .firma-unica .bloque {
      width: 58%;
      text-align: center;
    }
    .pagare .firma-unica .raya {
      border-bottom: 1px solid #000;
      min-height: 1.35em;
      margin-bottom: 3px;
    }
    .pagare .firma-unica .leyenda {
      font-size: 9.5pt;
      line-height: 1.2;
    }
    .no-print { text-align: center; margin-top: 12px; }
    .no-print button {
      padding: 8px 16px;
      margin: 0 6px;
      font-size: 13px;
      cursor: pointer;
    }
    @media print {
      .no-print { display: none; }
      html, body {
        width: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="cabecera">
      <h1>CONTRATO DE ALQUILER DE PRENDAS</h1>
      <div class="orden">Orden N° ${esc(ordenNro)}</div>
    </div>
    <div class="sub">GUAPO TRAJES — La Rioja</div>

    <div class="cl">
      <h2>1. PARTES</h2>
      <p>El LOCADOR Schmira Ariel Fernando, local Guapo Trajes, alquila prendas al LOCATARIO, ${linea(locatario.nombre, 12)}, con domicilio en ${linea(locatario.direccion, 14)}, quien las recibe habiéndolas probado y verificado, en perfecto estado${menciónPrendas}</p>
    </div>

    <div class="cl">
      <h2>2. VIGENCIA</h2>
      <p>El alquiler dura la cantidad de 3 días acordada desde la firma. Si no se devuelven a tiempo, el contrato se prorroga automáticamente hasta que se restituyan todas las prendas. La devolución se hace en el local, Santiago del Estero 83, La Rioja.</p>
    </div>

    <div class="cl">
      <h2>3. PRECIO</h2>
      <p>El precio total se fija de común acuerdo en $ ${linea(precio, 10)}, y debe abonarse 100% antes del retiro de las prendas locadas. Si hay prórroga (demora en devolver), se cobra un monto extra del 10% del contrato, por día, hasta la devolución completa. Como garantía se firma un pagaré, al pie, que es parte integrante de este contrato.</p>
    </div>

    <div class="cl">
      <h2>4. ESTADO DE LAS PRENDAS</h2>
      <p>El LOCATARIO recibe las prendas probadas, a su entera y total satisfacción, debiendo devolverlas en el mismo estado en que las recibió. Ante cualquier duda sobre el estado de devolución, prevalece el criterio del LOCADOR sobre el estado de las mismas, y las costas de su reparación o reemplazo serán absorbidas por el LOCATARIO. El LOCADOR no se responsabiliza por el uso o destino que se les dé.</p>
    </div>

    <div class="cl">
      <h2>5. OBLIGACIONES DEL LOCATARIO</h2>
      <p>No modificar ni arreglar las prendas de ninguna forma. No lavarlas. Si no se cumple alguna obligación, el contrato entra en mora automáticamente y el LOCADOR puede rescindirlo sin aviso previo.</p>
    </div>

    <div class="cl">
      <h2>6. DAÑOS O PÉRDIDA</h2>
      <p>Ante rotura, mancha, deterioro o extravío, el LOCADOR decide cómo reparar o reponer la prenda, y todos los costos serán soportados por el LOCATARIO.</p>
    </div>

    <div class="cl">
      <h2>7. CANCELACIÓN DEL EVENTO</h2>
      <p>Si se cancela el evento: (a) si las prendas no fueron retiradas, se pierde la seña ya pagada, sin derecho a devolución; (b) si ya fueron retiradas, se aplica el contrato completo en todas sus cláusulas.</p>
    </div>

    <div class="cl">
      <h2>8. JURISDICCIÓN</h2>
      <p>Cualquier conflicto se resuelve en los Tribunales Civiles de la Ciudad de La Rioja, renunciando a cualquier otro fuero.</p>
    </div>

    <div class="cl">
      <h2>9. FIRMA</h2>
      <p>Se firma un ejemplar en la ciudad de La Rioja, a los ${linea(String(fecha.dia), 3)} días del mes de ${linea(fecha.mes, 8)} de ${esc(anio)}, dejando constancia de la fecha, firma y DNI del LOCATARIO.</p>
      <table class="firma-loc">
        <tr>
          <td class="spacer"></td>
          <td class="etiq">Firma:</td>
          <td class="campo">&nbsp;</td>
        </tr>
      </table>
    </div>

    <div class="pagare">
      <h1>PAGARÉ</h1>
      <div class="vence">Vence el ${linea("", 3.2)} de ${linea("", 9)} de ${linea(anio, 4)}</div>
      <p>La Rioja, ${linea("", 14)} de ${esc(anio)}</p>
      <p class="monto-vista">PAGARÉ a la vista la cantidad de $ ${linea(valorPagare, 6.5)} Sin Protesto (Art. 50, D. Ley 5965/63)</p>
      <p>Al señor Schmira Ariel Fernando o a su orden, la cantidad de pesos: ${linea("", 18)}</p>
      <p>Por igual valor recibido en prendas de vestir a su entera satisfacción.</p>
      <p>Pagadero en Santiago del Estero 83, Ciudad de La Rioja.</p>
      <div class="firma-unica">
        <div class="bloque">
          <div class="raya">&nbsp;</div>
          <div class="leyenda">(Firma, aclaración y celular)</div>
        </div>
      </div>
    </div>
  </div>

  <div class="no-print">
    <button onclick="window.print()">Imprimir</button>
    <button onclick="window.close()">Cerrar</button>
  </div>
</body>
</html>`;
}

export function abrirVentanaContratoHtml(html: string): boolean {
  const ventana = window.open("", "_blank", "width=900,height=1200");
  if (!ventana) return false;
  ventana.document.write(html);
  ventana.document.close();
  return true;
}

export function abrirImpresionContratoDesdeOrden(
  orden: OrdenParaContratoImpreso
): boolean {
  return abrirVentanaContratoHtml(generarHtmlContratoAlquiler(orden));
}
