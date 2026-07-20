/** Datos del LOCATARIO / pagaré en el contrato impreso. */
export type DatosLocatarioContrato = {
  nombre: string;
  dni: string;
  direccion: string;
  celular: string;
};

export type FirmanteContratoPayload = {
  nombre: string;
  dni: string;
  direccion: string;
  celular?: string | null;
};

type OrdenConFirmante = {
  cliente_nombre?: string | null;
  cliente_dni?: string | null;
  cliente_direccion?: string | null;
  cliente_celular?: string | null;
  firmante_nombre?: string | null;
  firmante_dni?: string | null;
  firmante_direccion?: string | null;
  firmante_celular?: string | null;
  tiene_firmante_anexo?: boolean;
};

/**
 * Por defecto: cliente titular (quien se vistió).
 * Si hay firmante anexado: ese es el LOCATARIO y el del pagaré.
 */
export function resolverLocatarioContrato(
  orden: OrdenConFirmante
): DatosLocatarioContrato {
  const anexo =
    orden.tiene_firmante_anexo === true ||
    Boolean((orden.firmante_nombre || "").trim());

  if (anexo) {
    return {
      nombre: (orden.firmante_nombre || "").trim(),
      dni: (orden.firmante_dni || "").trim() || "____________________",
      direccion:
        (orden.firmante_direccion || "").trim() ||
        "__________________________",
      celular: (orden.firmante_celular || "").trim(),
    };
  }

  return {
    nombre: orden.cliente_nombre || "",
    dni: (orden.cliente_dni || "").trim() || "____________________",
    direccion:
      (orden.cliente_direccion || "").trim() || "__________________________",
    celular: (orden.cliente_celular || "").trim(),
  };
}
