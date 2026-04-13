"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

// Definición del tipo Sucursal con los atributos solicitados
export type Sucursal = {
  id: number
  nombre: string
  direccion: string
  provincia: string
}

type SucursalContextType = {
  sucursales: Sucursal[]
  sucursalActual: Sucursal | null
  isLoading: boolean
  error: string | null
  seleccionarSucursal: (sucursal: Sucursal) => void
  agregarSucursal: (sucursal: Omit<Sucursal, "id">) => void
  editarSucursal: (id: number, sucursal: Omit<Sucursal, "id">) => void
  eliminarSucursal: (id: number) => boolean
}

const SucursalContext = createContext<SucursalContextType | undefined>(undefined)

// Datos de ejemplo para las sucursales
const sucursalesIniciales: Sucursal[] = [
  { id: 1, nombre: "Sucursal Central", direccion: "Av. Corrientes 1234", provincia: "Buenos Aires" },
  { id: 2, nombre: "Sucursal Norte", direccion: "Av. Cabildo 4567", provincia: "Buenos Aires" },
  { id: 3, nombre: "Sucursal Sur", direccion: "Av. Mitre 890", provincia: "Buenos Aires" },
]

export function SucursalProvider({ children }: { children: React.ReactNode }) {
  const [sucursales, setSucursales] = useState<Sucursal[]>(sucursalesIniciales)
  const [sucursalActual, setSucursalActual] = useState<Sucursal | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar sucursales al montar el componente
  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        setIsLoading(true)
        // En un caso real, aquí harías un fetch a tu API
        // Por ahora usamos los datos de ejemplo

        // Verificar si hay una sucursal guardada en localStorage
        const sucursalGuardada = localStorage.getItem("sucursalActual")
        if (sucursalGuardada) {
          const sucursal = JSON.parse(sucursalGuardada)
          setSucursalActual(sucursal)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
        console.error("Error al cargar sucursales:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSucursales()
  }, [])

  // Función para seleccionar una sucursal
  const seleccionarSucursal = (sucursal: Sucursal) => {
    setSucursalActual(sucursal)
    localStorage.setItem("sucursalActual", JSON.stringify(sucursal))
  }

  // Función para agregar una nueva sucursal
  const agregarSucursal = (nuevaSucursal: Omit<Sucursal, "id">) => {
    // Generar un nuevo ID (en un caso real, esto lo haría el backend)
    const nuevoId = Math.max(...sucursales.map((s) => s.id), 0) + 1
    const sucursalCompleta = { id: nuevoId, ...nuevaSucursal }

    setSucursales([...sucursales, sucursalCompleta])
  }

  // Función para editar una sucursal existente
  const editarSucursal = (id: number, sucursalActualizada: Omit<Sucursal, "id">) => {
    setSucursales(
      sucursales.map((sucursal) => (sucursal.id === id ? { ...sucursal, ...sucursalActualizada } : sucursal)),
    )

    // Si la sucursal editada es la actual, actualizar también sucursalActual
    if (sucursalActual && sucursalActual.id === id) {
      const sucursalEditada = { id, ...sucursalActualizada }
      setSucursalActual(sucursalEditada)
      localStorage.setItem("sucursalActual", JSON.stringify(sucursalEditada))
    }
  }

  // Función para eliminar una sucursal
  const eliminarSucursal = (id: number): boolean => {
    // No permitir eliminar la sucursal actual
    if (sucursalActual && sucursalActual.id === id) {
      return false
    }

    setSucursales(sucursales.filter((sucursal) => sucursal.id !== id))
    return true
  }

  return (
    <SucursalContext.Provider
      value={{
        sucursales,
        sucursalActual,
        isLoading,
        error,
        seleccionarSucursal,
        agregarSucursal,
        editarSucursal,
        eliminarSucursal,
      }}
    >
      {children}
    </SucursalContext.Provider>
  )
}

export function useSucursal() {
  const context = useContext(SucursalContext)
  if (context === undefined) {
    throw new Error("useSucursal debe ser usado dentro de un SucursalProvider")
  }
  return context
}

