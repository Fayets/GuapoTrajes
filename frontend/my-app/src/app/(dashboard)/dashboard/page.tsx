"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  FileText,
  ClipboardList,
  Undo2,
  ShoppingBag,
  Package,
  Banknote,
  Wallet,
  PiggyBank,
  BarChart3,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useSucursal } from "@/context/sucursal-context";
import { getApiBaseUrl } from "@/lib/api-config";
import { useScanQueueWithScanner } from "@/hooks/use-scan-queue-with-scanner";
import { ScanQueueModal } from "@/components/scan-queue-modal";

type Rol = "ADMIN" | "EMPLEADO" | "SUPER_ADMIN";

type Kpis = {
  ventasTotal: number | null;
  ventasCantidad: number | null;
  saldoEfectivo: number | null;
  ordenesActivas: number | null;
  prendasSalon: number | null;
};

const KPIS_INICIALES: Kpis = {
  ventasTotal: null,
  ventasCantidad: null,
  saldoEfectivo: null,
  ordenesActivas: null,
  prendasSalon: null,
};

const formatMoney = (n: number) =>
  n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

export default function Dashboard() {
  const { me, loading } = useAuth();
  const { sucursalActual } = useSucursal();
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [kpis, setKpis] = useState<Kpis>(KPIS_INICIALES);
  const [kpisLoading, setKpisLoading] = useState(true);
  const { items: scanQueueItems, clearAll, removeLine } =
    useScanQueueWithScanner({ listen: true });
  const totalCola = scanQueueItems.length;
  const sucursalId = sucursalActual?.id ?? null;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const api = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${token}` };
    // Fecha local (no UTC) en formato YYYY-MM-DD
    const hoy = new Date().toLocaleDateString("en-CA");
    let cancelled = false;

    const getJson = async (url: string): Promise<any> => {
      const res = await fetch(url, { headers });
      return res.ok ? res.json() : null;
    };

    const load = async () => {
      setKpisLoading(true);
      const [ventas, caja, ordenes, stock] = await Promise.allSettled([
        getJson(
          `${api}/reportes/ingresos-por-tipo?fecha_desde=${hoy}&fecha_hasta=${hoy}&categoria=VENTAS`
        ),
        sucursalId !== null
          ? getJson(`${api}/caja/diaria?fecha=${hoy}&sucursal_id=${sucursalId}`)
          : Promise.resolve(null),
        getJson(`${api}/ordenes/`),
        getJson(`${api}/productos/stats/estado`),
      ]);

      if (cancelled) return;

      const val = (r: PromiseSettledResult<any>) =>
        r.status === "fulfilled" ? r.value : null;

      const ventasData = val(ventas)?.data;
      const cajaData = val(caja);
      const ordenesData = val(ordenes);
      const stockData = val(stock);

      const estadosCerrados = new Set(["completada", "cancelada", "entregada"]);

      setKpis({
        ventasTotal:
          typeof ventasData?.total_general === "number"
            ? ventasData.total_general
            : null,
        ventasCantidad:
          typeof ventasData?.cantidad_total === "number"
            ? ventasData.cantidad_total
            : null,
        saldoEfectivo:
          typeof cajaData?.saldo_efectivo === "number"
            ? cajaData.saldo_efectivo
            : null,
        ordenesActivas: Array.isArray(ordenesData)
          ? ordenesData.filter(
              (o: any) =>
                !estadosCerrados.has(String(o?.estado ?? "").toLowerCase())
            ).length
          : null,
        prendasSalon:
          typeof stockData?.SALON === "number" ? stockData.SALON : null,
      });
      setKpisLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sucursalId]);

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

  // Dominios visuales: personas | caja | inventario | documentos
  const modules: {
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
    domain: "personas" | "caja" | "inventario" | "documentos";
    allow?: Rol[];
  }[] = [
    {
      title: "Clientes",
      description: "Gestión de clientes",
      icon: Users,
      href: "/clientes",
      domain: "personas",
    },
    {
      title: "Preclientes",
      description: "Gestión de preclientes",
      icon: UserPlus,
      href: "/preclientes",
      domain: "personas",
    },
    {
      title: "Presupuestos",
      description: "Administrar presupuestos",
      icon: FileText,
      href: "/presupuestos",
      domain: "documentos",
    },
    {
      title: "Órdenes de trabajo",
      description: "Gestionar órdenes",
      icon: ClipboardList,
      href: "/ordenes",
      domain: "documentos",
    },
    {
      title: "Devoluciones",
      description: "Gestionar devoluciones",
      icon: Undo2,
      href: "/devoluciones",
      domain: "caja",
    },
    {
      title: "Ventas",
      description: "Venta de productos",
      icon: ShoppingBag,
      href: "/ventas",
      domain: "caja",
    },
    {
      title: "Productos",
      description: "Administrar productos",
      icon: Package,
      href: "/productos",
      domain: "inventario",
    },
    {
      title: "Caja diaria",
      description: "Control de ingresos y egresos",
      icon: Banknote,
      href: "/caja",
      domain: "caja",
    },
    {
      title: "Caja chica",
      description: "Gestioná movimientos de caja chica",
      icon: Wallet,
      href: "/caja-chica",
      domain: "caja",
    },
    {
      title: "Caja concentradora",
      description: "Seguimiento y vaciado de concentradora",
      icon: PiggyBank,
      href: "/caja-concentradora",
      domain: "caja",
      allow: ["ADMIN"],
    },
    {
      title: "Reportes",
      description: "Generación de reportes",
      icon: BarChart3,
      href: "/reportes",
      domain: "documentos",
      allow: ["ADMIN", "EMPLEADO"],
    },
  ];

  if (loading) return null; // evita parpadeo mientras carga /auth/me

  const role = me?.role;
  const visibleModules = modules.filter((m) =>
    m.allow ? (role ? m.allow.includes(role) : false) : true
  );

  const kpiCards: {
    label: string;
    value: string;
    hint?: string;
    icon: LucideIcon;
    domain: "personas" | "caja" | "inventario" | "documentos";
    href: string;
  }[] = [
    {
      label: "Ventas de hoy",
      value: kpis.ventasTotal !== null ? formatMoney(kpis.ventasTotal) : "—",
      hint:
        kpis.ventasCantidad !== null
          ? `${kpis.ventasCantidad} ${
              kpis.ventasCantidad === 1 ? "operación" : "operaciones"
            }`
          : undefined,
      icon: TrendingUp,
      domain: "caja",
      href: "/ventas",
    },
    {
      label: "Efectivo en caja",
      value:
        kpis.saldoEfectivo !== null ? formatMoney(kpis.saldoEfectivo) : "—",
      hint: sucursalActual?.nombre,
      icon: Banknote,
      domain: "caja",
      href: "/caja",
    },
    {
      label: "Órdenes activas",
      value: kpis.ordenesActivas !== null ? String(kpis.ordenesActivas) : "—",
      icon: ClipboardList,
      domain: "documentos",
      href: "/ordenes",
    },
    {
      label: "Prendas en salón",
      value: kpis.prendasSalon !== null ? String(kpis.prendasSalon) : "—",
      icon: Package,
      domain: "inventario",
      href: "/productos",
    },
  ];

  return (
    <div>
      <div className="dashboard-header mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="text-muted mb-0">
            Bienvenido al sistema de administración de Guapo Trajes
          </p>
        </div>
        <button
          type="button"
          className="btn btn-scan-queue position-relative d-none d-md-inline-block"
          onClick={() => setScanModalOpen(true)}
        >
          <i className="bi bi-upc-scan me-1" aria-hidden />
          Cola de escaneo
          {totalCola > 0 ? (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger font-fraunces">
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

      {/* Métricas: solo en móvil */}
      <div className="row g-2 mb-4 d-md-none">
        {kpiCards.map((kpi) => (
          <div className="col-6 col-xl-3" key={kpi.label}>
            <Link href={kpi.href} className="kpi-link">
              <div className="kpi-card">
                <div className={`module-chip module-chip--${kpi.domain}`}>
                  <kpi.icon size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className="kpi-body">
                  <p className="kpi-label">{kpi.label}</p>
                  <p
                    className={`kpi-value font-fraunces ${
                      kpisLoading ? "kpi-value--loading" : ""
                    }`}
                  >
                    {kpisLoading ? "\u00A0" : kpi.value}
                  </p>
                  {kpi.hint && !kpisLoading ? (
                    <p className="kpi-hint">{kpi.hint}</p>
                  ) : null}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Accesos a módulos: solo en tablet/desktop; en móvil quedan las métricas */}
      <div className="row g-3 g-md-4 d-none d-md-flex">
        {visibleModules.map((module) => (
          <div className="col-12 col-sm-6 col-lg-4 col-xl-3" key={module.title}>
            <Link href={module.href} className="text-decoration-none">
              <div className="card h-100 module-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="card-title mb-0">{module.title}</h5>
                    <div className={`module-chip module-chip--${module.domain}`}>
                      <module.icon size={18} strokeWidth={1.75} aria-hidden />
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
