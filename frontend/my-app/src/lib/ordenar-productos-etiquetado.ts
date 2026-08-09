/** Orden de prendas para etiquetado: línea (tipo) y luego talle. */

export type ProductoOrdenableEtiqueta = {
  id: number
  descripcion?: string | null
  linea_nombre?: string | null
  talle_nombre?: string | null
  talle_codigo?: string | null
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLocaleLowerCase("es")
}

function normOUltimo(s: string | null | undefined): string {
  const v = norm(s)
  return v || "\uffff"
}

export function claveOrdenEtiquetado(item: ProductoOrdenableEtiqueta): string[] {
  return [
    normOUltimo(item.linea_nombre),
    normOUltimo(item.talle_codigo),
    normOUltimo(item.talle_nombre),
    norm(item.descripcion),
    String(item.id ?? 0),
  ]
}

export function ordenarProductosParaEtiquetado<T extends ProductoOrdenableEtiqueta>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const ka = claveOrdenEtiquetado(a)
    const kb = claveOrdenEtiquetado(b)
    for (let i = 0; i < ka.length; i++) {
      const cmp = ka[i].localeCompare(kb[i], "es")
      if (cmp !== 0) return cmp
    }
    return 0
  })
}
