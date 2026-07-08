const PREFIJO_CONJUNTOS_ARMADOS = "Conjuntos ya armados para esta fecha:";

/** Texto interno de conjuntos armados que no debe guardarse ni enviarse al cliente. */
export function esObservacionConjuntosArmados(
  observaciones?: string | null
): boolean {
  if (!observaciones?.trim()) return false;
  return observaciones.trimStart().startsWith(PREFIJO_CONJUNTOS_ARMADOS);
}

/** Observaciones reales para persistir (excluye aviso interno de conjuntos). */
export function observacionesParaGuardar(
  observaciones?: string | null
): string {
  if (!observaciones?.trim() || esObservacionConjuntosArmados(observaciones)) {
    return "";
  }
  return observaciones.trim();
}

/** Observaciones para mensajes al cliente (WhatsApp, etc.). */
export function observacionesParaCliente(
  observaciones?: string | null
): string | null {
  const limpio = observacionesParaGuardar(observaciones);
  return limpio || null;
}
