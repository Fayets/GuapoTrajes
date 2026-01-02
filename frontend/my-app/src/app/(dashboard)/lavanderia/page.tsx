"use client"

import React, { useEffect, useState } from "react"
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
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Lavandería</h1>
          <p className="text-muted mb-0">Gestión de lavanderías de Guapo Trajes.</p>
        </div>
        <Button className="d-flex align-items-center gap-2" onClick={nuevoLavanderia}>
          <i className="bi bi-plus-lg"></i>
          Nueva lavandería
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
              placeholder="Buscar lavanderías..."
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
              {lavanderiaFiltrados.length > 0 ? (
                lavanderiaFiltrados.map((lavanderia, index) => (
                  <TableRow key={lavanderia.id || `lavanderia-${index}`}>
                    <TableCell className="fw-semibold">{lavanderia.nombre}</TableCell>
                    <TableCell>{lavanderia.direccion}</TableCell>
                    <TableCell className="text-nowrap">{lavanderia.telefono}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => editarLavanderia(lavanderia)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => confirmarEliminar(lavanderia)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-4">
                    No se encontraron lavanderías.
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
              {lavanderiaActual ? "Editar lavandería" : "Nueva lavandería"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos de la lavandería asociada.
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
            <Button onClick={guardarLavanderia}>Guardar</Button>
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
              ¿Seguro querés eliminar a <strong>{lavanderiaActual?.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminarLavanderia}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}