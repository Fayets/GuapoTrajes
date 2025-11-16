"use client";

import React, { useEffect, useState } from "react";
<<<<<<< HEAD
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

type Evento = {
  id: string;
  nombre: string;
};

export default function EventoPage() {
  const [evento, setEvento] = useState<Evento[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [eventoActual, setEventoActual] = useState<Evento | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [formData, setFormData] = useState({
    nombre: "",
  });

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo eventos...");
      fetchEventos();
    }
  }, [token]);

  const fetchEventos = async () => {
    setCargando(true);
    try {
      const res = await fetch("http://localhost:8000/eventos/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Error al obtener eventos:", res.status);
        return;
      }

      const data = await res.json();
      console.log("Datos recibidos del servidor:", data);

      // Asegurarse de que cada cliente tenga un ID único
      const eventosConId = data.map((evento: Evento, index: number) => {
        // Si la lavenderia no tiene un ID, asignarle uno temporal basado en el índice
        if (!evento.id) {
          return { ...evento, id: `temp-id-${index}` };
        }
        return evento;
      });
      setEvento(eventosConId);
    } catch (err) {
      console.error("Error al obtener evento.", err);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nuevoEvento = () => {
    setEventoActual(null);
    setFormData({
      nombre: "",
    });
    setShowModal(true);
  };

  const editarEvento = (evento: Evento) => {
    setEventoActual(evento);
    setFormData({
      nombre: evento.nombre,
    });
    setShowModal(true);
  };

  const confirmarEliminar = (evento: Evento) => {
    setEventoActual(evento);
    setShowDeleteModal(true);
  };

  const eliminarEvento = async () => {
    if (!eventoActual) return;
    try {
      await fetch(`http://localhost:8000/eventos/delete/${eventoActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setEvento(evento.filter((c) => c.id !== eventoActual.id));
      setShowDeleteModal(false);
      setEventoActual(null);
    } catch (err) {
      console.error("Error al eliminar evento.", err);
    }
  };

  const guardarEvento = async () => {
    const metodo = eventoActual ? "PUT" : "POST";
    const url = eventoActual
      ? `http://localhost:8000/eventos/update/${eventoActual.id}`
      : `http://localhost:8000/eventos/register`;

    // Validar datos antes de enviar
    if (!formData.nombre) {
      alert("Por favor complete los campos obligatorios: Nombre");
      return;
    }

    // Asegurarse de que todos los campos sean strings
    const datosFormateados = {
      nombre: formData.nombre.trim(),
    };

    try {
      console.log("Enviando datos:", datosFormateados);

      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosFormateados),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error del servidor:", errorData);
        alert(
          `Error al guardar evento: ${
            errorData.detail || "Revise los datos ingresados"
          }`
        );
        return;
      }

      const nuevoEvento = await res.json();

      if (eventoActual) {
        setEvento(
          evento.map((c) => (c.id === eventoActual.id ? nuevoEvento : c))
        );
      } else {
        setEvento([...evento, nuevoEvento]);
      }

      setShowModal(false);
      setEventoActual(null);
      fetchEventos(); // Recargar los eventos después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar evento", err);
      alert("Error al guardar evento. Por favor, intente nuevamente.");
    }
  };

  const eventosFiltrados = evento.filter((evento) =>
    `${evento.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
<<<<<<< HEAD
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Eventos</h1>
          <p className="text-muted mb-0">Gestión de eventos de Guapo Trajes.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={nuevoEvento}>
          <i className="bi bi-plus-lg"></i>
=======
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Eventos</h1>
          <p className="text-muted">Gestión de eventos de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoEvento}>
          <i className="bi bi-plus me-2"></i>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          Nuevo Evento
        </button>
      </div>

<<<<<<< HEAD
      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder="Buscar eventos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
=======
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
        </div>
      </div>
      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
<<<<<<< HEAD
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th className="text-center">Acciones</th>
=======
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Acciones</th>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                </tr>
              </thead>
              <tbody>
                {eventosFiltrados.length > 0 ? (
                  eventosFiltrados.map((evento, index) => (
                    // Usar una combinación del índice y el ID para garantizar unicidad
                    <tr key={evento.id || `lavanderia-${index}`}>
                      <td className="fw-medium">{evento.nombre}</td>
<<<<<<< HEAD
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
=======
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-secondary"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                            onClick={() => editarEvento(evento)}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => confirmarEliminar(evento)}
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
<<<<<<< HEAD
                    <td colSpan={2} className="text-center text-muted py-4">
=======
                    <td colSpan={6} className="text-center">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                      No se encontraron eventos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

<<<<<<< HEAD
      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "520px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">
              {eventoActual ? "Editar Evento" : "Nuevo Evento"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos del evento.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <label htmlFor="nombre" className="form-label fw-bold">
                  Nombre del evento
                </label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Casamiento, cumpleaños..."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={guardarEvento}>
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={(open) => !open && setShowDeleteModal(false)}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered"
          dialogStyle={{ maxWidth: "420px", width: "90%" }}
        >
          <DialogHeader className="border-bottom pb-2 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            <p className="mb-0">
              ¿Seguro querés eliminar el evento
              <strong> {eventoActual?.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={eliminarEvento}>
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
=======
      {/* Modal para crear/editar eventos */}
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
                {eventoActual ? "Editar Evento" : "Nuevo Evento"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
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
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarEvento}
              >
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
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <p>
                ¿Está seguro que desea eliminar el evento {eventoActual?.nombre}
                ? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={eliminarEvento}
              >
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
  );
}
