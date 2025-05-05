"use client"

import React, { useEffect, useState } from "react"

type Cliente = {
  id: string
  nombre: string
  apellido: string
  dni: string
  direccion: string
  celular: string
  notas: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [clienteActual, setClienteActual] = useState<Cliente | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    direccion: "",
    celular: "",
    notas: "",
  })

  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (t) {
      setToken(t)
    }
  }, [])

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo clientes...");
      fetchClientes();
    }
  }, [token])

  const fetchClientes = async () => {
    try {
      const res = await fetch("http://localhost:8000/clientes/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (!res.ok) {
        console.error("Error al obtener clientes:", res.status);
        return;
      }
      
      const data = await res.json()
      console.log("Datos recibidos del servidor:", data);
      
      // Asegurarse de que cada cliente tenga un ID único
      const clientesConId = data.map((cliente: Cliente, index: number) => {
        // Si el cliente no tiene un ID, asignarle uno temporal basado en el índice
        if (!cliente.id) {
          return { ...cliente, id: `temp-id-${index}` };
        }
        return cliente;
      });
      setClientes(clientesConId)
    } catch (err) {
      console.error("Error al obtener clientes", err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoCliente = () => {
    setClienteActual(null)
    setFormData({
      nombre: "",
      apellido: "",
      dni: "",
      direccion: "",
      celular: "",
      notas: "",
    })
    setShowModal(true)
  }

  const editarCliente = (cliente: Cliente) => {
    setClienteActual(cliente)
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      direccion: cliente.direccion,
      celular: cliente.celular,
      notas: cliente.notas,
    })
    setShowModal(true)
  }

  const confirmarEliminar = (cliente: Cliente) => {
    setClienteActual(cliente)
    setShowDeleteModal(true)
  }

  const eliminarCliente = async () => {
    if (!clienteActual) return
    try {
      await fetch(`http://localhost:8000/clientes/delete/${clienteActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setClientes(clientes.filter((c) => c.id !== clienteActual.id))
      setShowDeleteModal(false)
      setClienteActual(null)
    } catch (err) {
      console.error("Error al eliminar cliente", err)
    }
  }

  const guardarCliente = async () => {
    const metodo = clienteActual ? "PUT" : "POST"
    const url = clienteActual
      ? `http://localhost:8000/clientes/update/${clienteActual.id}`
      : `http://localhost:8000/clientes/register`

    // Validar datos antes de enviar
    if (!formData.nombre || !formData.apellido || !formData.dni) {
      alert("Por favor complete los campos obligatorios: Nombre, Apellido y DNI");
      return;
    }

    // Asegurarse de que todos los campos sean strings
    const datosFormateados = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      dni: formData.dni.trim(),
      direccion: formData.direccion.trim(),
      celular: formData.celular.trim(),
      notas: formData.notas.trim(),
    }

    try {
      console.log("Enviando datos:", datosFormateados);
      
      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosFormateados),
      })

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error del servidor:", errorData);
        alert(`Error al guardar cliente: ${errorData.detail || 'Revise los datos ingresados'}`);
        return;
      }

      const nuevoCliente = await res.json();

      if (clienteActual) {
        setClientes(clientes.map((c) => (c.id === clienteActual.id ? nuevoCliente : c)))
      } else {
        setClientes([...clientes, nuevoCliente])
      }

      setShowModal(false)
      setClienteActual(null)
      fetchClientes() // Recargar los clientes después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar cliente", err)
      alert("Error al guardar cliente. Por favor, intente nuevamente.")
    }
  }

  const clientesFiltrados = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Clientes</h1>
          <p className="text-muted">Gestión de clientes de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoCliente}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Cliente
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
            placeholder="Buscar clientes..."
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
                <th>Nombre</th>
                <th>Apellido</th>
                <th>DNI</th>
                <th>Dirección</th>
                <th>Celular</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length > 0 ? (
                clientesFiltrados.map((cliente, index) => (
                  // Usar una combinación del índice y el ID para garantizar unicidad
                  <tr key={cliente.id || `cliente-${index}`}>
                    <td className="fw-medium">{cliente.nombre}</td>
                    <td>{cliente.apellido}</td>
                    <td>{cliente.dni}</td>
                    <td>{cliente.direccion}</td>
                    <td>{cliente.celular}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarCliente(cliente)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(cliente)}
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
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar cliente */}
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
              <h5 className="modal-title">{clienteActual ? "Editar Cliente" : "Nuevo Cliente"}</h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label htmlFor="nombre" className="form-label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="apellido" className="form-label">
                    Apellido
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="dni" className="form-label">
                    DNI
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="dni"
                    name="dni"
                    value={formData.dni}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="direccion" className="form-label">
                    Dirección
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="direccion"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="celular" className="form-label">
                    Celular
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="celular"
                    name="celular"
                    value={formData.celular}
                    onChange={handleChange}
                  />
                  <div className="mb-3">
                  <label htmlFor="notas" className="form-label">
                    Notas
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="notas"
                    name="notas"
                    value={formData.notas}
                    onChange={handleChange}
                  />
                </div>
                  
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarCliente}>
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
              <p>
                ¿Está seguro que desea eliminar al cliente {clienteActual?.nombre} {clienteActual?.apellido}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarCliente}>
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