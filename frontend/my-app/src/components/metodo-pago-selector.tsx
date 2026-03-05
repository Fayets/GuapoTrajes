"use client"

import { useEffect, useState } from "react"
import { getApiBaseUrl } from "@/lib/api-config"
import { useAuth } from "@/context/auth-context"
import { toast } from "sonner"

interface MetodoPago {
  id: number
  nombre: string
  activo: boolean
  tiene_submetodos: boolean
  orden: number
  submétodos: SubmetodoPago[]
}

interface SubmetodoPago {
  id: number
  nombre: string
  activo: boolean
  orden: number
}

interface MetodoPagoSelectorProps {
  sucursalId?: number | null
  metodoPagoId?: number | null
  submetodoPagoId?: number | null
  onMetodoChange: (metodoId: number | null, submetodoId: number | null, metodoDisplay: string) => void
  required?: boolean
  className?: string
  label?: string
  showError?: boolean
}

export function MetodoPagoSelector({
  sucursalId,
  metodoPagoId: controlledMetodoPagoId,
  submetodoPagoId: controlledSubmetodoPagoId,
  onMetodoChange,
  required = false,
  className = "",
  label = "Método de pago",
  showError = false
}: MetodoPagoSelectorProps) {
  const { me } = useAuth()
  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(controlledMetodoPagoId || null)
  const [submetodoPagoId, setSubmetodoPagoId] = useState<number | null>(controlledSubmetodoPagoId || null)

  const API_BASE = getApiBaseUrl()

  useEffect(() => {
    if (controlledMetodoPagoId !== undefined) {
      setMetodoPagoId(controlledMetodoPagoId)
    }
  }, [controlledMetodoPagoId])

  useEffect(() => {
    if (controlledSubmetodoPagoId !== undefined) {
      setSubmetodoPagoId(controlledSubmetodoPagoId)
    }
  }, [controlledSubmetodoPagoId])

  useEffect(() => {
    const cargarMetodos = async () => {
      setLoading(true)
      try {
        // Usar sucursalId proporcionado o la del usuario
        const targetSucursalId = sucursalId || me?.sucursalId

        if (!targetSucursalId) {
          console.warn("⚠️ No se pudo determinar la sucursal para cargar métodos de pago")
          setMetodos([])
          return
        }

        const token = localStorage.getItem("token")
        const response = await fetch(`${API_BASE}/metodos-pago/sucursal/${targetSucursalId}?solo_activos=true`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        if (data.success && data.data) {
          setMetodos(data.data)
        } else {
          throw new Error("Formato de respuesta inválido")
        }
      } catch (error: any) {
        console.error("Error al cargar métodos de pago:", error)
        toast.error("Error al cargar métodos de pago")
        setMetodos([])
      } finally {
        setLoading(false)
      }
    }

    if (me) {
      cargarMetodos()
    }
  }, [me, sucursalId])

  const handleMetodoSelect = (metodoId: number) => {
    const metodo = metodos.find(m => m.id === metodoId)
    if (!metodo) return

    setMetodoPagoId(metodoId)
    
    // Si el método no tiene submétodos o cambió de método, resetear submétodo
    if (!metodo.tiene_submetodos) {
      setSubmetodoPagoId(null)
      const metodoDisplay = metodo.nombre
      onMetodoChange(metodoId, null, metodoDisplay)
    } else {
      // Si tiene submétodos, mantener el submetodo solo si es válido para este método
      const submetodosIds = metodo.submétodos.map(s => s.id)
      const currentSubmetodoValid = submetodoPagoId && submetodosIds.includes(submetodoPagoId)
      
      if (!currentSubmetodoValid) {
        setSubmetodoPagoId(null)
      }
      
      const metodoDisplay = metodo.nombre
      onMetodoChange(metodoId, null, metodoDisplay)
    }
  }

  const handleSubmetodoSelect = (submetodoId: number) => {
    setSubmetodoPagoId(submetodoId)
    const metodo = metodos.find(m => m.id === metodoPagoId)
    const submetodo = metodo?.submétodos.find(s => s.id === submetodoId)
    
    if (metodo && submetodo) {
      const metodoDisplay = `${metodo.nombre} - ${submetodo.nombre}`
      onMetodoChange(metodoPagoId!, submetodoId, metodoDisplay)
    }
  }

  const metodoSeleccionado = metodos.find(m => m.id === metodoPagoId)
  const submetodosDisponibles = metodoSeleccionado?.tiene_submetodos 
    ? metodoSeleccionado.submétodos.filter(s => s.activo)
    : []

  if (loading) {
    return (
      <div className={className}>
        <label className="form-label fw-bold">{label}{required && " *"}</label>
        <div className="text-muted">Cargando métodos de pago...</div>
      </div>
    )
  }

  if (metodos.length === 0) {
    return (
      <div className={className}>
        <label className="form-label fw-bold">{label}{required && " *"}</label>
        <div className="text-warning">No hay métodos de pago disponibles</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <label className="form-label fw-bold">
        {label}{required && " *"}
      </label>

      {/* Selector de Método Principal */}
      <div className="row g-3 mt-1">
        {metodos
          .filter(m => m.activo)
          .sort((a, b) => a.orden - b.orden)
          .map((metodo) => {
            const activo = metodoPagoId === metodo.id
            return (
              <div className="col-12 col-md-6" key={metodo.id}>
                <div
                  className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                    activo
                      ? "border-primary bg-primary bg-opacity-10"
                      : "border-light bg-white"
                  }`}
                  role="button"
                  onClick={() => handleMetodoSelect(metodo.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="form-check m-0">
                    <input
                      type="radio"
                      name="metodoPago"
                      value={metodo.id}
                      checked={activo}
                      onChange={() => handleMetodoSelect(metodo.id)}
                      className="form-check-input"
                    />
                  </div>
                  <div>
                    <span className="fw-semibold d-block">
                      {metodo.nombre}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* Selector de Submétodo (si el método seleccionado tiene submétodos) */}
      {metodoSeleccionado && metodoSeleccionado.tiene_submetodos && submetodosDisponibles.length > 0 && (
        <div className="mt-3">
          <label className="form-label fw-semibold">
            Submétodo de {metodoSeleccionado.nombre} *
          </label>
          <div className="row g-3 mt-1">
            {submetodosDisponibles
              .sort((a, b) => a.orden - b.orden)
              .map((submetodo) => {
                const activo = submetodoPagoId === submetodo.id
                return (
                  <div className="col-12 col-md-6" key={submetodo.id}>
                    <div
                      className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                        activo
                          ? "border-success bg-success bg-opacity-10"
                          : "border-light bg-white"
                      }`}
                      role="button"
                      onClick={() => handleSubmetodoSelect(submetodo.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="form-check m-0">
                        <input
                          type="radio"
                          name="submetodoPago"
                          value={submetodo.id}
                          checked={activo}
                          onChange={() => handleSubmetodoSelect(submetodo.id)}
                          className="form-check-input"
                        />
                      </div>
                      <div>
                        <span className="fw-semibold d-block">
                          {submetodo.nombre}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
          {!submetodoPagoId && (
            <div className="text-danger small mt-2">
              Debes seleccionar un submétodo de {metodoSeleccionado.nombre}
            </div>
          )}
        </div>
      )}

      {/* Mensaje de error si es requerido */}
      {showError && required && !metodoPagoId && (
        <div className="text-danger small mt-3">
          Debes seleccionar un método de pago
        </div>
      )}

      {/* Mensaje de error si falta submétodo */}
      {showError && 
       metodoSeleccionado && 
       metodoSeleccionado.tiene_submetodos && 
       !submetodoPagoId && (
        <div className="text-danger small mt-3">
          Debes seleccionar un submétodo
        </div>
      )}
    </div>
  )
}
