"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Tipos
type Cliente = {
  id: string
  nombre: string
}

type Presupuesto = {
  id: string
  numero: string
  clienteId: string
  clienteNombre: string
  total: number
}

type Tarea = {
  id: string
  descripcion: string
  estado: "pendiente" | "en_progreso" | "completada"
  responsable: string
}

type OrdenTrabajo = {
  id: string
  numero: string
  fecha: Date
  fechaEntrega: Date | null
  clienteId: string
  clienteNombre: string
  presupuestoId: string | null
  presupuestoNumero: string | null
  estado: "pendiente" | "en_progreso" | "completada" | "entregada" | "cancelada"
  tareas: Tarea[]
  total: number
  observaciones: string
  prioridad: "baja" | "media" | "alta"
}

// Datos de ejemplo
const clientesEjemplo: Cliente[] = [
  { id: "1", nombre: "Juan Pérez" },
  { id: "2", nombre: "María López" },
  { id: "3", nombre: "Carlos Rodríguez" },
]

const presupuestosEjemplo: Presupuesto[] = [
  { id: "1", numero: "PRES-001", clienteId: "1", clienteNombre: "Juan Pérez", total: 190000 },
  { id: "2", numero: "PRES-002", clienteId: "2", clienteNombre: "María López", total: 60000 },
]

const ordenesEjemplo: OrdenTrabajo[] = [
  {
    id: "1",
    numero: "OT-001",
    fecha: new Date(2023, 2, 20),
    fechaEntrega: new Date(2023, 3, 5),
    clienteId: "1",
    clienteNombre: "Juan Pérez",
    presupuestoId: "1",
    presupuestoNumero: "PRES-001",
    estado: "en_progreso",
    tareas: [
      { id: "1", descripcion: "Tomar medidas", estado: "completada", responsable: "Ana Sastre" },
      { id: "2", descripcion: "Corte de tela", estado: "completada", responsable: "Pedro Cortador" },
      { id: "3", descripcion: "Confección", estado: "en_progreso", responsable: "Luis Costurero" },
      { id: "4", descripcion: "Prueba final", estado: "pendiente", responsable: "Ana Sastre" },
    ],
    total: 190000,
    observaciones: "Cliente solicita entrega urgente",
    prioridad: "alta",
  },
  {
    id: "2",
    numero: "OT-002",
    fecha: new Date(2023, 3, 25),
    fechaEntrega: new Date(2023, 4, 15),
    clienteId: "2",
    clienteNombre: "María López",
    presupuestoId: "2",
    presupuestoNumero: "PRES-002",
    estado: "pendiente",
    tareas: [{ id: "1", descripcion: "Tomar medidas", estado: "pendiente", responsable: "Ana Sastre" }],
    total: 60000,
    observaciones: "",
    prioridad: "media",
  },
]

