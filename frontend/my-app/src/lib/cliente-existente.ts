export type ClienteExistenteInfo = {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string | null;
  celular?: string | null;
  direccion?: string | null;
};

export type DeteccionClienteExistente = {
  encontrado: boolean;
  confianza?: string | null;
  mensaje?: string | null;
  cliente?: ClienteExistenteInfo | null;
};

export function parseClienteExistenteDetail(payload: unknown): DeteccionClienteExistente | null {
  const root = payload as Record<string, unknown> | null;
  if (!root) return null;
  const detail = (root.detail ?? root) as Record<string, unknown>;
  const nested =
    detail && typeof detail === "object" && detail.cliente
      ? detail
      : (root.data as Record<string, unknown> | undefined);
  const clienteRaw = (nested?.cliente ?? detail?.cliente) as ClienteExistenteInfo | undefined;
  if (clienteRaw && typeof clienteRaw === "object" && clienteRaw.id != null) {
    return {
      encontrado: true,
      confianza: String(nested?.confianza ?? detail?.confianza ?? ""),
      mensaje: String(nested?.mensaje ?? detail?.mensaje ?? root.message ?? ""),
      cliente: clienteRaw,
    };
  }
  if (root.encontrado && root.cliente) {
    return root as DeteccionClienteExistente;
  }
  return null;
}

export function etiquetaClienteExistente(c: ClienteExistenteInfo): string {
  const dni = c.dni ? ` · DNI ${c.dni}` : "";
  const tel = c.celular ? ` · ${c.celular}` : "";
  return `${c.apellido} ${c.nombre}${dni}${tel}`.trim();
}
