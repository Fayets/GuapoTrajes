/** Combina descripción y descripción extra separadas por guión. */
export function formatDescripcionProducto(
  descripcion?: string | null,
  descripcionExtra?: string | null
): string {
  const base = (descripcion ?? "").trim()
  const extra = (descripcionExtra ?? "").trim()
  if (extra) {
    return base ? `${base} - ${extra}` : extra
  }
  return base
}

/** Clase opcional para textos largos en listas compactas. */
export function descripcionProductoTextClass(text: string): string {
  return text.length > 55 ? "small" : ""
}