export default function OrdenesTrabajoPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>(ordenesEjemplo)
  const [busqueda, setBusqueda] = useState("")
  const [ordenActual, setOrdenActual] = useState<OrdenTrabajo | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [tabActiva, setTabActiva] = useState("todas")

  // Estado para el formulario
  const [formData, setFormData] = useState({
    clienteId: "",
    presupuestoId: "",
    fechaEntrega: "",
    prioridad: "media",
    observaciones: "",
  })

  // Estado para las tareas
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [nuevaTarea, setNuevaTarea] = useState({
    descripcion: "",
    responsable: "",
  })

  // Filtrar órdenes por búsqueda y tab activa
  const ordenesFiltradas = ordenes.filter((orden) => {
    const coincideBusqueda =
      orden.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      orden.clienteNombre.toLowerCase().includes(busqueda.toLowerCase())

    if (tabActiva === "todas") return coincideBusqueda
    return coincideBusqueda && orden.estado === tabActiva
  })

  // Manejar cambios en el formulario principal
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Manejar cambio de select
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Manejar cambios en la nueva tarea
  const handleTareaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNuevaTarea((prev) => ({ ...prev, [name]: value }))
  }

  // Agregar nueva tarea
  const agregarTarea = () => {
    if (!nuevaTarea.descripcion || !nuevaTarea.responsable) return

    const newTarea: Tarea = {
      id: Date.now().toString(),
      descripcion: nuevaTarea.descripcion,
      responsable: nuevaTarea.responsable,
      estado: "pendiente",
    }

    setTareas([...tareas, newTarea])
    setNuevaTarea({
      descripcion: "",
      responsable: "",
    })
  }

  // Eliminar tarea
  const eliminarTarea = (id: string) => {
    setTareas(tareas.filter((tarea) => tarea.id !== id))
  }

  // Cambiar estado de tarea
  const cambiarEstadoTarea = (id: string, estado: "pendiente" | "en_progreso" | "completada") => {
    setTareas(tareas.map((tarea) => (tarea.id === id ? { ...tarea, estado } : tarea)))
  }

  // Abrir formulario para nueva orden
  const nuevaOrden = () => {
    setOrdenActual(null)
    setFormData({
      clienteId: "",
      presupuestoId: "",
      fechaEntrega: "",
      prioridad: "media",
      observaciones: "",
    })
    setTareas([])
    setShowModal(true)
  }

  // Abrir formulario para editar orden
  const editarOrden = (orden: OrdenTrabajo) => {
    setOrdenActual(orden)
    setFormData({
      clienteId: orden.clienteId,
      presupuestoId: orden.presupuestoId || "",
      fechaEntrega: orden.fechaEntrega ? format(orden.fechaEntrega, "yyyy-MM-dd") : "",
      prioridad: orden.prioridad,
      observaciones: orden.observaciones,
    })
    setTareas(orden.tareas)
    setShowModal(true)
  }

  // Ver detalles de la orden
  const verOrden = (orden: OrdenTrabajo) => {
    setOrdenActual(orden)
    setShowViewModal(true)
  }

  // Confirmar eliminación de orden
  const confirmarEliminar = (orden: OrdenTrabajo) => {
    setOrdenActual(orden)
    setShowDeleteModal(true)
  }

  // Eliminar orden
  const eliminarOrden = () => {
    if (ordenActual) {
      setOrdenes(ordenes.filter((o) => o.id !== ordenActual.id))
      setShowDeleteModal(false)
    }
  }

  // Guardar orden (nueva o editada)
  const guardarOrden = () => {
    if (!formData.clienteId || tareas.length === 0) {
      alert("Debe seleccionar un cliente y agregar al menos una tarea")
      return
    }

    const cliente = clientesEjemplo.find((c) => c.id === formData.clienteId)
    if (!cliente) return

    let presupuesto = null
    if (formData.presupuestoId) {
      presupuesto = presupuestosEjemplo.find((p) => p.id === formData.presupuestoId)
    }

    if (ordenActual) {
      // Editar orden existente
      setOrdenes(
        ordenes.map((o) =>
          o.id === ordenActual.id
            ? {
                ...o,
                clienteId: formData.clienteId,
                clienteNombre: cliente.nombre,
                presupuestoId: formData.presupuestoId || null,
                presupuestoNumero: presupuesto ? presupuesto.numero : null,
                fechaEntrega: formData.fechaEntrega ? new Date(formData.fechaEntrega) : null,
                tareas: [...tareas],
                total: presupuesto ? presupuesto.total : o.total,
                observaciones: formData.observaciones,
                prioridad: formData.prioridad as "baja" | "media" | "alta",
              }
            : o,
        ),
      )
    } else {
      // Crear nueva orden
      const nuevoId = (Math.max(...ordenes.map((o) => Number.parseInt(o.id))) + 1).toString()
      const nuevoNumero = `OT-${nuevoId.padStart(3, "0")}`

      setOrdenes([
        ...ordenes,
        {
          id: nuevoId,
          numero: nuevoNumero,
          fecha: new Date(),
          fechaEntrega: formData.fechaEntrega ? new Date(formData.fechaEntrega) : null,
          clienteId: formData.clienteId,
          clienteNombre: cliente.nombre,
          presupuestoId: formData.presupuestoId || null,
          presupuestoNumero: presupuesto ? presupuesto.numero : null,
          estado: "pendiente",
          tareas: [...tareas],
          total: presupuesto ? presupuesto.total : 0,
          observaciones: formData.observaciones,
          prioridad: formData.prioridad as "baja" | "media" | "alta",
        },
      ])
    }

    setShowModal(false)
  }

  // Obtener clase de badge según estado
  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case "completada":
        return "bg-success"
      case "en_progreso":
        return "bg-primary"
      case "entregada":
        return "bg-info"
      case "cancelada":
        return "bg-danger"
      default:
        return "bg-warning"
    }
  }

  // Obtener clase de badge según prioridad
  const getPrioridadClass = (prioridad: string) => {
    switch (prioridad) {
      case "alta":
        return "bg-danger"
      case "media":
        return "bg-warning"
      case "baja":
        return "bg-success"
      default:
        return "bg-secondary"
    }
  }

  // Formatear estado para mostrar
  const formatearEstado = (estado: string) => {
    switch (estado) {
      case "en_progreso":
        return "En progreso"
      default:
        return estado.charAt(0).toUpperCase() + estado.slice(1)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Órdenes de Trabajo</h1>
          <p className="text-muted">Gestión de órdenes de trabajo y seguimiento de tareas</p>
        </div>
        <button className="btn btn-primary" onClick={nuevaOrden}>
          <i className="bi bi-plus me-2"></i>
          Nueva Orden
        </button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="input-group" style={{ maxWidth: "300px" }}>
          <span className="input-group-text">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Buscar órdenes..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <ul className="nav nav-pills">
          <li className="nav-item">
            <button
              className={`nav-link ${tabActiva === "todas" ? "active" : ""}`}
              onClick={() => setTabActiva("todas")}
            >
              Todas
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tabActiva === "pendiente" ? "active" : ""}`}
              onClick={() => setTabActiva("pendiente")}
            >
              Pendientes
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tabActiva === "en_progreso" ? "active" : ""}`}
              onClick={() => setTabActiva("en_progreso")}
            >
              En Progreso
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tabActiva === "completada" ? "active" : ""}`}
              onClick={() => setTabActiva("completada")}
            >
              Completadas
            </button>
          </li>
        </ul>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Fecha Entrega</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length > 0 ? (
                ordenesFiltradas.map((orden) => (
                  <tr key={orden.id}>
                    <td className="fw-medium">{orden.numero}</td>
                    <td>{format(orden.fecha, "dd/MM/yyyy", { locale: es })}</td>
                    <td>{orden.clienteNombre}</td>
                    <td>
                      {orden.fechaEntrega ? format(orden.fechaEntrega, "dd/MM/yyyy", { locale: es }) : "No definida"}
                    </td>
                    <td>
                      <span className={`badge ${getEstadoClass(orden.estado)}`}>{formatearEstado(orden.estado)}</span>
                    </td>
                    <td>
                      <span className={`badge ${getPrioridadClass(orden.prioridad)}`}>
                        {orden.prioridad.charAt(0).toUpperCase() + orden.prioridad.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => verOrden(orden)}
                          title="Ver detalles"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarOrden(orden)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" title="Descargar PDF">
                          <i className="bi bi-download"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(orden)}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center">
                    No se encontraron órdenes de trabajo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar orden */}
      <div
        className={`modal fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{ordenActual ? "Editar Orden de Trabajo" : "Nueva Orden de Trabajo"}</h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="row mb-4">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="cliente" className="form-label">
                      Cliente
                    </label>
                    <select
                      className="form-select"
                      id="cliente"
                      name="clienteId"
                      value={formData.clienteId}
                      onChange={handleSelectChange}
                    >
                      <option value="">Seleccione un cliente</option>
                      {clientesEjemplo.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="presupuesto" className="form-label">
                      Presupuesto (opcional)
                    </label>
                    <select
                      className="form-select"
                      id="presupuesto"
                      name="presupuestoId"
                      value={formData.presupuestoId}
                      onChange={handleSelectChange}
                    >
                      <option value="">Sin presupuesto</option>
                      {presupuestosEjemplo
                        .filter((p) => !formData.clienteId || p.clienteId === formData.clienteId)
                        .map((presupuesto) => (
                          <option key={presupuesto.id} value={presupuesto.id}>
                            {presupuesto.numero} - ${presupuesto.total.toLocaleString()}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="fechaEntrega" className="form-label">
                      Fecha de Entrega (opcional)
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="fechaEntrega"
                      name="fechaEntrega"
                      value={formData.fechaEntrega}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="prioridad" className="form-label">
                      Prioridad
                    </label>
                    <select
                      className="form-select"
                      id="prioridad"
                      name="prioridad"
                      value={formData.prioridad}
                      onChange={handleSelectChange}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div className="card mb-4">
                  <div className="card-header">
                    <h5 className="mb-0">Tareas</h5>
                  </div>
                  <div className="card-body">
                    <div className="row mb-3">
                      <div className="col-md-5 mb-3 mb-md-0">
                        <label htmlFor="descripcion" className="form-label">
                          Descripción
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="descripcion"
                          name="descripcion"
                          value={nuevaTarea.descripcion}
                          onChange={handleTareaChange}
                        />
                      </div>
                      <div className="col-md-5 mb-3 mb-md-0">
                        <label htmlFor="responsable" className="form-label">
                          Responsable
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="responsable"
                          name="responsable"
                          value={nuevaTarea.responsable}
                          onChange={handleTareaChange}
                        />
                      </div>
                      <div className="col-md-2 d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={agregarTarea}
                          disabled={!nuevaTarea.descripcion || !nuevaTarea.responsable}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>

                    {tareas.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-bordered">
                          <thead>
                            <tr>
                              <th>Descripción</th>
                              <th>Responsable</th>
                              <th>Estado</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tareas.map((tarea) => (
                              <tr key={tarea.id}>
                                <td>{tarea.descripcion}</td>
                                <td>{tarea.responsable}</td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={tarea.estado}
                                    onChange={(e) => cambiarEstadoTarea(tarea.id, e.target.value as any)}
                                  >
                                    <option value="pendiente">Pendiente</option>
                                    <option value="en_progreso">En progreso</option>
                                    <option value="completada">Completada</option>
                                  </select>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => eliminarTarea(tarea.id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted">No hay tareas agregadas</div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="observaciones" className="form-label">
                    Observaciones
                  </label>
                  <textarea
                    className="form-control"
                    id="observaciones"
                    name="observaciones"
                    rows={3}
                    value={formData.observaciones}
                    onChange={handleChange}
                  ></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarOrden}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
      ></div>

      {/* Modal para ver detalles de la orden */}
      <div
        className={`modal fade ${showViewModal ? "show" : ""}`}
        style={{ display: showViewModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center">
                Orden de Trabajo {ordenActual?.numero}
                {ordenActual && (
                  <span className={`badge ms-2 ${getEstadoClass(ordenActual.estado)}`}>
                    {formatearEstado(ordenActual.estado)}
                  </span>
                )}
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowViewModal(false)}></button>
            </div>
            <div className="modal-body">
              {ordenActual && (
                <>
                  <div className="row mb-4">
                    <div className="col-md-6 mb-3 mb-md-0">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Fecha:</span>
                            <span>{format(ordenActual.fecha, "dd/MM/yyyy", { locale: es })}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Cliente:</span>
                            <span>{ordenActual.clienteNombre}</span>
                          </div>
                          {ordenActual.presupuestoNumero && (
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted">Presupuesto:</span>
                              <span>{ordenActual.presupuestoNumero}</span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Total:</span>
                            <span className="fw-bold">${ordenActual.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Fecha de Entrega:</span>
                            <span>
                              {ordenActual.fechaEntrega
                                ? format(ordenActual.fechaEntrega, "dd/MM/yyyy", { locale: es })
                                : "No definida"}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Prioridad:</span>
                            <span className={`badge ${getPrioridadClass(ordenActual.prioridad)}`}>
                              {ordenActual.prioridad.charAt(0).toUpperCase() + ordenActual.prioridad.slice(1)}
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="text-muted">Observaciones:</span>
                            <p className="small mt-1">{ordenActual.observaciones || "Sin observaciones"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h5 className="mb-3">Tareas</h5>
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th>Responsable</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenActual.tareas.map((tarea) => (
                          <tr key={tarea.id}>
                            <td>{tarea.descripcion}</td>
                            <td>{tarea.responsable}</td>
                            <td>
                              <span className={`badge ${getEstadoClass(tarea.estado)}`}>
                                {formatearEstado(tarea.estado)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Cerrar
              </button>
              <button type="button" className="btn btn-primary">
                <i className="bi bi-download me-2"></i>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${showViewModal ? "show" : ""}`}
        style={{ display: showViewModal ? "block" : "none" }}
      ></div>

      {/* Modal para confirmar eliminación */}
      <div
        className={`modal fade ${showDeleteModal ? "show" : ""}`}
        style={{ display: showDeleteModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirmar eliminación</h5>
              <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
            </div>
            <div className="modal-body">
              <p>
                ¿Está seguro que desea eliminar la orden de trabajo {ordenActual?.numero}? Esta acción no se puede
                deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarOrden}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${showDeleteModal ? "show" : ""}`}
        style={{ display: showDeleteModal ? "block" : "none" }}
      ></div>
    </div>
  )
}

