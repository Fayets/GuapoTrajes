"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"

// Tipos
type Movimiento = {
  id: string
  fecha: Date
  tipo: "ingreso" | "egreso"
  concepto: string
  categoria: string
  monto: number
  observaciones: string
  referencia: string | null
}

// Categorías de movimientos
const categorias = {
  ingreso: ["Venta", "Anticipo", "Otro ingreso"],
  egreso: ["Compra de materiales", "Pago a proveedores", "Servicios", "Salarios", "Impuestos", "Otro egreso"],
}

// Datos de ejemplo
const movimientosEjemplo: Movimiento[] = [
  {
    id: "1",
    fecha: new Date(2023, 3, 15, 10, 30),
    tipo: "ingreso",
    concepto: "Venta de traje",
    categoria: "Venta",
    monto: 120000,
    observaciones: "Cliente Juan Pérez",
    referencia: "FAC-001",
  },
  {
    id: "2",
    fecha: new Date(2023, 3, 15, 12, 45),
    tipo: "ingreso",
    concepto: "Anticipo por confección",
    categoria: "Anticipo",
    monto: 50000,
    observaciones: "Cliente María López",
    referencia: "ANT-001",
  },
  {
    id: "3",
    fecha: new Date(2023, 3, 15, 14, 20),
    tipo: "egreso",
    concepto: "Compra de telas",
    categoria: "Compra de materiales",
    monto: 80000,
    observaciones: "Proveedor Textiles SA",
    referencia: "OC-001",
  },
  {
    id: "4",
    fecha: new Date(2023, 3, 15, 16, 10),
    tipo: "egreso",
    concepto: "Pago de luz",
    categoria: "Servicios",
    monto: 25000,
    observaciones: "",
    referencia: null,
  },
]

