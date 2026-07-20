"use client";

import { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { Pencil, Trash2 } from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/modales/confirm-delete-dialog";
import { scheduleUndoableDelete } from "@/lib/undoable-delete";
import { useFlushUndoableDeletesOnLeave } from "@/hooks/use-flush-undoable-deletes";

type RolGestionable = "EMPLEADO" | "ADMIN";

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

function badgeRolClass(rol: string): string {
  if (rol === "ADMIN") return "badge bg-primary";
  return "badge bg-secondary";
}

function labelRol(rol: string): string {
  if (rol === "ADMIN") return "Administrador";
  if (rol === "EMPLEADO") return "Empleado";
  return rol;
}

export default function UsuariosPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<
    Partial<Usuario> & { password?: string } | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);
  const USUARIOS_POR_PAGINA = 18;
  useFlushUndoableDeletesOnLeave();

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

    const rolSeleccionado = (usuarioActual.rol || "EMPLEADO") as RolGestionable;
    if (rolSeleccionado !== "EMPLEADO" && rolSeleccionado !== "ADMIN") {
      toast.error("El rol debe ser Empleado o Administrador");
      return;
    }

    const isEditing = !!usuarioActual.id;

    if (!isEditing && !usuarioActual.password) {
      toast.error("La contraseña es obligatoria al crear un usuario");
      return;
    }

    const url = isEditing
      ? `${API_URL}/update/${usuarioActual.id}`
      : `${API_URL}/create`;
    const method = isEditing ? "PUT" : "POST";

    const payload: Record<string, unknown> = {
      username: usuarioActual.username,
      email: usuarioActual.email,
      nombre: usuarioActual.nombre,
      apellido: usuarioActual.apellido,
      role: rolSeleccionado,
      sucursal: usuarioActual.sucursal_id,
    };

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
        const detail =
          typeof result.detail === "string"
            ? result.detail
            : result.message || "Error al crear o actualizar usuario.";
        throw new Error(detail);
      }

      const updatedUsuario = result.data;

      setUsuarios((prev) =>
        isEditing
          ? prev.map((u) => (u.id === updatedUsuario.id ? updatedUsuario : u))
          : [...prev, updatedUsuario]
      );

      setIsModalOpen(false);
      toast.success(isEditing ? "Usuario actualizado" : "Usuario creado");
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error al guardar el usuario";
      toast.error(msg);
    }
  };

  const solicitarEliminarUsuario = (u: Usuario) => {
    setUsuarioAEliminar(u);
  };

  const confirmarEliminarUsuario = () => {
    const u = usuarioAEliminar;
    if (!u) return;
    setUsuarioAEliminar(null);
    const snapshot = u;
    scheduleUndoableDelete({
      id: `usuario-${snapshot.id}`,
      message: `Usuario «${snapshot.username}» eliminado`,
      description: "Podés deshacer durante 10 segundos",
      onOptimisticRemove: () => {
        setUsuarios((prev) => prev.filter((x) => x.id !== snapshot.id));
      },
      onRestore: () => {
        setUsuarios((prev) => {
          if (prev.some((x) => x.id === snapshot.id)) return prev;
          return [...prev, snapshot];
        });
      },
      executeDelete: async () => {
        const res = await fetch(`${API_URL}/delete/${snapshot.id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.detail || "No se pudo eliminar el usuario");
        }
        toast.success("Usuario eliminado");
      },
    });
  };

  const usuariosGestionables =
    usuarios?.filter((u) => u.rol === "EMPLEADO" || u.rol === "ADMIN") ?? [];
  const pageCount = Math.ceil(usuariosGestionables.length / USUARIOS_POR_PAGINA);
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * USUARIOS_POR_PAGINA;
  const usuariosPaginados = usuariosGestionables.slice(
    offsetPagina,
    offsetPagina + USUARIOS_POR_PAGINA
  );

  if (!canManageUsuarios) {
    return (
      <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
        <div className="alert alert-warning">
          No tienes permisos para acceder a esta página.
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="page-title mb-1">Usuarios</h1>
          <p className="text-muted mb-0">
            Gestión de empleados y administradores del sistema.
          </p>
        </div>
        <Button
          className="btn-oxblood d-flex align-items-center gap-2"
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
          Agregar usuario
        </Button>
      </div>

      <div className="card shadow-sm border-line">
        <div className="table-responsive">
          <Table className="gt-table align-middle mb-0">
            <TableHeader>
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
              {usuariosPaginados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="fw-semibold">{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.apellido}</TableCell>
                  <TableCell>{u.nombre}</TableCell>
                  <TableCell>
                    <span className={badgeRolClass(u.rol)}>
                      {labelRol(u.rol)}
                    </span>
                  </TableCell>
                  <TableCell>{u.sucursal_nombre || "N/A"}</TableCell>
                  <TableCell>
                    <div className="d-flex justify-content-center gap-2">
                      <button
                        className="btn-action btn-action--editar"
                        onClick={() => {
                          setUsuarioActual({ ...u, password: "" });
                          setIsModalOpen(true);
                        }}
                        title="Editar"
                      >
                        <Pencil size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        className="btn-action btn-action--borrar"
                        onClick={() => solicitarEliminarUsuario(u)}
                        title="Eliminar"
                      >
                        <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {usuariosGestionables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted py-4">
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
              {Math.min(
                offsetPagina + USUARIOS_POR_PAGINA,
                usuariosGestionables.length
              )}{" "}
              de {usuariosGestionables.length} usuarios
            </span>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "600px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {usuarioActual?.id ? "Editar usuario" : "Nuevo usuario"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos. Podés crear un empleado o un administrador.
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
                    <label className="form-label fw-bold">Rol</label>
                    <select
                      className="form-select gt-select"
                      value={usuarioActual?.rol || "EMPLEADO"}
                      onChange={(e) =>
                        setUsuarioActual({
                          ...usuarioActual!,
                          rol: e.target.value as RolGestionable,
                        })
                      }
                    >
                      <option value="EMPLEADO">Empleado</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">
                      Contraseña
                      {usuarioActual?.id && (
                        <span className="text-muted ms-2">
                          (dejar vacío para no cambiar)
                        </span>
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
                      className="form-select gt-select"
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
            <Button
              variant="outline"
              className="btn-outline-ink"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="btn-oxblood" onClick={() => guardarUsuario()}>
              {usuarioActual?.id ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={usuarioAEliminar != null}
        onOpenChange={(open) => {
          if (!open) setUsuarioAEliminar(null);
        }}
        itemLabel={
          usuarioAEliminar
            ? `al usuario «${usuarioAEliminar.username}» (${usuarioAEliminar.nombre} ${usuarioAEliminar.apellido})`
            : "este usuario"
        }
        onConfirm={confirmarEliminarUsuario}
      />
    </div>
  );
}
