"use client";

import React, { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import ClienteModal from "@/components/modales/clienteModal";
import { RoleGate } from "@/components/RoleGate";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiBaseUrl } from "@/lib/api-config";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  direccion: string;
  celular: string;
  notas: string;
};

type Precliente = {
  nombre: string;
  apellido: string;
  celular: string;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteActual, setClienteActual] = useState<Cliente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [preclienteSeleccionadoId, setPreclienteSeleccionadoId] = useState<
    string | null
  >(null);
  const [relacionesCliente, setRelacionesCliente] = useState<string[]>([]);
  const [verificandoRelaciones, setVerificandoRelaciones] = useState(false);

  // PAGINACIÓN: Estados nuevos
  const [currentPage, setCurrentPage] = useState(0);
  const clientesPorPagina = 12;
  const offset = currentPage * clientesPorPagina;

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
  };

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    direccion: "",
    celular: "",
    notas: "",
  });

  const [token, setToken] = useState<string | null>(null);
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
    }
  }, []);

  const convertirPreclienteACliente = (
    precliente: Precliente & { id?: string }
  ) => {
    setClienteActual(null); // Queremos registrar un nuevo cliente
    setFormData({
      nombre: precliente.nombre,
      apellido: precliente.apellido,
      dni: "",
      direccion: "",
      celular: precliente.celular,
      notas: "",
    });
    if (precliente.id) {
      setPreclienteSeleccionadoId(precliente.id);
    }
    setShowModal(true);
  };

  // Nota: Las props no están disponibles en páginas de Next.js
  // Si necesitas convertir un precliente, usa query params o navegación programática

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo clientes...");
      fetchClientes();
    }
  }, [token]);

  const fetchClientes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/clientes/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Error al obtener clientes:", res.status);
        return;
      }

      const data = await res.json();
      console.log("Datos recibidos del servidor:", data);

      // Asegurarse de que cada cliente tenga un ID único
      const clientesConId = data.map((cliente: Cliente, index: number) => {
        // Si el cliente no tiene un ID, asignarle uno temporal basado en el índice
        if (!cliente.id) {
          return { ...cliente, id: index + 1 };
        }
        return cliente;
      });
      setClientes(clientesConId);
    } catch (err) {
      console.error("Error al obtener clientes", err);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nuevoCliente = () => {
    setClienteActual(null);
    setFormData({
      nombre: "",
      apellido: "",
      dni: "",
      direccion: "",
      celular: "",
      notas: "",
    });
    setShowModal(true);
  };

  const editarCliente = (cliente: Cliente) => {
    setClienteActual(cliente);
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      direccion: cliente.direccion,
      celular: cliente.celular,
      notas: cliente.notas,
    });
    setShowModal(true);
  };

  const confirmarEliminar = async (cliente: Cliente) => {
    setClienteActual(cliente);
    setVerificandoRelaciones(true);

    try {
      // Obtener información detallada sobre las relaciones del cliente
      const response = await fetch(
        `${API_BASE}/clientes/relaciones/${cliente.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const relacionesInfo = await response.json();
        const relaciones = [];

        if (relacionesInfo.relaciones.presupuestos > 0) {
          relaciones.push(
            `${relacionesInfo.relaciones.presupuestos} presupuesto(s)`
          );
        }
        if (relacionesInfo.relaciones.cuentas_corrientes > 0) {
          relaciones.push(
            `${relacionesInfo.relaciones.cuentas_corrientes} movimiento(s) en cuenta corriente`
          );
        }
        if (relacionesInfo.relaciones.ventas > 0) {
          relaciones.push(`${relacionesInfo.relaciones.ventas} venta(s)`);
        }

        setRelacionesCliente(relaciones);
      } else {
        setRelacionesCliente([]);
      }
    } catch (err) {
      console.error("Error al verificar relaciones del cliente", err);
      setRelacionesCliente([]);
    } finally {
      setVerificandoRelaciones(false);
      setShowDeleteModal(true);
    }
  };

  const obtenerInfoCliente = async (clienteId: number) => {
    try {
      const response = await fetch(
        `${API_BASE}/clientes/get_by_id/${clienteId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const clienteInfo = await response.json();
        return clienteInfo;
      }
    } catch (err) {
      console.error("Error al obtener información del cliente", err);
    }
    return null;
  };

  const eliminarCliente = async () => {
    if (!clienteActual) return;
    try {
      const response = await fetch(
        `${API_BASE}/clientes/delete/${clienteActual.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error del servidor:", errorData);
        alert(
          `Error al eliminar cliente: ${
            errorData.detail || "No se pudo eliminar el cliente"
          }`
        );
        return;
      }

      const result = await response.json();
      if (result.success) {
        setClientes(clientes.filter((c) => c.id !== clienteActual.id));
        setShowDeleteModal(false);
        setClienteActual(null);

        // Mostrar mensaje de éxito con advertencias si las hay
        let mensaje = "Cliente eliminado exitosamente";
        if (result.advertencias && result.advertencias.length > 0) {
          mensaje += "\n\nAdvertencias:\n" + result.advertencias.join("\n");
        }
        alert(mensaje);
      } else {
        alert(`Error al eliminar cliente: ${result.message}`);
      }
    } catch (err) {
      console.error("Error al eliminar cliente", err);
      alert(
        "Error de conexión al eliminar cliente. Por favor, intente nuevamente."
      );
    }
  };

  const guardarCliente = async () => {
    if (!formData.nombre || !formData.apellido || !formData.dni) {
      alert(
        "Por favor complete los campos obligatorios: Nombre, Apellido y DNI"
      );
      return;
    }

    const datosFormateados = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      dni: formData.dni.trim(),
      direccion: formData.direccion.trim(),
      celular: formData.celular.trim(),
      notas: formData.notas.trim(),
    };

    try {
      console.log("Enviando datos:", datosFormateados);

      let url = "";
      let metodo = "POST";
      let body: string = "";

      if (clienteActual) {
        // Edición de cliente ya existente
        url = `${API_BASE}/clientes/update/${clienteActual.id}`;
        metodo = "PUT";
        body = JSON.stringify(datosFormateados);
      } else if (preclienteSeleccionadoId) {
        // Conversión de precliente a cliente
        url = `${API_BASE}/preclientes/convertir/${preclienteSeleccionadoId}`;
        metodo = "POST";
        body = JSON.stringify({
          direccion: datosFormateados.direccion,
          dni: datosFormateados.dni,
        });
      } else {
        // Alta normal de cliente
        url = `${API_BASE}/clientes/register`;
        metodo = "POST";
        body = JSON.stringify(datosFormateados);
      }

      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error del servidor:", errorData);
        alert(
          `Error al guardar cliente: ${
            errorData.detail || "Revise los datos ingresados"
          }`
        );
        return;
      }

      const nuevoCliente = await res.json();
      setClientes([...clientes, nuevoCliente.data || nuevoCliente]); // según la estructura devuelta
      setShowModal(false);
      setClienteActual(null);
      setPreclienteSeleccionadoId(null);
      fetchClientes();
      // Conversión completada
    } catch (err) {
      console.error("Error al guardar cliente", err);
      alert("Error al guardar cliente. Por favor, intente nuevamente.");
    }
  };

  const clientesFiltrados = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.apellido}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );
  const clientesPaginados = clientesFiltrados.slice(
    offset,
    offset + clientesPorPagina
  );
  const pageCount = Math.ceil(clientesFiltrados.length / clientesPorPagina);

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Clientes</h1>
          <p className="text-muted mb-0">Gestión de clientes de Guapo Trajes.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={nuevoCliente}>
          <i className="bi bi-plus-lg"></i>
          Nuevo cliente
        </button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder="Buscar clientes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <Table className="align-middle mb-0">
              <TableHeader className="table-light">
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Apellido</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesPaginados.length > 0 ? (
                  clientesPaginados.map((cliente, index) => (
                    <TableRow key={cliente.id || index} className="align-middle">
                      <TableCell className="fw-semibold">{cliente.nombre}</TableCell>
                      <TableCell>{cliente.apellido}</TableCell>
                      <TableCell>{cliente.dni}</TableCell>
                      <TableCell>{cliente.direccion}</TableCell>
                      <TableCell className="text-nowrap">{cliente.celular}</TableCell>
                      <TableCell className="text-muted">
                        {cliente.notas || "Sin notas"}
                      </TableCell>
                      <TableCell>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => editarCliente(cliente)}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <RoleGate allow={["ADMIN"]}>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => confirmarEliminar(cliente)}
                              title="Eliminar"
                              disabled={verificandoRelaciones}
                            >
                              {verificandoRelaciones ? (
                                <div
                                  className="spinner-border spinner-border-sm"
                                  role="status"
                                >
                                  <span className="visually-hidden">
                                    Verificando...
                                  </span>
                                </div>
                              ) : (
                                <i className="bi bi-trash"></i>
                              )}
                            </button>
                          </RoleGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted py-4">
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="d-flex justify-content-center mt-3">
              <ReactPaginate
                previousLabel={"←"}
                nextLabel={"→"}
                breakLabel={"..."}
                pageCount={pageCount}
                onPageChange={handlePageChange}
                containerClassName={"pagination"}
                pageClassName={"page-item"}
                pageLinkClassName={"page-link"}
                previousClassName={"page-item"}
                previousLinkClassName={"page-link"}
                nextClassName={"page-item"}
                nextLinkClassName={"page-link"}
                breakClassName={"page-item"}
                breakLinkClassName={"page-link"}
                activeClassName={"active"}
                forcePage={currentPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear/editar cliente */}
      <ClienteModal
        show={showModal}
        formData={formData}
        onChange={handleChange}
        onClose={() => setShowModal(false)}
        onSave={guardarCliente}
        modoEdicion={!!clienteActual}
      />

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
                ¿Está seguro que desea eliminar al cliente{" "}
                <strong>
                  {clienteActual?.nombre} {clienteActual?.apellido}
                </strong>
                ?
              </p>
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>⚠️ ADVERTENCIA CRÍTICA:</strong> Esta acción no se puede
                deshacer.
              </div>
              {relacionesCliente.length > 0 && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>⚠️ ATENCIÓN:</strong> Este cliente tiene las
                  siguientes relaciones que también serán eliminadas:
                  <ul className="mt-2 mb-0">
                    {relacionesCliente.map((relacion, index) => (
                      <li key={index}>{relacion}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Información:</strong> Se eliminarán todos los datos
                relacionados con este cliente de forma permanente.
              </div>
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
                onClick={eliminarCliente}
              >
                <i className="bi bi-trash me-2"></i>
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
  );
}
