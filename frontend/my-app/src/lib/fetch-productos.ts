import { apiFetch } from "./api-client";

export type FetchProductosParams = Record<
  string,
  string | number | boolean | undefined
>;

const API_PAGE_SIZE = 500;

function buildProductosUrl(params: FetchProductosParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `/productos/all${qs ? `?${qs}` : ""}`;
}

/** Lee el total del header de paginación (requiere CORS expose_headers en el backend). */
export function parseProductosTotal(res: Response, pageItems: unknown[]): number {
  const header = res.headers.get("X-Total-Count");
  if (header != null && header !== "") {
    const n = Number(header);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return Array.isArray(pageItems) ? pageItems.length : 0;
}

/** Una página de productos con total para paginación en UI. */
export async function fetchProductosPage(
  token: string,
  page: number,
  size: number,
  extraParams: FetchProductosParams = {}
): Promise<{ items: unknown[]; total: number }> {
  const params: FetchProductosParams = {
    page,
    size,
    ...extraParams,
  };
  const res = await apiFetch(buildProductosUrl(params), { token });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status} al obtener productos`);
  }
  const items = await res.json();
  const list = Array.isArray(items) ? items : [];
  let total = parseProductosTotal(res, list);
  if (!res.headers.get("X-Total-Count") && list.length === size) {
    total = Math.max(total, page * size + 1);
  } else if (!res.headers.get("X-Total-Count") && list.length < size) {
    total = (page - 1) * size + list.length;
  }
  return { items: list, total };
}

/** Carga todas las páginas (para selects en ventas, presupuestos, etc.). */
export async function fetchAllProductos(
  token: string,
  extraParams: FetchProductosParams = {}
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;

  while (true) {
    const { items, total } = await fetchProductosPage(
      token,
      page,
      API_PAGE_SIZE,
      extraParams
    );
    if (items.length === 0) break;
    all.push(...items);
    if (all.length >= total || items.length < API_PAGE_SIZE) break;
    page += 1;
  }

  return all;
}

/** Estadísticas de etiquetas de inventario (migración). */
export async function fetchEtiquetasInventarioStats(
  token: string,
  params: FetchProductosParams = {}
): Promise<{ total: number; impresos: number; pendientes: number }> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  const path = `/productos/stats/etiquetas-inventario${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path, { token });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener estadísticas de etiquetas`);
  }
  return res.json();
}

/** Registra impresiones de etiquetas de inventario. */
export async function registrarEtiquetasInventario(
  token: string,
  productoIds: number[]
): Promise<{ message: string; success: boolean }> {
  const res = await apiFetch("/productos/etiquetas-inventario/registrar", {
    token,
    method: "POST",
    body: JSON.stringify({ producto_ids: productoIds }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(
      typeof json.message === "string"
        ? json.message
        : "Error al registrar etiquetas impresas"
    );
  }
  return json;
}

/** Resetea progreso de etiquetas de inventario. */
export async function resetEtiquetasInventario(
  token: string,
  body: Record<string, unknown>
): Promise<{ message: string; success: boolean }> {
  const res = await apiFetch("/productos/etiquetas-inventario/reset", {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(
      typeof json.message === "string" ? json.message : "Error al resetear"
    );
  }
  return json;
}

/** Lista sucursales desde la API. */
export async function fetchSucursales(
  token: string
): Promise<
  Array<{ id: number; nombre: string; direccion: string; provincia: string }>
> {
  const data = await apiFetch("/sucursales/all", { token });
  if (!data.ok) {
    throw new Error(`Error ${data.status} al obtener sucursales`);
  }
  const list = await data.json();
  return Array.isArray(list) ? list : [];
}

/** Logs del sistema (SUPER_ADMIN). */
export async function fetchSystemLogs(
  token: string,
  params: Record<string, string> = {}
): Promise<{
  total_logs: number;
  filtered_logs: number;
  logs: Array<{
    timestamp: string;
    level: string;
    category: string;
    message: string;
    details?: Record<string, unknown> | null;
    raw_line: string;
  }>;
  categories: string[];
}> {
  const search = new URLSearchParams(params);
  const qs = search.toString();
  const path = `/logs/system${qs ? `?${qs}` : ""}`;
  return apiFetch(path, { token }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.detail === "string" ? err.detail : `Error ${res.status}`
      );
    }
    return res.json();
  });
}

/** Categorías de logs (SUPER_ADMIN). */
export async function fetchLogCategories(
  token: string
): Promise<{ categories: string[] }> {
  const res = await apiFetch("/logs/categories", { token });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener categorías de logs`);
  }
  return res.json();
}
