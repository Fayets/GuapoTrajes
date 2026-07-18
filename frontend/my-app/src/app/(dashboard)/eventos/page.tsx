"use client";

import React, { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl } from "@/lib/api-config";

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
  const [paginaActual, setPaginaActual] = useState(0);
  const EVENTOS_POR_PAGINA = 18;

  const [formData, setFormData] = useState({
    nombre: "",
  });

  const API_BASE = getApiBaseUrl();

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchEventos();
    }
  }, [token]);

  const fetchEventos = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/eventos/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Error al obtener eventos:", res.status);
        return;
      }

      const data = await res.json();

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
      await fetch(`${API_BASE}/eventos/delete/${eventoActual.id}`, {
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
      ? `${API_BASE}/eventos/update/${eventoActual.id}`
      : `${API_BASE}/eventos/register`;

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
  const pageCount = Math.ceil(eventosFiltrados.length / EVENTOS_POR_PAGINA);
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * EVENTOS_POR_PAGINA;
  const eventosPaginados = eventosFiltrados.slice(
    offsetPagina,
    offsetPagina + EVENTOS_POR_PAGINA
  );

  useEffect(() => {
    setPaginaActual(0);
  }, [busqueda]);

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="page-title mb-1">Eventos</h1>
          <p className="text-muted mb-0">Gestión de eventos de Guapo Trajes.</p>
        </div>
        <button className="btn btn-oxblood d-flex align-items-center gap-2" onClick={nuevoEvento}>
          <i className="bi bi-plus-lg"></i>
          Nuevo Evento
        </button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group gt-search">
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
        </div>
      </div>
      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-oxblood" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm border-line">
          <div className="table-responsive">
            <table className="table gt-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {eventosFiltrados.length > 0 ? (
                  eventosPaginados.map((evento, index) => (
                    // Usar una combinación del índice y el ID para garantizar unicidad
                    <tr key={evento.id || `lavanderia-${index}`}>
                      <td className="fw-medium">{evento.nombre}</td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn-action btn-action--editar"
                            onClick={() => editarEvento(evento)}
                            title="Editar"
                          >
                            <Pencil size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            className="btn-action btn-action--borrar"
                            onClick={() => confirmarEliminar(evento)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center text-muted py-4">
                      No se encontraron eventos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="d-flex flex-column align-items-center gap-1 px-3 py-2 border-top">
              <ReactPaginate
                previousLabel="←"
                nextLabel="→"
                breakLabel="..."
                pageCount={pageCount}
                pageRangeDisplayed={3}
                marginPagesDisplayed={1}
                onPageChange={({ selected }) => setPaginaActual(selected)}
                containerClassName="pagination"
                pageClassName="page-item"
                pageLinkClassName="page-link"
                previousClassName="page-item"
                previousLinkClassName="page-link"
                nextClassName="page-item"
                nextLinkClassName="page-link"
                breakClassName="page-item"
                breakLinkClassName="page-link"
                activeClassName="active"
                forcePage={Math.min(paginaActual, Math.max(0, pageCount - 1))}
              />
              <span className="text-muted small text-center">
                Mostrando {offsetPagina + 1}–
                {Math.min(offsetPagina + EVENTOS_POR_PAGINA, eventosFiltrados.length)} de{" "}
                {eventosFiltrados.length} eventos
              </span>
            </div>
          )}
        </div>
      )}

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
            <button className="btn btn-oxblood" onClick={guardarEvento}>
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
    </div>
  );
}
