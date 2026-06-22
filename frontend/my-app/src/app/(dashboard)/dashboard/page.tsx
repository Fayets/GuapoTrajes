"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getApiBaseUrl } from "@/lib/api-config";
import { useScanQueueWithScanner } from "@/hooks/use-scan-queue-with-scanner";
import { ScanQueueModal } from "@/components/scan-queue-modal";

type Rol = "ADMIN" | "EMPLEADO";

export default function Dashboard() {
  const { me, loading } = useAuth();
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const { items: scanQueueItems, clearAll, removeLine } =
    useScanQueueWithScanner({ listen: true });
  const totalCola = scanQueueItems.length;

  const handleLoteCambiarEstado = async (
    estado: "LAVANDERIA" | "MODISTA"
  ): Promise<{ ok: boolean; message?: string }> => {
    const api = getApiBaseUrl();
    const token = localStorage.getItem("token");
    const rows = [...scanQueueItems];
    for (const row of rows) {
      const res = await fetch(`${api}/productos/estado/${row.productoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ estado }),
      });
      let data: { message?: string; success?: boolean } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        /* ignore */
      }
      const failed =
        !res.ok ||
        (typeof data.success === "boolean" && data.success === false);
      if (failed) {
        return {
          ok: false,
          message:
            (typeof data.message === "string" && data.message) ||
            `Error al actualizar «${row.descripcion}»`,
        };
      }
    }
    clearAll();
    return { ok: true };
  };

  const modules = [
    {
      title: "Clientes",
      description: "Gestión de clientes",
      icon: "bi-people",
      href: "/clientes",
      color: "bg-primary bg-opacity-10 text-primary",
    },
    {
      title: "Preclientes",
      description: "Gestión de preclientes",
      icon: "bi-people",
      href: "/preclientes",
      color: "bg-primary bg-opacity-10 text-primary",
    },
    {
      title: "Presupuestos",
      description: "Administrar presupuestos",
      icon: "bi-file-text",
      href: "/presupuestos",
      color: "bg-success bg-opacity-10 text-success",
    },
    {
      title: "Órdenes de trabajo",
      description: "Gestionar órdenes",
      icon: "bi-clipboard",
      href: "/ordenes",
      color: "bg-dark bg-opacity-10 text-purple",
    },
    {
      title: "Devoluciones",
      description: "Gestionar devoluciones",
      icon: "bi-arrow-return-left",
      href: "/devoluciones",
      color: "bg-info bg-opacity-10 text-info",
    },
    {
      title: "Ventas",
      description: "Venta de productos",
      icon: "bi-box",
      href: "/ventas",
      color: "bg-warning bg-opacity-10 text-warning",
    },
    {
      title: "Productos",
      description: "Administrar productos",
      icon: "bi-box",
      href: "/productos",
      color: "bg-warning bg-opacity-10 text-warning",
    },
    {
      title: "Caja diaria",
      description: "Control de ingresos y egresos",
      icon: "bi-cash",
      href: "/caja",
      color: "bg-info bg-opacity-10 text-info",
    },
    {
      title: "Caja chica",
      description: "Gestioná movimientos de caja chica",
      icon: "bi-wallet2",
      href: "/caja-chica",
      color: "bg-primary bg-opacity-10 text-primary",
    },
    {
      title: "Caja concentradora",
      description: "Seguimiento y vaciado de concentradora",
      icon: "bi-piggy-bank",
      href: "/caja-concentradora",
      color: "bg-success bg-opacity-10 text-success",
      allow: ["ADMIN"],
    },
    {
      title: "Reportes",
      description: "Generación de reportes",
      icon: "bi-bar-chart",
      href: "/reportes",
      color: "bg-dark bg-opacity-10 text-dark",
      allow: ["ADMIN", "EMPLEADO"],
    },
  ];

  if (loading) return null; // evita parpadeo mientras carga /auth/me

  const role = me?.role;
  const visibleModules = modules.filter((m) =>
    m.allow ? (role ? m.allow.includes(role) : false) : true
  );

  return (
    <div>
      <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h1 className="fw-bold">Dashboard</h1>
          <p className="text-muted mb-0">
            Bienvenido al sistema de administración de Guapo Trajes
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary position-relative"
          onClick={() => setScanModalOpen(true)}
        >
          <i className="bi bi-upc-scan me-1" aria-hidden />
          Cola de escaneo
          {totalCola > 0 ? (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
              {totalCola}
            </span>
          ) : null}
        </button>
      </div>

      <ScanQueueModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        items={scanQueueItems}
        onClearAll={clearAll}
        onRemoveLine={removeLine}
        onLoteCambiarEstado={handleLoteCambiarEstado}
      />

      <div className="row g-4">
        {visibleModules.map((module) => (
          <div className="col-md-6 col-lg-4 col-xl-3" key={module.title}>
            <Link href={module.href} className="text-decoration-none">
              <div className="card h-100 shadow-sm hover-shadow">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="card-title mb-0">{module.title}</h5>
                    <div className={`rounded p-2 ${module.color}`}>
                      <i className={`bi ${module.icon}`}></i>
                    </div>
                  </div>
                  <p className="card-text text-muted">{module.description}</p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
