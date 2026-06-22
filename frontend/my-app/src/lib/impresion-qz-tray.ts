import type { TamanoEtiquetaMm } from "@/lib/impresion-html-navegador";

type QzApi = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
  printers: {
    find: (query?: string) => Promise<string | string[]>;
  };
  configs: {
    create: (
      printer: string | null,
      options?: Record<string, unknown>
    ) => Record<string, unknown>;
  };
  print: (
    config: Record<string, unknown>,
    data: Array<Record<string, unknown>>
  ) => Promise<void>;
};

const QZ_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/qz-tray@2.2.5/qz-tray.js";

let scriptCargando: Promise<boolean> | null = null;

function obtenerQz(): QzApi | null {
  if (typeof window === "undefined") return null;
  const qz = (window as Window & { qz?: QzApi }).qz;
  return qz ?? null;
}

export async function qzTrayDisponible(): Promise<boolean> {
  return (await cargarQzTray()) && (await probarConexionQz());
}

export async function cargarQzTray(): Promise<boolean> {
  if (obtenerQz()) return true;
  if (scriptCargando) return scriptCargando;

  scriptCargando = new Promise<boolean>((resolve) => {
    const existente = document.querySelector<HTMLScriptElement>(
      `script[data-qz-tray="1"]`
    );
    if (existente) {
      existente.addEventListener("load", () => resolve(Boolean(obtenerQz())));
      existente.addEventListener("error", () => resolve(false));
      if (obtenerQz()) resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = QZ_SCRIPT_URL;
    script.async = true;
    script.dataset.qzTray = "1";
    script.onload = () => resolve(Boolean(obtenerQz()));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  const ok = await scriptCargando;
  scriptCargando = null;
  return ok;
}

export async function probarConexionQz(): Promise<boolean> {
  const qz = obtenerQz();
  if (!qz) return false;
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    return true;
  } catch {
    return false;
  }
}

export async function listarImpresorasQz(): Promise<string[]> {
  const qz = obtenerQz();
  if (!qz) return [];
  const conectado = await probarConexionQz();
  if (!conectado) return [];

  try {
    const resultado = await qz.printers.find();
    if (Array.isArray(resultado)) return resultado;
    if (typeof resultado === "string" && resultado) return [resultado];
    return [];
  } catch {
    return [];
  }
}

export async function resolverImpresoraQz(
  patron: string
): Promise<string | null> {
  const busqueda = (patron || "").trim();
  if (!busqueda) return null;

  const qz = obtenerQz();
  if (!qz) return null;
  const conectado = await probarConexionQz();
  if (!conectado) return null;

  try {
    const directa = await qz.printers.find(busqueda);
    if (typeof directa === "string" && directa) return directa;
    if (Array.isArray(directa) && directa.length > 0) return directa[0];
  } catch {
    // Continuar con búsqueda manual en el listado completo
  }

  const todas = await listarImpresorasQz();
  const lower = busqueda.toLowerCase();
  const exacta = todas.find((p) => p.toLowerCase() === lower);
  if (exacta) return exacta;

  const parcial = todas.find((p) => p.toLowerCase().includes(lower));
  return parcial ?? null;
}

export type ResultadoImpresionQz =
  | { ok: true; impresora: string }
  | { ok: false; motivo: "sin_qz" | "sin_conexion" | "impresora_no_encontrada" | "error" };

export async function imprimirHtmlEnQz(
  html: string,
  patronImpresora: string,
  tamano: TamanoEtiquetaMm,
  orientacion: "portrait" | "landscape" = "portrait"
): Promise<ResultadoImpresionQz> {
  const cargado = await cargarQzTray();
  if (!cargado) return { ok: false, motivo: "sin_qz" };

  const conectado = await probarConexionQz();
  if (!conectado) return { ok: false, motivo: "sin_conexion" };

  const impresora = await resolverImpresoraQz(patronImpresora);
  if (!impresora) return { ok: false, motivo: "impresora_no_encontrada" };

  const qz = obtenerQz();
  if (!qz) return { ok: false, motivo: "sin_qz" };

  try {
    const config = qz.configs.create(impresora, {
      size: { width: tamano.anchoMm, height: tamano.altoMm },
      units: "mm",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      orientation: orientacion,
      scaleContent: false,
    });

    await qz.print(config, [
      {
        type: "pixel",
        format: "html",
        flavor: "plain",
        data: html,
      },
    ]);

    return { ok: true, impresora };
  } catch {
    return { ok: false, motivo: "error" };
  }
}
