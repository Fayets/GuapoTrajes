import {
  leerConfigImpresionEtiquetas,
  nombreImpresoraSugerida,
  patronImpresoraPorTipo,
  type TipoImpresionEtiqueta,
} from "@/lib/impresion-etiquetas-config";
import {
  imprimirHtmlEnNavegador,
  type TamanoEtiquetaMm,
} from "@/lib/impresion-html-navegador";
import { imprimirHtmlEnQz } from "@/lib/impresion-qz-tray";

export type ResultadoImpresionEtiqueta = {
  metodo: "qz" | "navegador";
  resultado: "ok" | "error";
  impresora?: string;
  mensajeAyuda?: string;
};

export async function imprimirEtiquetaConRouting(
  tipo: TipoImpresionEtiqueta,
  html: string,
  tamano: TamanoEtiquetaMm,
  orientacion: "portrait" | "landscape" = "portrait"
): Promise<ResultadoImpresionEtiqueta> {
  const config = leerConfigImpresionEtiquetas();
  const patron = patronImpresoraPorTipo(tipo, config);
  const sugerida = nombreImpresoraSugerida(tipo);

  if (config.usarQzTray) {
    const qz = await imprimirHtmlEnQz(html, patron, tamano, orientacion);
    if (qz.ok) {
      return {
        metodo: "qz",
        resultado: "ok",
        impresora: qz.impresora,
      };
    }
  }

  const navegador = await imprimirHtmlEnNavegador(html, tamano);
  return {
    metodo: "navegador",
    resultado: navegador,
    mensajeAyuda:
      navegador === "ok"
        ? `Seleccioná la impresora «${sugerida}» en el diálogo de impresión.`
        : undefined,
  };
}
