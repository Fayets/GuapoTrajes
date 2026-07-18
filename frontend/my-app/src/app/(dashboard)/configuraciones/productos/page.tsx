"use client";

import React, { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-config";
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";

type Item = { id: number; nombre: string; codigo: string };

const API_BASE = getApiBaseUrl();

function useConfigProductos(token: string | null) {
  const [lineas, setLineas] = useState<Item[]>([]);
  const [talles, setTalles] = useState<Item[]>([]);
  const [telas, setTelas] = useState<Item[]>([]);
  const [colores, setColores] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [rL, rT, rTel, rC] = await Promise.all([
        fetch(`${API_BASE}/config/productos/lineas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/config/productos/talles`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/config/productos/telas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/config/productos/colores`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const safeJson = async (r: Response) => {
        if (!r.ok) return [];
        try {
          return await r.json();
        } catch {
          return [];
        }
      };
      setLineas(await safeJson(rL));
      setTalles(await safeJson(rT));
      setTelas(await safeJson(rTel));
      setColores(await safeJson(rC));
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  return { lineas, talles, telas, colores, loading, refetch: fetchAll };
}

function SectionBlock({
  title,
  items,
  loading,
  token,
  endpoint,
  onDelete,
  refetch,
}: {
  title: string;
  items: Item[];
  loading: boolean;
  token: string | null;
  endpoint: string;
  onDelete: (id: number) => void;
  refetch: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [paginaActual, setPaginaActual] = useState(0);
  const ITEMS_POR_PAGINA = 18;
  const pageCount = Math.ceil(items.length / ITEMS_POR_PAGINA);
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * ITEMS_POR_PAGINA;
  const itemsPaginados = items.slice(
    offsetPagina,
    offsetPagina + ITEMS_POR_PAGINA
  );

  const handleCreate = async () => {
    const n = nombre.trim();
    const c = codigo.trim();
    if (!n || !c || !token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config/productos/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: n, codigo: c }),
      });
      if (!res.ok) {
        let msg = "Error al crear";
        try {
          const err = await res.json();
          const d = err?.detail;
          if (typeof d === "string") msg = d;
          else if (Array.isArray(d) && d[0]?.msg) msg = d[0].msg;
          else if (res.status === 404) msg = "Ruta no disponible. ¿Backend actualizado?";
        } catch {
          if (res.status === 404) msg = "Ruta no disponible. ¿Backend actualizado?";
        }
        toast.error(msg);
        return;
      }
      setNombre("");
      setCodigo("");
      refetch();
      toast.success("Creado");
    } catch {
      toast.error("Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/config/productos/${endpoint}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("No se pudo eliminar (puede estar en uso)");
        return;
      }
      onDelete(id);
      refetch();
      setDeleteId(null);
      toast.success("Eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="card shadow-sm border-line h-100">
      <div className="card-header bg-surface border-bottom border-line py-2 px-3">
        <h6 className="mb-0 fw-semibold text-ink">{title}</h6>
      </div>
      <div className="card-body py-3 px-3">
        <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
          <Input
            placeholder="Agregar..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="form-control form-control-sm gt-select flex-grow-1"
            style={{ maxWidth: "200px" }}
          />
          <Input
            placeholder="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="form-control form-control-sm gt-select"
            style={{ maxWidth: "100px" }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={saving || !nombre.trim() || !codigo.trim()}
            className="btn btn-oxblood btn-sm"
          >
            {saving ? "..." : "Agregar"}
          </Button>
        </div>
        {loading ? (
          <p className="text-muted small mb-0">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">Ninguno</p>
        ) : (
          <ul className="list-group list-group-flush">
            {itemsPaginados.map((item) => (
              <li
                key={item.id}
                className="list-group-item d-flex justify-content-between align-items-center py-2 px-0 border-0"
              >
                <span className="small">
                  <span className="fw-semibold me-1">{item.codigo}</span>
                  {item.nombre}
                </span>
                <button
                  type="button"
                  className="btn-action btn-action--borrar"
                  onClick={() => setDeleteId(item.id)}
                  title="Eliminar"
                >
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {pageCount > 1 && (
          <div className="d-flex flex-column align-items-center mt-2">
            <ReactPaginate
              previousLabel="←"
              nextLabel="→"
              breakLabel="..."
              pageCount={pageCount}
              pageRangeDisplayed={2}
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
            <span className="text-muted small">
              {offsetPagina + 1}–
              {Math.min(offsetPagina + ITEMS_POR_PAGINA, items.length)} de {items.length}
            </span>
          </div>
        )}
      </div>
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="border-0 shadow" style={{ maxWidth: "360px" }}>
          <DialogHeader className="border-0 pb-0">
            <DialogTitle className="h6 mb-0">Eliminar</DialogTitle>
          </DialogHeader>
          <p className="text-secondary small mb-3">
            ¿Eliminar &quot;{items.find((i) => i.id === deleteId)?.nombre}&quot;?
          </p>
          <DialogFooter className="border-0 pt-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} className="btn btn-outline-ink btn-sm">
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={() => deleteId !== null && handleDelete(deleteId)} className="btn btn-danger btn-sm">
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConfigProductosPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  const { lineas, talles, telas, colores, loading, refetch } = useConfigProductos(token);

  return (
    <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
      <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
        <div className="mb-4">
          <h1 className="page-title mb-1">Atributos de productos</h1>
          <p className="text-muted small mb-0">
            Líneas, talles, telas y colores para productos y filtros.
          </p>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6 col-lg-3">
            <SectionBlock
              title="Líneas"
              items={lineas}
              loading={loading}
              token={token}
              endpoint="lineas"
              onDelete={() => {}}
              refetch={refetch}
            />
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <SectionBlock
              title="Talles"
              items={talles}
              loading={loading}
              token={token}
              endpoint="talles"
              onDelete={() => {}}
              refetch={refetch}
            />
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <SectionBlock
              title="Telas"
              items={telas}
              loading={loading}
              token={token}
              endpoint="telas"
              onDelete={() => {}}
              refetch={refetch}
            />
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <SectionBlock
              title="Colores"
              items={colores}
              loading={loading}
              token={token}
              endpoint="colores"
              onDelete={() => {}}
              refetch={refetch}
            />
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
