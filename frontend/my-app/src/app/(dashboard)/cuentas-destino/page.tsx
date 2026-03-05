"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api-config";
import { RoleGate } from "@/components/RoleGate";
import { useAuth } from "@/context/auth-context";
import { Select } from "@/components/ui/select";

interface CuentaDestino {
  id: number;
  sucursal_id: number;
  nombre_titular: string;
  activa: boolean;
}

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string;
  provincia: string;
}

export default function CuentasDestinoPage() {
  const { me, isAdmin } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaDestino[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalFiltro, setSucursalFiltro] = useState<number | null>(null);
  const [cuentaActual, setCuentaActual] = useState<Partial<CuentaDestino> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = getApiBaseUrl();
  const API_URL = `${API_BASE}/cuentas-destino`;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // Cargar sucursales
  useEffect(() => {
    fetch(`${API_BASE}/sucursales/all`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener sucursales");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data);
          console.log("✅ Sucursales cargadas:", data);
          // Si es EMPLEADO, filtrar por su sucursal
          if (me && !isAdmin && me.sucursalId) {
            console.log("👤 Usuario EMPLEADO, filtrando por sucursal:", me.sucursalId);
            setSucursalFiltro(me.sucursalId);
          } else if (data.length > 0) {
            console.log("🏢 Estableciendo primera sucursal como filtro:", data[0].id);
            setSucursalFiltro(data[0].id);
          }
        }
      })
      .catch((error) => {
        console.error("Error al obtener sucursales:", error);
        toast.error("Error al cargar sucursales");
      });
  }, [me, isAdmin, API_BASE]);

  // Cargar cuentas destino cuando cambia el filtro de sucursal
  useEffect(() => {
    if (sucursalFiltro) {
      console.log("🔄 Sucursal filtro cambió a:", sucursalFiltro);
      cargarCuentasDestino();
    } else {
      setCuentas([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalFiltro]);

  const cargarCuentasDestino = async () => {
    if (!sucursalFiltro) {
      setCuentas([]);
      return;
    }
    
    setLoading(true);
    try {
      const url = `${API_URL}/sucursal/${sucursalFiltro}?solo_activas=false`;
      console.log("🔍 Cargando cuentas destino desde:", url);
      
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error HTTP:", response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("✅ Cuentas destino recibidas:", data);
      
      if (Array.isArray(data)) {
        setCuentas(data);
        console.log(`✅ ${data.length} cuentas destino cargadas`);
      } else {
        console.warn("⚠️ Datos no son un array:", data);
        setCuentas([]);
      }
    } catch (error: any) {
      console.error("❌ Error al cargar cuentas destino:", error);
      toast.error(error.message || "Error al cargar cuentas destino");
      setCuentas([]);
    } finally {
      setLoading(false);
    }
  };

  const guardarCuenta = async () => {
    if (!cuentaActual?.nombre_titular || !cuentaActual.sucursal_id) {
      toast.error("Nombre del titular y sucursal son obligatorios");
      return;
    }

    const isEditing = !!cuentaActual.id;
    const url = isEditing
      ? `${API_URL}/update/${cuentaActual.id}`
      : `${API_URL}/register`;
    const method = isEditing ? "PUT" : "POST";

    const payload = isEditing
      ? {
          nombre_titular: cuentaActual.nombre_titular,
          activa: cuentaActual.activa,
        }
      : {
          sucursal_id: cuentaActual.sucursal_id,
          nombre_titular: cuentaActual.nombre_titular,
        };

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("📝 Resultado de guardar cuenta:", result);

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al guardar cuenta destino");
      }

      // Cerrar modal primero
      setIsModalOpen(false);
      setCuentaActual(null);
      
      // Recargar cuentas destino
      await cargarCuentasDestino();
      
      toast.success(isEditing ? "Cuenta destino actualizada" : "Cuenta destino creada");
    } catch (error: any) {
      toast.error(error.message || "Error al guardar la cuenta destino");
    }
  };

  const activarCuenta = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/activar/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al activar cuenta");
      }

      await cargarCuentasDestino();
      toast.success("Cuenta destino activada");
    } catch (error: any) {
      toast.error(error.message || "Error al activar la cuenta destino");
    }
  };

  const desactivarCuenta = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/desactivar/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al desactivar cuenta");
      }

      await cargarCuentasDestino();
      toast.success("Cuenta destino desactivada");
    } catch (error: any) {
      toast.error(error.message || "Error al desactivar la cuenta destino");
    }
  };

  const sucursalSeleccionada = sucursales.find((s) => s.id === sucursalFiltro);

  return (
    <RoleGate allow={["ADMIN", "EMPLEADO"]}>
      <div className="container-fluid px-4 py-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
          <div>
            <h1 className="fw-bold mb-1">Cuentas Destino</h1>
            <p className="text-muted mb-0">
              Gestión de cuentas destino para ingresos de dinero.
            </p>
          </div>
          <RoleGate allow={["ADMIN"]}>
            <Button
              className="d-flex align-items-center gap-2"
              onClick={() => {
                setCuentaActual({
                  nombre_titular: "",
                  sucursal_id: sucursalFiltro || undefined,
                  activa: true,
                });
                setIsModalOpen(true);
              }}
              disabled={!sucursalFiltro}
            >
              <i className="bi bi-plus-lg"></i>
              Agregar cuenta destino
            </Button>
          </RoleGate>
        </div>

        {/* Filtro de sucursal */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="row align-items-end">
              <div className="col-md-4">
                <label className="form-label">Sucursal</label>
                <select
                  className="form-select"
                  value={sucursalFiltro || ""}
                  onChange={(e) => {
                    const nuevaSucursal = Number(e.target.value) || null;
                    console.log("🔄 Cambiando sucursal filtro a:", nuevaSucursal);
                    setSucursalFiltro(nuevaSucursal);
                  }}
                  disabled={!isAdmin && !!me?.sucursalId}
                >
                  <option value="">Seleccionar sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("🔄 Recargando cuentas destino manualmente");
                    if (sucursalFiltro) {
                      cargarCuentasDestino();
                    } else {
                      toast.error("Seleccioná una sucursal primero");
                    }
                  }}
                  disabled={!sucursalFiltro || loading}
                >
                  <i className="bi bi-arrow-clockwise"></i> Recargar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="table-responsive">
            <Table className="align-middle mb-0">
              <TableHeader className="table-light">
                <TableRow>
                  <TableHead>Nombre del Titular</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : cuentas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted py-4">
                      {sucursalFiltro
                        ? "No hay cuentas destino registradas para esta sucursal."
                        : "Seleccioná una sucursal para ver las cuentas destino."}
                    </TableCell>
                  </TableRow>
                ) : (
                  cuentas.map((cuenta) => {
                    const sucursal = sucursales.find((s) => s.id === cuenta.sucursal_id);
                    return (
                      <TableRow key={cuenta.id}>
                        <TableCell className="fw-semibold">
                          {cuenta.nombre_titular}
                        </TableCell>
                        <TableCell>{sucursal?.nombre || cuenta.sucursal_id}</TableCell>
                        <TableCell className="text-center">
                          {cuenta.activa ? (
                            <span className="badge bg-success">Activa</span>
                          ) : (
                            <span className="badge bg-secondary">Inactiva</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="d-flex justify-content-center gap-2">
                            <RoleGate allow={["ADMIN"]}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCuentaActual(cuenta);
                                  setIsModalOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                              {cuenta.activa ? (
                                <Button
                                  size="sm"
                                  variant="warning"
                                  onClick={() => desactivarCuenta(cuenta.id)}
                                >
                                  Desactivar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => activarCuenta(cuenta.id)}
                                >
                                  Activar
                                </Button>
                              )}
                            </RoleGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent 
            className="w-full border-0" 
            dialogClassName="modal-dialog-centered modal-lg" 
            dialogStyle={{ maxWidth: "600px", width: "95%" }}
          >
            <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
              <DialogTitle className="fw-semibold">
                {cuentaActual?.id ? "Editar cuenta destino" : "Nueva cuenta destino"}
              </DialogTitle>
              <DialogDescription className="mb-0">
                {cuentaActual?.id
                  ? "Modificá los datos de la cuenta destino."
                  : "Completá los datos de la nueva cuenta destino."}
              </DialogDescription>
            </DialogHeader>

            <div className="modal-body px-3 px-md-4">
              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <div className="row g-3">
                    {!cuentaActual?.id && (
                      <div className="col-12">
                        <label className="form-label fw-bold">Sucursal *</label>
                        <select
                          className="form-select"
                          value={cuentaActual?.sucursal_id || ""}
                          onChange={(e) =>
                            setCuentaActual({
                              ...cuentaActual,
                              sucursal_id: Number(e.target.value),
                            })
                          }
                          disabled={!isAdmin && !!me?.sucursalId}
                        >
                          <option value="">Seleccionar sucursal</option>
                          {sucursales.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="col-12">
                      <label className="form-label fw-bold">Nombre del Titular *</label>
                      <Input
                        type="text"
                        value={cuentaActual?.nombre_titular || ""}
                        onChange={(e) =>
                          setCuentaActual({
                            ...cuentaActual,
                            nombre_titular: e.target.value,
                          })
                        }
                        placeholder="Ej: Cuenta Tomas Schmira"
                      />
                    </div>

                    {cuentaActual?.id && (
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={cuentaActual.activa ?? true}
                            onChange={(e) =>
                              setCuentaActual({
                                ...cuentaActual,
                                activa: e.target.checked,
                              })
                            }
                            id="activaCheck"
                          />
                          <label className="form-check-label" htmlFor="activaCheck">
                            Cuenta activa
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
              <button
                className="btn btn-light border"
                onClick={() => {
                  setIsModalOpen(false);
                  setCuentaActual(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={guardarCuenta}
                disabled={!cuentaActual?.nombre_titular || (!cuentaActual?.id && !cuentaActual?.sucursal_id)}
              >
                {cuentaActual?.id ? "Actualizar" : "Guardar"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
