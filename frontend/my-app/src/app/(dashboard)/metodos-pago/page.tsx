"use client"

import { useEffect, useState } from "react"
import { getApiBaseUrl } from "@/lib/api-config"
import { useAuth } from "@/context/auth-context"
import { toast } from "sonner"
import { RoleGate } from "@/components/RoleGate"

interface MetodoPago {
  id: number
  nombre: string
  activo: boolean
  tiene_submetodos: boolean
  orden: number
  fecha_creacion: string
  submétodos: SubmetodoPago[]
}

interface SubmetodoPago {
  id: number
  nombre: string
  activo: boolean
  orden: number
  fecha_creacion: string
}

interface Sucursal {
  id: number
  nombre: string
}

export default function MetodosPagoPage() {
  const { me } = useAuth()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number | null>(null)
  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetodoModal, setShowMetodoModal] = useState(false)
  const [showSubmetodoModal, setShowSubmetodoModal] = useState(false)
  const [metodoEdicion, setMetodoEdicion] = useState<MetodoPago | null>(null)
  const [metodoParaSubmetodo, setMetodoParaSubmetodo] = useState<MetodoPago | null>(null)
  const [submetodoEdicion, setSubmetodoEdicion] = useState<SubmetodoPago | null>(null)
  const [formMetodo, setFormMetodo] = useState({
    nombre: "",
    activo: true,
    tiene_submetodos: false,
    orden: 0
  })
  const [formSubmetodo, setFormSubmetodo] = useState({
    nombre: "",
    activo: true,
    orden: 0
  })

  const API_BASE = getApiBaseUrl()

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  // Cargar sucursales primero
  useEffect(() => {
    fetch(`${API_BASE}/sucursales/all`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener sucursales")
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data)
          console.log("✅ Sucursales cargadas:", data)
          // Establecer sucursal seleccionada
          if (data.length > 0) {
            const primeraSucursal = data[0].id
            console.log("🏢 Estableciendo primera sucursal:", primeraSucursal)
            setSucursalSeleccionada(primeraSucursal)
          }
        }
      })
      .catch((error) => {
        console.error("Error al obtener sucursales:", error)
        toast.error("Error al cargar sucursales")
      })
  }, [])

  // Cargar métodos cuando cambia la sucursal seleccionada
  useEffect(() => {
    if (sucursalSeleccionada) {
      console.log("🔄 Sucursal seleccionada cambió a:", sucursalSeleccionada)
      cargarMetodos()
    } else {
      setMetodos([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalSeleccionada])

  const cargarMetodos = async () => {
    if (!sucursalSeleccionada) {
      setMetodos([])
      return
    }
    
    setLoading(true)
    try {
      // En la página de administración, NO pasamos solo_activos para ver todos los métodos (activos e inactivos)
      const url = `${API_BASE}/metodos-pago/sucursal/${sucursalSeleccionada}`
      console.log("🔍 Cargando métodos de pago desde:", url)
      
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ Error HTTP:", response.status, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      console.log("✅ Métodos de pago recibidos:", data)
      
      if (data.success && data.data) {
        if (Array.isArray(data.data)) {
          console.log(`✅ ${data.data.length} métodos de pago cargados`)
          setMetodos(data.data)
        } else {
          console.warn("⚠️ Data no es un array:", data.data)
          setMetodos([])
        }
      } else {
        console.warn("⚠️ Respuesta sin success o data:", data)
        setMetodos([])
      }
    } catch (error: any) {
      console.error("❌ Error al cargar métodos de pago:", error)
      toast.error(error.message || "Error al cargar métodos de pago")
      setMetodos([])
    } finally {
      setLoading(false)
    }
  }

  const abrirModalCrearMetodo = () => {
    setMetodoEdicion(null)
    setFormMetodo({
      nombre: "",
      activo: true,
      tiene_submetodos: false,
      orden: metodos.length + 1
    })
    setShowMetodoModal(true)
  }

  const abrirModalEditarMetodo = (metodo: MetodoPago) => {
    setMetodoEdicion(metodo)
    setFormMetodo({
      nombre: metodo.nombre,
      activo: metodo.activo,
      tiene_submetodos: metodo.tiene_submetodos,
      orden: metodo.orden
    })
    setShowMetodoModal(true)
  }

  const abrirModalCrearSubmetodo = (metodo: MetodoPago) => {
    if (!metodo.tiene_submetodos) {
      toast.error("Este método no acepta submétodos")
      return
    }
    setMetodoParaSubmetodo(metodo)
    setSubmetodoEdicion(null)
    setFormSubmetodo({
      nombre: "",
      activo: true,
      orden: (metodo.submétodos?.length || 0) + 1
    })
    setShowSubmetodoModal(true)
  }

  const abrirModalEditarSubmetodo = (submetodo: SubmetodoPago, metodo: MetodoPago) => {
    setMetodoParaSubmetodo(metodo)
    setSubmetodoEdicion(submetodo)
    setFormSubmetodo({
      nombre: submetodo.nombre,
      activo: submetodo.activo,
      orden: submetodo.orden
    })
    setShowSubmetodoModal(true)
  }

  const guardarMetodo = async () => {
    if (!formMetodo.nombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    if (!sucursalSeleccionada) {
      toast.error("Debes seleccionar una sucursal")
      return
    }

    try {
      const url = metodoEdicion
        ? `${API_BASE}/metodos-pago/${metodoEdicion.id}`
        : `${API_BASE}/metodos-pago/`
      
      const payload = metodoEdicion
        ? { ...formMetodo }
        : { ...formMetodo, sucursal_id: sucursalSeleccionada }

      const method = metodoEdicion ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Error al guardar método de pago")
      }

      const result = await response.json()
      console.log("📝 Resultado de guardar método:", result)

      // Cerrar modal primero
      setShowMetodoModal(false)
      setMetodoEdicion(null)
      setFormMetodo({
        nombre: "",
        activo: true,
        tiene_submetodos: false,
        orden: 0
      })
      
      // Recargar métodos de pago
      await cargarMetodos()
      
      toast.success(metodoEdicion ? "Método actualizado" : "Método creado")
    } catch (error: any) {
      toast.error(error.message || "Error al guardar método de pago")
    }
  }

  const guardarSubmetodo = async () => {
    if (!formSubmetodo.nombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    if (!metodoParaSubmetodo) {
      toast.error("Error: método no seleccionado")
      return
    }

    try {
      const url = submetodoEdicion
        ? `${API_BASE}/metodos-pago/submetodos/${submetodoEdicion.id}`
        : `${API_BASE}/metodos-pago/submetodos/`
      
      const payload = submetodoEdicion
        ? { ...formSubmetodo }
        : { ...formSubmetodo, metodo_pago_id: metodoParaSubmetodo.id }

      const method = submetodoEdicion ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Error al guardar submétodo")
      }

      const result = await response.json()
      console.log("📝 Resultado de guardar submétodo:", result)

      // Cerrar modal primero
      setShowSubmetodoModal(false)
      setSubmetodoEdicion(null)
      setMetodoParaSubmetodo(null)
      setFormSubmetodo({
        nombre: "",
        activo: true,
        orden: 0
      })
      
      // Recargar métodos de pago
      await cargarMetodos()
      
      toast.success(submetodoEdicion ? "Submétodo actualizado" : "Submétodo creado")
    } catch (error: any) {
      toast.error(error.message || "Error al guardar submétodo")
    }
  }

  const toggleActivarMetodo = async (metodo: MetodoPago) => {
    try {
      const response = await fetch(`${API_BASE}/metodos-pago/${metodo.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ activo: !metodo.activo }),
      })

      if (!response.ok) throw new Error("Error al actualizar método")
      
      // Recargar métodos de pago
      await cargarMetodos()
      
      toast.success(metodo.activo ? "Método desactivado" : "Método activado")
    } catch (error: any) {
      toast.error("Error al actualizar método: " + error.message)
    }
  }

  const toggleActivarSubmetodo = async (submetodo: SubmetodoPago, metodo: MetodoPago) => {
    try {
      const response = await fetch(`${API_BASE}/metodos-pago/submetodos/${submetodo.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ activo: !submetodo.activo }),
      })

      if (!response.ok) throw new Error("Error al actualizar submétodo")
      
      // Recargar métodos de pago
      await cargarMetodos()
      
      toast.success(submetodo.activo ? "Submétodo desactivado" : "Submétodo activado")
    } catch (error: any) {
      toast.error("Error al actualizar submétodo: " + error.message)
    }
  }

  return (
    <RoleGate allow={["ADMIN"]}>
      <div className="p-6">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Métodos de Pago</h1>
            <p className="text-muted">Gestiona los métodos de pago configurables por sucursal</p>
          </div>
        </div>

        {/* Selector de Sucursal */}
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <div className="row align-items-end">
              <div className="col-md-4">
                <label className="form-label fw-bold">Sucursal</label>
                <select
                  className="form-select"
                  value={sucursalSeleccionada || ""}
                  onChange={(e) => {
                    const nuevaSucursal = Number(e.target.value) || null
                    console.log("🔄 Cambiando sucursal seleccionada a:", nuevaSucursal)
                    setSucursalSeleccionada(nuevaSucursal)
                  }}
                >
                  <option value="">Seleccionar sucursal</option>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    console.log("🔄 Recargando métodos de pago manualmente")
                    if (sucursalSeleccionada) {
                      cargarMetodos()
                    } else {
                      toast.error("Seleccioná una sucursal primero")
                    }
                  }}
                  disabled={!sucursalSeleccionada || loading}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Recargar
                </button>
              </div>
            </div>
          </div>
        </div>

        {sucursalSeleccionada && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Métodos de Pago</h5>
              <button
                className="btn btn-primary"
                onClick={abrirModalCrearMetodo}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Nuevo Método
              </button>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : metodos.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5">
                  <i className="bi bi-credit-card text-muted" style={{ fontSize: "3rem" }}></i>
                  <p className="text-muted mt-3">No hay métodos de pago configurados</p>
                  <button className="btn btn-primary" onClick={abrirModalCrearMetodo}>
                    Crear primer método
                  </button>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {metodos.map((metodo) => (
                  <div key={metodo.id} className="col-12">
                    <div className="card shadow-sm">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <h6 className="mb-0">{metodo.nombre}</h6>
                              <span className={`badge ${metodo.activo ? "bg-success" : "bg-secondary"}`}>
                                {metodo.activo ? "Activo" : "Inactivo"}
                              </span>
                              {metodo.tiene_submetodos && (
                                <span className="badge bg-info">Con submétodos</span>
                              )}
                            </div>
                            <small className="text-muted">
                              Orden: {metodo.orden} | 
                              {metodo.tiene_submetodos && ` ${metodo.submétodos?.length || 0} submétodo(s)`}
                            </small>

                            {metodo.tiene_submetodos && metodo.submétodos && metodo.submétodos.length > 0 && (
                              <div className="mt-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="fw-semibold">Submétodos:</small>
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => abrirModalCrearSubmetodo(metodo)}
                                  >
                                    <i className="bi bi-plus-circle me-1"></i>
                                    Agregar
                                  </button>
                                </div>
                                <div className="row g-2">
                                  {metodo.submétodos
                                    .sort((a, b) => a.orden - b.orden)
                                    .map((submetodo) => (
                                    <div key={submetodo.id} className="col-12 col-md-6">
                                      <div className="border rounded p-2 d-flex justify-content-between align-items-center">
                                        <div>
                                          <span className="fw-semibold">{submetodo.nombre}</span>
                                          <span className={`badge ms-2 ${submetodo.activo ? "bg-success" : "bg-secondary"}`}>
                                            {submetodo.activo ? "Activo" : "Inactivo"}
                                          </span>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                          <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => abrirModalEditarSubmetodo(submetodo, metodo)}
                                            title="Editar"
                                          >
                                            <i className="bi bi-pencil"></i>
                                          </button>
                                          <button
                                            className={`btn ${submetodo.activo ? "btn-outline-warning" : "btn-outline-success"}`}
                                            onClick={() => toggleActivarSubmetodo(submetodo, metodo)}
                                            title={submetodo.activo ? "Desactivar" : "Activar"}
                                          >
                                            <i className={`bi ${submetodo.activo ? "bi-x-circle" : "bi-check-circle"}`}></i>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {metodo.tiene_submetodos && (!metodo.submétodos || metodo.submétodos.length === 0) && (
                              <div className="mt-2">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => abrirModalCrearSubmetodo(metodo)}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Agregar primer submétodo
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => abrirModalEditarMetodo(metodo)}
                              title="Editar"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className={`btn ${metodo.activo ? "btn-outline-warning" : "btn-outline-success"}`}
                              onClick={() => toggleActivarMetodo(metodo)}
                              title={metodo.activo ? "Desactivar" : "Activar"}
                            >
                              <i className={`bi ${metodo.activo ? "bi-x-circle" : "bi-check-circle"}`}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Modal Método */}
        {showMetodoModal && (
          <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {metodoEdicion ? "Editar Método" : "Nuevo Método"}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowMetodoModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formMetodo.nombre}
                      onChange={(e) => setFormMetodo({ ...formMetodo, nombre: e.target.value })}
                      placeholder="Ej: Tarjeta, Billetera Virtual"
                    />
                  </div>
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={formMetodo.tiene_submetodos}
                        onChange={(e) => setFormMetodo({ ...formMetodo, tiene_submetodos: e.target.checked })}
                      />
                      <label className="form-check-label">
                        Tiene submétodos
                      </label>
                    </div>
                    <small className="text-muted">
                      Activa esta opción si este método tiene variantes (ej: Visa, Master para Tarjeta)
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Orden</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formMetodo.orden}
                      onChange={(e) => setFormMetodo({ ...formMetodo, orden: Number(e.target.value) })}
                      min="0"
                    />
                    <small className="text-muted">Orden de visualización (menor = primero)</small>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formMetodo.activo}
                      onChange={(e) => setFormMetodo({ ...formMetodo, activo: e.target.checked })}
                    />
                    <label className="form-check-label">Activo</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMetodoModal(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={guardarMetodo}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Submétodo */}
        {showSubmetodoModal && metodoParaSubmetodo && (
          <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {submetodoEdicion ? "Editar Submétodo" : "Nuevo Submétodo"}
                    <small className="text-muted ms-2">({metodoParaSubmetodo.nombre})</small>
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowSubmetodoModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formSubmetodo.nombre}
                      onChange={(e) => setFormSubmetodo({ ...formSubmetodo, nombre: e.target.value })}
                      placeholder="Ej: Visa, Mercado Pago"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Orden</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formSubmetodo.orden}
                      onChange={(e) => setFormSubmetodo({ ...formSubmetodo, orden: Number(e.target.value) })}
                      min="0"
                    />
                    <small className="text-muted">Orden de visualización</small>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formSubmetodo.activo}
                      onChange={(e) => setFormSubmetodo({ ...formSubmetodo, activo: e.target.checked })}
                    />
                    <label className="form-check-label">Activo</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSubmetodoModal(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={guardarSubmetodo}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  )
}
