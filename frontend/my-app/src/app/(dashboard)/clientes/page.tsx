"use client";

import React, { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import Link from "next/link";
import ClienteModal from "@/components/modales/clienteModal";
import { RoleGate } from "@/components/RoleGate";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/api-config";
import { formatDdMmYyyyDesdeIso, fechaIsoCalendario } from "@/lib/fecha-calendario";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { MetodoPagoSelector } from "@/components/metodo-pago-selector";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  direccion: string;
  celular: string;
  notas: string;
  fecha_nacimiento?: string | null;
};

function fechaNacimientoParaInput(fecha?: string | null): string {
  return fechaIsoCalendario(fecha ?? "");
}

type Precliente = {
  nombre: string;
  apellido: string;
  celular: string;
};

function normalizarParaBusqueda(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function ClientesPage() {
  const { me } = useAuth();
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
    fecha_nacimiento: "",
    notas: "",
  });

  const [token, setToken] = useState<string | null>(null);
  const API_BASE = getApiBaseUrl();

  const [showCreditoModal, setShowCreditoModal] = useState(false);
  const [clienteCredito, setClienteCredito] = useState<Cliente | null>(null);
  const [montoCredito, setMontoCredito] = useState("");
  const [conceptoCredito, setConceptoCredito] = useState("");
  const [guardandoCredito, setGuardandoCredito] = useState(false);
  const [registrarCreditoEnCaja, setRegistrarCreditoEnCaja] = useState(true);
  const [metodoPagoCreditoId, setMetodoPagoCreditoId] = useState<number | null>(null);
  const [submetodoPagoCreditoId, setSubmetodoPagoCreditoId] = useState<number | null>(null);
  const [cuentaDestinoCreditoId, setCuentaDestinoCreditoId] = useState<number | null>(null);
  const [cuentasDestinoCredito, setCuentasDestinoCredito] = useState<
    Array<{ id: number; nombre_titular: string }>
  >([]);

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
      fecha_nacimiento: "",
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
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Error al obtener clientes:", res.status);
        return;
      }

      const data = await res.json();

      const rawList: Cliente[] = [];
      for (const cliente of Array.isArray(data) ? data : []) {
        const id = Number(cliente.id);
        if (!Number.isFinite(id) || id <= 0) {
          console.warn("Cliente sin id válido omitido:", cliente);
          continue;
        }
        rawList.push({ ...cliente, id });
      }

      const seen = new Set<number>();
      const clientesConId: Cliente[] = [];
      for (const c of rawList) {
        if (seen.has(c.id)) {
          console.warn("[clientes] id duplicado en lista, se omite la repetición:", c.id, c.apellido, c.nombre);
          continue;
        }
        seen.add(c.id);
        clientesConId.push(c);
      }

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
      fecha_nacimiento: "",
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
      fecha_nacimiento: fechaNacimientoParaInput(cliente.fecha_nacimiento),
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
    // Validación mejorada: verificar que los campos no estén vacíos después de trim
    const nombreTrim = formData.nombre?.trim() || "";
    const apellidoTrim = formData.apellido?.trim() || "";
    const dniTrim = formData.dni?.trim() || "";
    const direccionTrim = formData.direccion?.trim() || "";
    const celularTrim = formData.celular?.trim() || "";

    // Validar todos los campos obligatorios
    const camposFaltantes = [];
    if (!nombreTrim) camposFaltantes.push("Nombre");
    if (!apellidoTrim) camposFaltantes.push("Apellido");
    if (!dniTrim) camposFaltantes.push("DNI");
    if (!direccionTrim) camposFaltantes.push("Dirección");
    if (!celularTrim) camposFaltantes.push("Celular");

    if (camposFaltantes.length > 0) {
      alert(
        `❌ Error: Los siguientes campos son obligatorios y no pueden estar vacíos:\n\n${camposFaltantes.join("\n")}\n\nPor favor, complete todos los campos requeridos antes de guardar.`
      );
      return;
    }

    const fechaNac = formData.fecha_nacimiento?.trim() || null;

    const datosFormateados = {
      nombre: nombreTrim,
      apellido: apellidoTrim,
      dni: dniTrim,
      direccion: direccionTrim,
      celular: celularTrim,
      notas: formData.notas?.trim() || "",
      fecha_nacimiento: fechaNac,
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
          fecha_nacimiento: datosFormateados.fecha_nacimiento,
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
        let errorMessage = "";
        
        try {
          const errorData = await res.json();
          console.error("Error del servidor:", errorData);
          
          // Intentar obtener el mensaje de error más específico
          if (errorData.detail) {
            // El mensaje del backend ya es amigable, usarlo directamente
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = "No se pudo guardar el cliente. Revise los datos ingresados.";
          }
        } catch (parseError) {
          // Si no se puede parsear el JSON, usar el status text
          if (res.status === 400) {
            errorMessage = "No se pudo guardar el cliente. Por favor, verifique que todos los campos obligatorios estén completos.";
          } else {
            errorMessage = `Error ${res.status}: ${res.statusText || "Error desconocido"}`;
          }
        }
        
        alert(`❌ ${errorMessage}`);
        return;
      }

      const nuevoCliente = await res.json();
      
      // Verificar si la respuesta indica éxito
      if (nuevoCliente.success === false) {
        alert(`❌ Error: ${nuevoCliente.message || "No se pudo guardar el cliente"}`);
        return;
      }
      
      setClientes([...clientes, nuevoCliente.data || nuevoCliente]); // según la estructura devuelta
      setShowModal(false);
      setClienteActual(null);
      setPreclienteSeleccionadoId(null);
      fetchClientes();
      // Conversión completada
    } catch (err) {
      console.error("Error al guardar cliente", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      alert(`❌ Error de conexión: ${errorMessage}\n\nPor favor, verifique su conexión e intente nuevamente.`);
    }
  };

  const clientesFiltrados = (() => {
    const termino = normalizarParaBusqueda(busqueda);
    if (!termino) return clientes;
    return clientes.filter((cliente) => {
      const nombreCompleto = `${cliente.apellido} ${cliente.nombre}`.trim();
      const dni = (cliente.dni ?? "").toString().trim();
      if (normalizarParaBusqueda(dni).includes(termino)) return true;
      return normalizarParaBusqueda(nombreCompleto).includes(termino);
    });
  })();
  const clientesPaginados = clientesFiltrados.slice(
    offset,
    offset + clientesPorPagina
  );
  const pageCount = Math.ceil(clientesFiltrados.length / clientesPorPagina);

  const cargarCuentasDestinoCredito = async () => {
    if (!token || !me?.sucursalId) {
      setCuentasDestinoCredito([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/cuentas-destino/sucursal/${me.sucursalId}?solo_activas=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setCuentasDestinoCredito([]);
        return;
      }
      const data = await res.json();
      setCuentasDestinoCredito(
        Array.isArray(data)
          ? data.map((c: { id: number; nombre_titular: string }) => ({
              id: c.id,
              nombre_titular: c.nombre_titular,
            }))
          : []
      );
    } catch {
      setCuentasDestinoCredito([]);
    }
  };

  const abrirModalCredito = (cliente: Cliente) => {
    setClienteCredito(cliente);
    setMontoCredito("");
    setConceptoCredito("");
    setRegistrarCreditoEnCaja(true);
    setMetodoPagoCreditoId(null);
    setSubmetodoPagoCreditoId(null);
    setCuentaDestinoCreditoId(null);
    setShowCreditoModal(true);
    void cargarCuentasDestinoCredito();
  };

  const guardarCreditoManual = async () => {
    if (!token || !clienteCredito) return;
    const monto = parseFloat(montoCredito.replace(",", "."));
    if (!monto || monto <= 0) {
      toast.error("Ingresá un monto válido mayor a cero.");
      return;
    }
    const concepto = conceptoCredito.trim();
    if (!concepto) {
      toast.error("El concepto es obligatorio.");
      return;
    }
    if (registrarCreditoEnCaja) {
      if (metodoPagoCreditoId == null) {
        toast.error("Seleccioná el método de pago del abono.");
        return;
      }
      if (!cuentaDestinoCreditoId) {
        toast.error("Seleccioná la cuenta destino del ingreso en caja.");
        return;
      }
    }
    setGuardandoCredito(true);
    try {
      const res = await fetch(`${API_BASE}/pagos/credito-manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cliente_id: clienteCredito.id,
          monto,
          concepto,
          registrar_en_caja: registrarCreditoEnCaja,
          metodo_pago_id: registrarCreditoEnCaja ? metodoPagoCreditoId : null,
          submetodo_pago_id: registrarCreditoEnCaja ? submetodoPagoCreditoId : null,
          cuenta_destino_id: registrarCreditoEnCaja ? cuentaDestinoCreditoId : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const det = err.detail;
        const msg =
          typeof det === "string"
            ? det
            : Array.isArray(det)
              ? det.map((d: { msg?: string }) => d.msg).filter(Boolean).join(". ")
              : "No se pudo registrar el crédito";
        throw new Error(msg || "No se pudo registrar el crédito");
      }
      const data = await res.json();
      toast.success(
        data.registrado_en_caja
          ? "Crédito y ingreso en caja diaria registrados correctamente."
          : "Crédito registrado (ajuste sin movimiento de caja)."
      );
      setShowCreditoModal(false);
      setClienteCredito(null);
      await fetchClientes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar crédito");
    } finally {
      setGuardandoCredito(false);
    }
  };

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
              placeholder="Buscar por apellido, nombre o DNI..."
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
                  <TableHead>Apellido</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Fecha nac.</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesPaginados.length > 0 ? (
                  clientesPaginados.map((cliente) => (
                    <TableRow key={cliente.id} className="align-middle">
                      <TableCell className="fw-semibold">{cliente.apellido}</TableCell>
                      <TableCell>{cliente.nombre}</TableCell>
                      <TableCell>{cliente.dni}</TableCell>
                      <TableCell className="text-nowrap">
                        {cliente.fecha_nacimiento
                          ? formatDdMmYyyyDesdeIso(cliente.fecha_nacimiento)
                          : "—"}
                      </TableCell>
                      <TableCell>{cliente.direccion}</TableCell>
                      <TableCell className="text-nowrap">{cliente.celular}</TableCell>
                      <TableCell className="text-muted">
                        {cliente.notas || "Sin notas"}
                      </TableCell>
                      <TableCell>
                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                          <Link
                            href={`/clientes/${cliente.id}`}
                            className="btn btn-sm btn-outline-secondary"
                            title="Ver perfil (saldo y cuenta corriente)"
                          >
                            <i className="bi bi-person-lines-fill"></i>
                          </Link>
                          <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              title="Agregar crédito a cuenta corriente"
                              onClick={() => abrirModalCredito(cliente)}
                            >
                              <i className="bi bi-plus-circle me-1"></i>
                              Crédito
                            </button>
                          </RoleGate>
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
                    <TableCell colSpan={8} className="text-center text-muted py-4">
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
                  {clienteActual?.apellido} {clienteActual?.nombre}
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

      <Dialog open={showCreditoModal} onOpenChange={setShowCreditoModal}>
        <DialogContent className="max-w-md rounded-3">
          <DialogHeader>
            <DialogTitle>Agregar crédito</DialogTitle>
            <DialogDescription>
              {clienteCredito
                ? `${clienteCredito.apellido}, ${clienteCredito.nombre}. El saldo en cuenta corriente se ve en su perfil.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-1 py-2">
            <div>
              <label className="form-label fw-semibold small">Monto</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={montoCredito}
                onChange={(e) => setMontoCredito(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="form-label fw-semibold small">Concepto</label>
              <Input
                value={conceptoCredito}
                onChange={(e) => setConceptoCredito(e.target.value)}
                placeholder="Ej.: Anticipo para próximo alquiler…"
              />
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="registrar-credito-en-caja"
                checked={registrarCreditoEnCaja}
                onChange={(e) => setRegistrarCreditoEnCaja(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="registrar-credito-en-caja">
                El cliente abonó dinero ahora (registrar ingreso en caja diaria)
              </label>
            </div>
            {registrarCreditoEnCaja && (
              <>
                <MetodoPagoSelector
                  sucursalId={me?.sucursalId}
                  metodoPagoId={metodoPagoCreditoId}
                  submetodoPagoId={submetodoPagoCreditoId}
                  saldoCuentaCorriente={null}
                  onMetodoChange={(metodoId, submetodoId, _display) => {
                    setMetodoPagoCreditoId(metodoId);
                    setSubmetodoPagoCreditoId(submetodoId);
                  }}
                  required
                  showError={metodoPagoCreditoId == null}
                  label="Método de pago del abono"
                />
                <div>
                  <label className="form-label fw-semibold small">
                    Cuenta destino <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={cuentaDestinoCreditoId || ""}
                    onChange={(e) =>
                      setCuentaDestinoCreditoId(Number(e.target.value) || null)
                    }
                  >
                    <option value="">Seleccionar cuenta destino</option>
                    {cuentasDestinoCredito.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre_titular}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {!registrarCreditoEnCaja && (
              <p className="small text-muted mb-0">
                Solo ajusta el saldo a favor (ej. devolución comercial) sin ingreso en caja.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => setShowCreditoModal(false)}
              disabled={guardandoCredito}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={guardandoCredito}
              onClick={guardarCreditoManual}
            >
              {guardandoCredito ? "Guardando…" : "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
