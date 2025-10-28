"use client"

import React, { useEffect, useState } from "react"

type Lavanderia = {
  id: string
  nombre: string
  telefono: string
  direccion: string
}

export default function LavanderiaPage() {
  const [lavanderia, setLavanderia] = useState<Lavanderia[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [lavanderiaActual, setLavanderiaActual] = useState<Lavanderia | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
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
      console.log("Token disponible, obteniendo lavanderias...");
      fetchLavanderia();
    }
  }, [token])

  const fetchLavanderia = async () => {
    try {
      const res = await fetch("http://localhost:8000/lavanderia/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (!res.ok) {
        console.error("Error al obtener lavanderias:", res.status);
        return;
      }
      
      const data = await res.json()
      console.log("Datos recibidos del servidor:", data);
      
      // Asegurarse de que cada cliente tenga un ID único
      const lavanderiaConId = data.map((lavanderia: Lavanderia, index: number) => {
        // Si la lavenderia no tiene un ID, asignarle uno temporal basado en el índice
        if (!lavanderia.id) {
          return { ...lavanderia, id: `temp-id-${index}` };
        }
        return lavanderia;
      });
      setLavanderia(lavanderiaConId)
    } catch (err) {
      console.error("Error al obtener lavanderia.", err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoLavanderia = () => {
    setLavanderiaActual(null)
    setFormData({
      nombre: "",
      telefono: "",
      direccion: "",
    })
    setShowModal(true)
  }

  const editarLavanderia = (lavanderia: Lavanderia) => {
    setLavanderiaActual(lavanderia)
    setFormData({
      nombre: lavanderia.nombre,
      telefono: lavanderia.telefono,
      direccion: lavanderia.direccion,
    })
    setShowModal(true)
  }

  const confirmarEliminar = (lavanderia: Lavanderia) => {
    setLavanderiaActual(lavanderia)
    setShowDeleteModal(true)
  }

  const eliminarLavanderia = async () => {
    if (!lavanderiaActual) return
    try {
      await fetch(`http://localhost:8000/lavanderia/delete/${lavanderiaActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setLavanderia(lavanderia.filter((c) => c.id !== lavanderiaActual.id))
      setShowDeleteModal(false)
      setLavanderiaActual(null)
    } catch (err) {
      console.error("Error al eliminar lavanderia.", err)
    }
  }

  const guardarLavanderia = async () => {
    const metodo = lavanderiaActual ? "PUT" : "POST"
    const url = lavanderiaActual
      ? `http://localhost:8000/lavanderia/update/${lavanderiaActual.id}`
      : `http://localhost:8000/lavanderia/register`

    // Validar datos antes de enviar
    if (!formData.nombre || !formData.telefono || !formData.direccion) {
      alert("Por favor complete los campos obligatorios: Nombre, Telefono y Direccion");
      return;
    }

    // Asegurarse de que todos los campos sean strings
    const datosFormateados = {
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim(),
      direccion: formData.direccion.trim(),
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
        alert(`Error al guardar lavanderia: ${errorData.detail || 'Revise los datos ingresados'}`);
        return;
      }

      const nuevoLavanderia = await res.json();

      if (lavanderiaActual) {
        setLavanderia(lavanderia.map((c) => (c.id === lavanderiaActual.id ? nuevoLavanderia : c)))
      } else {
        setLavanderia([...lavanderia, nuevoLavanderia])
      }

      setShowModal(false)
      setLavanderiaActual(null)
      fetchLavanderia() // Recargar los lavanderias después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar lavanderia", err)
      alert("Error al guardar lavanderia. Por favor, intente nuevamente.")
    }
  }

  const lavanderiaFiltrados = lavanderia.filter((lavanderia) =>
    `${lavanderia.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Modistas</h1>
          <p className="text-muted">Gestión de lavanderias de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoLavanderia}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Lavanderia
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
            placeholder="Buscar lavanderias..."
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
                <th>Dirección</th>
                <th>Celular</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lavanderiaFiltrados.length > 0 ? (
                lavanderiaFiltrados.map((lavanderia, index) => (
                  // Usar una combinación del índice y el ID para garantizar unicidad
                  <tr key={lavanderia.id || `lavanderia-${index}`}>
                    <td className="fw-medium">{lavanderia.nombre}</td>
                    <td>{lavanderia.telefono}</td>
                    <td>{lavanderia.direccion}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarLavanderia(lavanderia)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(lavanderia)}
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
                    No se encontraron lavanderias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar lavanderias */}
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
              <h5 className="modal-title">{lavanderiaActual ? "Editar Lavanderia" : "Nuevo Lavanderia"}</h5>
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
                  <label htmlFor="telefono" className="form-label">
                    Telefono
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="direccion" className="form-label">
                    Direccion
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
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarLavanderia}>
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
                ¿Está seguro que desea eliminar al cliente {lavanderiaActual?.nombre}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarLavanderia}>
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