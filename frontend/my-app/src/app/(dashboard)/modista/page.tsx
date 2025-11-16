"use client"

import React, { useEffect, useState } from "react"
<<<<<<< HEAD
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

type Modista = {
  id: string
  nombre: string
  telefono: string
  direccion: string
}

export default function ModistaPage() {
  const [modista, setModista] = useState<Modista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [modistaActual, setModistaActual] = useState<Modista | null>(null)
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
      console.log("Token disponible, obteniendo modistas...");
      fetchModista();
    }
  }, [token])

  const fetchModista = async () => {
    try {
      const res = await fetch("http://localhost:8000/modistas/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (!res.ok) {
        console.error("Error al obtener modistas:", res.status);
        return;
      }
      
      const data = await res.json()
      console.log("Datos recibidos del servidor:", data);
      
      // Asegurarse de que cada cliente tenga un ID único
      const modistasConId = data.map((modista: Modista, index: number) => {
        // Si el cliente no tiene un ID, asignarle uno temporal basado en el índice
        if (!modista.id) {
          return { ...modista, id: `temp-id-${index}` };
        }
        return modista;
      });
      setModista(modistasConId)
    } catch (err) {
      console.error("Error al obtener clientes", err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoModista = () => {
    setModistaActual(null)
    setFormData({
      nombre: "",
      telefono: "",
      direccion: "",
    })
    setShowModal(true)
  }

  const editarModista = (modista: Modista) => {
    setModistaActual(modista)
    setFormData({
      nombre: modista.nombre,
      telefono: modista.telefono,
      direccion: modista.direccion,
    })
    setShowModal(true)
  }

  const confirmarEliminar = (modista: Modista) => {
    setModistaActual(modista)
    setShowDeleteModal(true)
  }

  const eliminarModista = async () => {
    if (!modistaActual) return
    try {
      await fetch(`http://localhost:8000/modistas/delete/${modistaActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setModista(modista.filter((c) => c.id !== modistaActual.id))
      setShowDeleteModal(false)
      setModistaActual(null)
    } catch (err) {
      console.error("Error al eliminar modista", err)
    }
  }

  const guardarModista = async () => {
    const metodo = modistaActual ? "PUT" : "POST"
    const url = modistaActual
      ? `http://localhost:8000/modistas/update/${modistaActual.id}`
      : `http://localhost:8000/modistas/register`

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
        alert(`Error al guardar modista: ${errorData.detail || 'Revise los datos ingresados'}`);
        return;
      }

      const nuevoModista = await res.json();

      if (modistaActual) {
        setModista(modista.map((c) => (c.id === modistaActual.id ? nuevoModista : c)))
      } else {
        setModista([...modista, nuevoModista])
      }

      setShowModal(false)
      setModistaActual(null)
      fetchModista() // Recargar los modistas después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar modista", err)
      alert("Error al guardar modista. Por favor, intente nuevamente.")
    }
  }

  const modistasFiltrados = modista.filter((modista) =>
    `${modista.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
<<<<<<< HEAD
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Modistas</h1>
          <p className="text-muted mb-0">Gestión de modistas de Guapo Trajes.</p>
        </div>
        <Button className="d-flex align-items-center gap-2" onClick={nuevoModista}>
          <i className="bi bi-plus-lg"></i>
          Nuevo modista
        </Button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder="Buscar modistas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <TableHeader className="table-light">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modistasFiltrados.length > 0 ? (
                modistasFiltrados.map((modista, index) => (
                  <TableRow key={modista.id || `modista-${index}`}>
                    <TableCell className="fw-semibold">{modista.nombre}</TableCell>
                    <TableCell>{modista.direccion}</TableCell>
                    <TableCell className="text-nowrap">{modista.telefono}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => editarModista(modista)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => confirmarEliminar(modista)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-4">
                    No se encontraron modistas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered modal-lg" dialogStyle={{ maxWidth: "600px", width: "95%" }}>
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {modistaActual ? "Editar modista" : "Nuevo modista"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos del modista.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold">Nombre</label>
                    <Input name="nombre" value={formData.nombre} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Teléfono</label>
                    <Input name="telefono" value={formData.telefono} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Dirección</label>
                    <Input name="direccion" value={formData.direccion} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarModista}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={(open) => !open && setShowDeleteModal(false)}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered" dialogStyle={{ maxWidth: "420px", width: "90%" }}>
          <DialogHeader className="border-bottom pb-2">
            <DialogTitle className="fw-semibold">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            <p className="mb-0">
              ¿Seguro querés eliminar a <strong>{modistaActual?.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminarModista}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
=======
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Modistas</h1>
          <p className="text-muted">Gestión de modistas de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoModista}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Modista
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
            placeholder="Buscar modistas..."
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
              {modistasFiltrados.length > 0 ? (
                modistasFiltrados.map((modista, index) => (
                  // Usar una combinación del índice y el ID para garantizar unicidad
                  <tr key={modista.id || `modista-${index}`}>
                    <td className="fw-medium">{modista.nombre}</td>
                    <td>{modista.telefono}</td>
                    <td>{modista.direccion}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarModista(modista)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => confirmarEliminar(modista)}
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
                    No se encontraron modistas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar modistas */}
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
              <h5 className="modal-title">{modistaActual ? "Editar Modista" : "Nuevo Modista"}</h5>
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
              <button type="button" className="btn btn-primary" onClick={guardarModista}>
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
                ¿Está seguro que desea eliminar al cliente {modistaActual?.nombre}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarModista}>
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
    </div>
  )
}