export default function CajaDiariaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosEjemplo)
  const [busqueda, setBusqueda] = useState("")
  const [movimientoActual, setMovimientoActual] = useState<Movimiento | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [tabActiva, setTabActiva] = useState("todos")
  const [fechaSeleccionada, setFechaSeleccionada] = useState(format(new Date(), "yyyy-MM-dd"))

  // Estado para el formulario
  const [formData, setFormData] = useState({
    tipo: "ingreso",
    concepto: "",
    categoria: "",
    monto: "",
    observaciones: "",
    referencia: "",
  })

  // Filtrar movimientos por búsqueda, tab activa y fecha
  const movimientosFiltrados = movimientos.filter((movimiento) => {
    const coincideBusqueda =
      movimiento.concepto.toLowerCase().includes(busqueda.toLowerCase()) ||
      movimiento.categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
      (movimiento.referencia && movimiento.referencia.toLowerCase().includes(busqueda.toLowerCase()))

    const coincideTipo = tabActiva === "todos" || movimiento.tipo === tabActiva

    const fechaMovimiento = format(movimiento.fecha, "yyyy-MM-dd")
    const coincideFecha = fechaMovimiento === fechaSeleccionada

    return coincideBusqueda && coincideTipo && coincideFecha
  })

  // Calcular totales
  const calcularTotales = () => {
    const totalIngresos = movimientosFiltrados.filter((m) => m.tipo === "ingreso").reduce((sum, m) => sum + m.monto, 0)

    const totalEgresos = movimientosFiltrados.filter((m) => m.tipo === "egreso").reduce((sum, m) => sum + m.monto, 0)

    const saldo = totalIngresos - totalEgresos

    return { totalIngresos, totalEgresos, saldo }
  }

  const { totalIngresos, totalEgresos, saldo } = calcularTotales()

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Manejar cambio de select
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === "tipo") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        categoria: "", // Resetear categoría al cambiar el tipo
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  // Abrir formulario para nuevo movimiento
  const nuevoMovimiento = (tipo: "ingreso" | "egreso") => {
    setMovimientoActual(null)
    setFormData({
      tipo,
      concepto: "",
      categoria: "",
      monto: "",
      observaciones: "",
      referencia: "",
    })
    setShowModal(true)
  }

  // Abrir formulario para editar movimiento
  const editarMovimiento = (movimiento: Movimiento) => {
    setMovimientoActual(movimiento)
    setFormData({
      tipo: movimiento.tipo,
      concepto: movimiento.concepto,
      categoria: movimiento.categoria,
      monto: movimiento.monto.toString(),
      observaciones: movimiento.observaciones,
      referencia: movimiento.referencia || "",
    })
    setShowModal(true)
  }

  // Confirmar eliminación de movimiento
  const confirmarEliminar = (movimiento: Movimiento) => {
    setMovimientoActual(movimiento)
    setShowDeleteModal(true)
  }

  // Eliminar movimiento
  const eliminarMovimiento = () => {
    if (movimientoActual) {
      setMovimientos(movimientos.filter((m) => m.id !== movimientoActual.id))
      setShowDeleteModal(false)
    }
  }

  // Guardar movimiento (nuevo o editado)
  const guardarMovimiento = () => {
    if (!formData.concepto || !formData.categoria || !formData.monto) {
      alert("Los campos concepto, categoría y monto son obligatorios")
      return
    }

    const monto = Number.parseFloat(formData.monto)
    if (isNaN(monto) || monto <= 0) {
      alert("El monto debe ser un número positivo")
      return
    }

    if (movimientoActual) {
      // Editar movimiento existente
      setMovimientos(
        movimientos.map((m) =>
          m.id === movimientoActual.id
            ? {
                ...m,
                tipo: formData.tipo as "ingreso" | "egreso",
                concepto: formData.concepto,
                categoria: formData.categoria,
                monto,
                observaciones: formData.observaciones,
                referencia: formData.referencia || null,
              }
            : m,
        ),
      )
    } else {
      // Crear nuevo movimiento
      const nuevoId = (Math.max(...movimientos.map((m) => Number.parseInt(m.id))) + 1).toString()

      setMovimientos([
        ...movimientos,
        {
          id: nuevoId,
          fecha: new Date(),
          tipo: formData.tipo as "ingreso" | "egreso",
          concepto: formData.concepto,
          categoria: formData.categoria,
          monto,
          observaciones: formData.observaciones,
          referencia: formData.referencia || null,
        },
      ])
    }

    setShowModal(false)
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Caja Diaria</h1>
          <p className="text-muted">Control de ingresos y egresos diarios</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={() => nuevoMovimiento("ingreso")}>
            <i className="bi bi-arrow-up-right me-2"></i>
            Nuevo Ingreso
          </button>
          <button className="btn btn-outline-danger" onClick={() => nuevoMovimiento("egreso")}>
            <i className="bi bi-arrow-down-left me-2"></i>
            Nuevo Egreso
          </button>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Ingresos</h6>
              <h4 className="card-title text-success">${totalIngresos.toLocaleString()}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Egresos</h6>
              <h4 className="card-title text-danger">${totalEgresos.toLocaleString()}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Saldo</h6>
              <h4 className={`card-title ${saldo >= 0 ? "text-success" : "text-danger"}`}>${saldo.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="input-group" style={{ maxWidth: "300px" }}>
          <span className="input-group-text">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Buscar movimientos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center">
            <i className="bi bi-calendar me-2"></i>
            <input
              type="date"
              className="form-control"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
            />
          </div>

          <ul className="nav nav-pills">
            <li className="nav-item">
              <button
                className={`nav-link ${tabActiva === "todos" ? "active" : ""}`}
                onClick={() => setTabActiva("todos")}
              >
                Todos
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${tabActiva === "ingreso" ? "active" : ""}`}
                onClick={() => setTabActiva("ingreso")}
              >
                Ingresos
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${tabActiva === "egreso" ? "active" : ""}`}
                onClick={() => setTabActiva("egreso")}
              >
                Egresos
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Referencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.length > 0 ? (
                movimientosFiltrados.map((movimiento) => (
                  <tr key={movimiento.id}>
                    <td>{format(movimiento.fecha, "HH:mm")}</td>
                    <td>
                      <span className={`badge ${movimiento.tipo === "ingreso" ? "bg-success" : "bg-danger"}`}>
                        {movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td className="fw-medium">{movimiento.concepto}</td>
                    <td>{movimiento.categoria}</td>
                    <td className={movimiento.tipo === "ingreso" ? "text-success" : "text-danger"}>
                      ${movimiento.monto.toLocaleString()}
                    </td>
                    <td>{movimiento.referencia || "-"}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarMovimiento(movimiento)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(movimiento)}
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
                    No se encontraron movimientos para la fecha seleccionada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar movimiento */}
      <div
        className={`modal fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {movimientoActual
                  ? `Editar ${movimientoActual.tipo === "ingreso" ? "Ingreso" : "Egreso"}`
                  : `Nuevo ${formData.tipo === "ingreso" ? "Ingreso" : "Egreso"}`}
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label htmlFor="tipo" className="form-label">
                    Tipo
                  </label>
                  <select
                    className="form-select"
                    id="tipo"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleSelectChange}
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="concepto" className="form-label">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="concepto"
                    name="concepto"
                    value={formData.concepto}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="categoria" className="form-label">
                    Categoría *
                  </label>
                  <select
                    className="form-select"
                    id="categoria"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleSelectChange}
                    required
                  >
                    <option value="">Seleccione categoría</option>
                    {formData.tipo === "ingreso"
                      ? categorias.ingreso.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))
                      : categorias.egreso.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="monto" className="form-label">
                    Monto *
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      id="monto"
                      name="monto"
                      min="0"
                      step="0.01"
                      value={formData.monto}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="referencia" className="form-label">
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="referencia"
                    name="referencia"
                    value={formData.referencia}
                    onChange={handleChange}
                    placeholder="Ej: Factura, Recibo, etc."
                  />
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
              <button type="button" className="btn btn-primary" onClick={guardarMovimiento}>
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
              <p>¿Está seguro que desea eliminar este movimiento? Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarMovimiento}>
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

