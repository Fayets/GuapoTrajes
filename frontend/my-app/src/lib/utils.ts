import { type ClassValue, clsx } from "clsx"

/**
 * Combina nombres de clases de manera condicional.
 * Esta función es una versión simplificada para proyectos que usan Bootstrap.
 */
export function cn(...inputs: ClassValue[]) {
  // Para proyectos que usan Bootstrap, clsx es suficiente
  return clsx(inputs)
}

/**
 * Formatea un valor monetario como string con formato de moneda.
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Genera un ID único
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Filtra un array de objetos por una cadena de búsqueda en múltiples propiedades
 */
export function filterBySearchTerm<T extends Record<string, any>>(
  items: T[],
  searchTerm: string,
  properties: (keyof T)[],
): T[] {
  if (!searchTerm) return items

  const lowerSearchTerm = searchTerm.toLowerCase()

  return items.filter((item) =>
    properties.some((prop) => {
      const value = item[prop]
      return value && value.toString().toLowerCase().includes(lowerSearchTerm)
    }),
  )
}

