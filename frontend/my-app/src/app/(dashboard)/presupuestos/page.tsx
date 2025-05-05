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

type Producto = {
  id: string
  nombre: string
  precio: number
}

type ItemPresupuesto = {
  id: string
  productoId: string
  productoNombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

type Presupuesto = {
  id: string
  numero: string
  fecha: Date
  clienteId: string
  clienteNombre: string
  items: ItemPresupuesto[]
  total: number
  estado: "pendiente" | "aprobado" | "rechazado" | "vencido"
  observaciones: string
}

// Datos de ejemplo
const clientesEjemplo: Cliente[] = [
  { id: "1", nombre: "Juan Pérez" },
  { id: "2", nombre: "María López" },
  { id: "3", nombre: "Carlos Rodríguez" },
]

const productosEjemplo: Producto[] = [
  { id: "1", nombre: "Traje Slim Fit", precio: 120000 },
  { id: "2", nombre: "Camisa Formal", precio: 35000 },
  { id: "3", nombre: "Corbata Seda", precio: 15000 },
  { id: "4", nombre: "Pantalón Vestir", precio: 45000 },
]

const presupuestosEjemplo: Presupuesto[] = [
  {
    id: "1",
    numero: "PRES-001",
    fecha: new Date(2023, 2, 15),
    clienteId: "1",
    clienteNombre: "Juan Pérez",
    items: [
      {
        id: "1",
        productoId: "1",
        productoNombre: "Traje Slim Fit",
        cantidad: 1,
        precioUnitario: 120000,
        subtotal: 120000,
      },
      {
        id: "2",
        productoId: "2",
        productoNombre: "Camisa Formal",
        cantidad: 2,
        precioUnitario: 35000,
        subtotal: 70000,
      },
    ],
    total: 190000,
    estado: "aprobado",
    observaciones: "Cliente frecuente, aplicar 10% de descuento en próxima compra",
  },
  {
    id: "2",
    numero: "PRES-002",
    fecha: new Date(2023, 3, 20),
    clienteId: "2",
    clienteNombre: "María López",
    items: [
      {
        id: "1",
        productoId: "4",
        productoNombre: "Pantalón Vestir",
        cantidad: 1,
        precioUnitario: 45000,
        subtotal: 45000,
      },
      { id: "2", productoId: "3", productoNombre: "Corbata Seda", cantidad: 1, precioUnitario: 15000, subtotal: 15000 },
    ],
    total: 60000,
    estado: "pendiente",
    observaciones: "",
  },
]

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(presupuestosEjemplo)
  const [busqueda, setBusqueda] = useState("")
  const [presupuestoActual, setPresupuestoActual] = useState<Presupuesto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)

  // Estado para el formulario
  const [formData, setFormData] = useState({
    clienteId: "",
    observaciones: "",
  })

  // Estado para los items del presupuesto
  const [items, setItems] = useState<ItemPresupuesto[]>([])
  const [nuevoItem, setNuevoItem] = useState({
    productoId: "",
    cantidad: 1,
  })

  // Filtrar presupuestos por búsqueda
  const presupuestosFiltrados = presupuestos.filter(
    (presupuesto) =>
      presupuesto.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      presupuesto.clienteNombre.toLowerCase().includes(busqueda.toLowerCase()),
  )

  // Manejar cambios en el formulario principal
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Manejar cambio de cliente en el select
  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, clienteId: e.target.value }))
  }

  // Manejar cambios en el nuevo item
  const handleItemChange = (name: string, value: string | number) => {
    setNuevoItem((prev) => ({ ...prev, [name]: value }))
  }

  // Agregar nuevo item al presupuesto
  const agregarItem = () => {
    const producto = productosEjemplo.find((p) => p.id === nuevoItem.productoId)
    if (!producto) return

    const precioUnitario = producto.precio
    const subtotal = precioUnitario * nuevoItem.cantidad

    const newItem: ItemPresupuesto = {
      id: Date.now().toString(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidad: nuevoItem.cantidad,
      precioUnitario,
      subtotal,
    }

    setItems([...items, newItem])
    setNuevoItem({
      productoId: "",
      cantidad: 1,
    })
  }

  // Eliminar item del presupuesto
  const eliminarItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  // Calcular total del presupuesto
  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0)
  }

  // Abrir formulario para nuevo presupuesto
  const nuevoPresupuesto = () => {
    setPresupuestoActual(null)
    setFormData({
      clienteId: "",
      observaciones: "",
    })
    setItems([])
    setShowModal(true)
  }

  // Abrir formulario para editar presupuesto
  const editarPresupuesto = (presupuesto: Presupuesto) => {
    setPresupuestoActual(presupuesto)
    setFormData({
      clienteId: presupuesto.clienteId,
      observaciones: presupuesto.observaciones,
    })
    setItems(presupuesto.items)
    setShowModal(true)
  }

  // Ver detalles del presupuesto
  const verPresupuesto = (presupuesto: Presupuesto) => {
    setPresupuestoActual(presupuesto)
    setShowViewModal(true)
  }

  // Confirmar eliminación de presupuesto
  const confirmarEliminar = (presupuesto: Presupuesto) => {
    setPresupuestoActual(presupuesto)
    setShowDeleteModal(true)
  }

  // Eliminar presupuesto
  const eliminarPresupuesto = () => {
    if (presupuestoActual) {
      setPresupuestos(presupuestos.filter((p) => p.id !== presupuestoActual.id))
      setShowDeleteModal(false)
    }
  }

  // Guardar presupuesto (nuevo o editado)
  const guardarPresupuesto = () => {
    if (!formData.clienteId || items.length === 0) {
      alert("Debe seleccionar un cliente y agregar al menos un producto")
      return
    }

    const cliente = clientesEjemplo.find((c) => c.id === formData.clienteId)
    if (!cliente) return

    const total = calcularTotal()

    if (presupuestoActual) {
      // Editar presupuesto existente
      setPresupuestos(
        presupuestos.map((p) =>
          p.id === presupuestoActual.id
            ? {
                ...p,
                clienteId: formData.clienteId,
                clienteNombre: cliente.nombre,
                items: [...items],
                total,
                observaciones: formData.observaciones,
              }
            : p,
        ),
      )
    } else {
      // Crear nuevo presupuesto
      const nuevoId = (Math.max(...presupuestos.map((p) => Number.parseInt(p.id))) + 1).toString()
      const nuevoNumero = `PRES-${nuevoId.padStart(3, "0")}`

      setPresupuestos([
        ...presupuestos,
        {
          id: nuevoId,
          numero: nuevoNumero,
          fecha: new Date(),
          clienteId: formData.clienteId,
          clienteNombre: cliente.nombre,
          items: [...items],
          total,
          estado: "pendiente",
          observaciones: formData.observaciones,
        },
      ])
    }

    setShowModal(false)
  }

  // Obtener clase de badge según estado
  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case "aprobado":
        return "bg-success"
      case "rechazado":
        return "bg-danger"
      case "vencido":
        return "bg-secondary"
      default:
        return "bg-warning"
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Presupuestos</h1>
          <p className="text-muted">Gestión de presupuestos para clientes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoPresupuesto}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Presupuesto
        </button>
      </div>

      <div className="mb-4">
        <div className="input-group">
          <span className="input-group-text">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Buscar presupuestos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {presupuestosFiltrados.length > 0 ? (
                presupuestosFiltrados.map((presupuesto) => (
                  <tr key={presupuesto.id}>
                    <td className="fw-medium">{presupuesto.numero}</td>
                    <td>{format(presupuesto.fecha, "dd/MM/yyyy", { locale: es })}</td>
                    <td>{presupuesto.clienteNombre}</td>
                    <td>${presupuesto.total.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${getEstadoClass(presupuesto.estado)}`}>
                        {presupuesto.estado.charAt(0).toUpperCase() + presupuesto.estado.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => verPresupuesto(presupuesto)}
                          title="Ver detalles"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarPresupuesto(presupuesto)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" title="Descargar PDF">
                          <i className="bi bi-download"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(presupuesto)}
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
                  <td colSpan={6} className="text-center">
                    No se encontraron presupuestos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar presupuesto */}
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
              <h5 className="modal-title">{presupuestoActual ? "Editar Presupuesto" : "Nuevo Presupuesto"}</h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label htmlFor="cliente" className="form-label">
                    Cliente
                  </label>
                  <select
                    className="form-select"
                    id="cliente"
                    value={formData.clienteId}
                    onChange={handleClienteChange}
                  >
                    <option value="">Seleccione un cliente</option>
                    {clientesEjemplo.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="card mb-3">
                  <div className="card-header">
                    <h5 className="mb-0">Productos</h5>
                  </div>
                  <div className="card-body">
                    <div className="row mb-3">
                      <div className="col-md-5">
                        <label htmlFor="producto" className="form-label">
                          Producto
                        </label>
                        <select
                          className="form-select"
                          id="producto"
                          value={nuevoItem.productoId}
                          onChange={(e) => handleItemChange("productoId", e.target.value)}
                        >
                          <option value="">Seleccione un producto</option>
                          {productosEjemplo.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                              {producto.nombre} - ${producto.precio.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label htmlFor="cantidad" className="form-label">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          id="cantidad"
                          min="1"
                          value={nuevoItem.cantidad}
                          onChange={(e) => handleItemChange("cantidad", Number.parseInt(e.target.value))}
                        />
                      </div>
                      <div className="col-md-4 d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={agregarItem}
                          disabled={!nuevoItem.productoId || nuevoItem.cantidad < 1}
                        >
                          Agregar Producto
                        </button>
                      </div>
                    </div>

                    {items.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-bordered">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th>Precio Unit.</th>
                              <th>Subtotal</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id}>
                                <td>{item.productoNombre}</td>
                                <td>{item.cantidad}</td>
                                <td>${item.precioUnitario.toLocaleString()}</td>
                                <td>${item.subtotal.toLocaleString()}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => eliminarItem(item.id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={3} className="text-end fw-bold">
                                Total:
                              </td>
                              <td className="fw-bold">${calcularTotal().toLocaleString()}</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted">No hay productos agregados</div>
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
              <button type="button" className="btn btn-primary" onClick={guardarPresupuesto}>
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

      {/* Modal para ver detalles del presupuesto */}
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
                Presupuesto {presupuestoActual?.numero}
                {presupuestoActual && (
                  <span className={`badge ms-2 ${getEstadoClass(presupuestoActual.estado)}`}>
                    {presupuestoActual.estado.charAt(0).toUpperCase() + presupuestoActual.estado.slice(1)}
                  </span>
                )}
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowViewModal(false)}></button>
            </div>
            <div className="modal-body">
              {presupuestoActual && (
                <>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Fecha:</span>
                            <span>{format(presupuestoActual.fecha, "dd/MM/yyyy", { locale: es })}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Cliente:</span>
                            <span>{presupuestoActual.clienteNombre}</span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Total:</span>
                            <span className="fw-bold">${presupuestoActual.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <h6 className="fw-bold mb-2">Observaciones</h6>
                          <p className="text-muted small">{presupuestoActual.observaciones || "Sin observaciones"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Precio Unit.</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {presupuestoActual.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.productoNombre}</td>
                            <td>{item.cantidad}</td>
                            <td>${item.precioUnitario.toLocaleString()}</td>
                            <td>${item.subtotal.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} className="text-end fw-bold">
                            Total:
                          </td>
                          <td className="fw-bold">${presupuestoActual.total.toLocaleString()}</td>
                        </tr>
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
                ¿Está seguro que desea eliminar el presupuesto {presupuestoActual?.numero}? Esta acción no se puede
                deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarPresupuesto}>
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

