import { getApiBaseUrl } from "@/lib/api-config";
import {
  imprimirEtiquetasModistaLote,
  type ItemEtiquetaModista,
} from "@/lib/imprimir-etiqueta-modista";
import { formatDescripcionProducto } from "@/lib/descripcion-producto";
import { formatDdMmYyyyDesdeIso } from "@/lib/fecha-calendario";

export type ModistaOption = { id: number; nombre: string };

export type ProductoModistaStock = {
  id: number;
  descripcion: string;
  descripcion_extra?: string | null;
  codigo_barra?: string | null;
};

export async function fetchModistas(token: string): Promise<ModistaOption[]> {
  const res = await fetch(`${getApiBaseUrl()}/modistas/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data)
    ? data.map((m: { id: number; nombre?: string }) => ({
        id: m.id,
        nombre: m.nombre || String(m.id),
      }))
    : [];
}

export function descripcionProductoModista(p: ProductoModistaStock): string {
  return (
    formatDescripcionProducto(p.descripcion, p.descripcion_extra) ||
    p.descripcion ||
    "Prenda"
  );
}

export function itemEtiquetaModistaStock(
  p: ProductoModistaStock,
  notas: string
): ItemEtiquetaModista {
  return {
    tipo: "stock",
    codigoBarra: p.codigo_barra || String(p.id),
    prendaDescripcion: descripcionProductoModista(p),
    notasTrabajo: notas,
  };
}

export function itemEtiquetaModistaOrden(input: {
  codigoBarra: string;
  prendaDescripcion: string;
  notas: string;
  clienteNombre: string;
  clienteDni?: string | null;
  clienteCelular?: string | null;
  fechaRetiro?: string | null;
}): ItemEtiquetaModista {
  let fechaRetiro = "—";
  if (input.fechaRetiro) {
    try {
      fechaRetiro = formatDdMmYyyyDesdeIso(input.fechaRetiro);
    } catch {
      fechaRetiro = input.fechaRetiro;
    }
  }
  return {
    tipo: "orden",
    codigoBarra: input.codigoBarra || "0",
    prendaDescripcion: input.prendaDescripcion || "Prenda",
    notasTrabajo: input.notas,
    clienteNombre: input.clienteNombre || "Cliente",
    clienteDni: input.clienteDni || undefined,
    clienteCelular: input.clienteCelular || undefined,
    fechaRetiro,
  };
}

export async function asignarProductoAModistaStock(
  token: string,
  modistaId: number,
  productoId: number,
  notas: string
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${getApiBaseUrl()}/modistas/asignar-producto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      modista_id: modistaId,
      producto_id: productoId,
      notas: notas.trim(),
    }),
  });
  const result = (await res.json().catch(() => ({}))) as {
    message?: string;
    success?: boolean;
  };
  if (!res.ok || result.success === false) {
    return { ok: false, message: result.message || "No se pudo enviar a modista" };
  }
  return { ok: true, message: result.message };
}

export async function enviarProductoModistaDesdeOrden(
  token: string,
  ordenId: number,
  productoId: number,
  modistaId: number,
  notas: string
): Promise<{ ok: boolean; message?: string }> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const base = getApiBaseUrl();

  const patchRes = await fetch(
    `${base}/ordenes/${ordenId}/productos-reservados/${productoId}/modista`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        requiere_modista: true,
        notas_modista: notas.trim(),
      }),
    }
  );
  if (!patchRes.ok) {
    const err = (await patchRes.json().catch(() => ({}))) as { detail?: string };
    return {
      ok: false,
      message:
        typeof err.detail === "string"
          ? err.detail
          : "No se pudo guardar el trabajo de modista",
    };
  }

  const res = await fetch(
    `${base}/ordenes/${ordenId}/productos-reservados/${productoId}/enviar-modista`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ modista_id: modistaId }),
    }
  );
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    success?: boolean;
    detail?: string;
  };
  if (!res.ok || body.success === false) {
    return {
      ok: false,
      message:
        (typeof body.detail === "string" && body.detail) ||
        body.message ||
        "No se pudo enviar a modista",
    };
  }
  return { ok: true, message: body.message };
}

export async function imprimirStickerModista(
  items: ItemEtiquetaModista[]
): Promise<{ ok: boolean; message?: string }> {
  const result = await imprimirEtiquetasModistaLote(items);
  const algunoOk = result.porIndice.some((s) => s === "ok");
  if (!algunoOk) {
    return {
      ok: false,
      message: result.mensajeAyuda || "No se pudo imprimir la etiqueta de modista",
    };
  }
  return { ok: true };
}
