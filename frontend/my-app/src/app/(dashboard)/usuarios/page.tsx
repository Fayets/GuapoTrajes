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
import { useAuth } from "@/context/auth-context";

interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  sucursal_id: number;
  sucursal_nombre?: string | null;
}

interface Sucursal {
  id: number;
  nombre: string;
}

export default function UsuariosPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<Partial<Usuario> & { password?: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const API_BASE = getApiBaseUrl();
  const API_URL = `${API_BASE}/usuarios`;
  const SUCURSALES_URL = `${API_BASE}/sucursales`;

  const canManageUsuarios = isAdmin || isSuperAdmin;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  useEffect(() => {
    if (!canManageUsuarios) return;

    // Cargar usuarios
    fetch(`${API_URL}/all`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("No autorizado o error en el servidor");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsuarios(data);
        } else {
          console.error("Formato de datos inesperado:", data);
          setUsuarios([]);
        }
      })
      .catch((error) => {
        console.error("Error al obtener usuarios:", error.message);
        setUsuarios([]);
      });

    // Cargar sucursales
    fetch(`${SUCURSALES_URL}/all`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener sucursales");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data);
        }
      })
      .catch((error) => {
        console.error("Error al obtener sucursales:", error.message);
      });
  }, [canManageUsuarios]);

  const guardarUsuario = async () => {
    if (
      !usuarioActual?.username ||
      !usuarioActual?.email ||
      !usuarioActual?.nombre ||
      !usuarioActual?.apellido ||
      !usuarioActual?.sucursal_id
    ) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    const isEditing = !!usuarioActual.id;

    // Al crear, la contraseña es obligatoria
    if (!isEditing && !usuarioActual.password) {
      toast.error("La contraseña es obligatoria al crear un usuario");
      return;
    }

    const url = isEditing
      ? `${API_URL}/update/${usuarioActual.id}`
      : `${API_URL}/create`;
    const method = isEditing ? "PUT" : "POST";

    const { id, sucursal_nombre, ...usuarioSinId } = usuarioActual;

    const payload: any = {
      username: usuarioSinId.username,
      email: usuarioSinId.email,
      nombre: usuarioSinId.nombre,
      apellido: usuarioSinId.apellido,
      role: "EMPLEADO", // Solo se pueden crear usuarios tipo EMPLEADO
      sucursal: usuarioSinId.sucursal_id,
    };

    // Solo incluir password si se está creando o si se está actualizando y se proporcionó
    if (!isEditing || usuarioActual.password) {
      payload.password = usuarioActual.password;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al crear o actualizar usuario.");
      }

      const updatedUsuario = result.data;

      setUsuarios((prev) =>
        isEditing
          ? prev.map((u) => (u.id === updatedUsuario.id ? updatedUsuario : u))
          : [...prev, updatedUsuario]
      );

      setIsModalOpen(false);
      toast.success(isEditing ? "Usuario actualizado" : "Usuario creado");
    } catch (error: any) {
      toast.error(error.message || "Error al guardar el usuario");
    }
  };

  const eliminarUsuario = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/delete/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Error al eliminar");
      }
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
      toast.success("Usuario eliminado");
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar el usuario");
    }
  };

  if (!canManageUsuarios) {
    return (
      <div className="container-fluid px-4 py-3">
        <div className="alert alert-warning">
          No tienes permisos para acceder a esta página.
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Usuarios / Empleados</h1>
          <p className="text-muted mb-0">
            Gestión de usuarios tipo EMPLEADO del sistema.
          </p>
        </div>
        <Button
          className="d-flex align-items-center gap-2"
          onClick={() => {
            setUsuarioActual({
              username: "",
              email: "",
              nombre: "",
              apellido: "",
              password: "",
              sucursal_id: 0,
              rol: "EMPLEADO",
            });
            setIsModalOpen(true);
          }}
        >
          <i className="bi bi-plus-lg"></i>
          Agregar empleado
        </Button>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <TableHeader className="table-light">
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios
                ?.filter((u) => u.rol === "EMPLEADO")
                .map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="fw-semibold">{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.apellido}</TableCell>
                    <TableCell>{u.nombre}</TableCell>
                    <TableCell>
                      <span className="badge bg-secondary">{u.rol}</span>
                    </TableCell>
                    <TableCell>{u.sucursal_nombre || "N/A"}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUsuarioActual({ ...u, password: "" });
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => eliminarUsuario(u.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {(!usuarios ||
                usuarios.filter((u) => u.rol === "EMPLEADO").length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted py-4">
                    No hay empleados registrados.
                  </TableCell>
                </TableRow>
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
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {usuarioActual?.id ? "Editar empleado" : "Nuevo empleado"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos del empleado.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold">Usuario</label>
                    <Input
                      value={usuarioActual?.username || ""}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          username: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Email</label>
                    <Input
                      type="email"
                      value={usuarioActual?.email || ""}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold">Apellido</label>
                    <Input
                      value={usuarioActual?.apellido || ""}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          apellido: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold">Nombre</label>
                    <Input
                      value={usuarioActual?.nombre || ""}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          nombre: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">
                      Contraseña
                      {usuarioActual?.id && (
                        <span className="text-muted ms-2">(dejar vacío para no cambiar)</span>
                      )}
                    </label>
                    <Input
                      type="password"
                      value={usuarioActual?.password || ""}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Sucursal</label>
                    <select
                      className="form-select"
                      value={usuarioActual?.sucursal_id || 0}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          sucursal_id: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={0}>Seleccionar sucursal</option>
                      {sucursales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => guardarUsuario()}>
              {usuarioActual?.id ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
