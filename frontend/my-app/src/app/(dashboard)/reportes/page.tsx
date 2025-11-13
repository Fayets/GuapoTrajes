"use client";
import { useMemo, useState } from "react";
import { ClipboardList, Shirt, History, Users, FileText, Receipt, CircleDollarSign, Boxes, ListOrdered, CircleAlert } from "lucide-react";

const metodosPago: never[] = [];

export default function ReportesPage() {
  const [selectedReporte, setSelectedReporte] = useState<string>("ingresos_por_tipo");

  const reportTiles = useMemo(
    () => [
      {
        key: "alquileres_por_prenda",
        title: "Alquileres por prenda",
        desc: "Cantidad alquilada en una fecha",
        icon: Shirt,
      },
      {
        key: "ranking_alquileres",
        title: "Ranking de alquileres",
        desc: "De más a menos alquilado",
        icon: ListOrdered,
      },
      {
        key: "contratos_por_fecha",
        title: "Contratos por fecha",
        desc: "Listado de contratos",
        icon: FileText,
      },
      {
        key: "recibos_por_fecha",
        title: "Recibos por fecha",
        desc: "Listado de recibos emitidos",
        icon: Receipt,
      },
      {
        key: "ingresos_por_tipo",
        title: "Ingresos por tipo",
        desc: "Efectivo, tarjetas y por fecha",
        icon: CircleDollarSign,
      },
      {
        key: "stock_estado",
        title: "Stock por estado",
        desc: "Salón, clientes, modista, lavandería",
        icon: Boxes,
      },
      {
        key: "stock_por_linea",
        title: "Stock por línea",
        desc: "Valorizado a costo y venta",
        icon: ClipboardList,
      },
      {
        key: "trazabilidad_producto",
        title: "Histórico producto",
        desc: "Trazabilidad por fechas",
        icon: History,
      },
      {
        key: "saldos_clientes",
        title: "Saldos a cobrar",
        desc: "Saldos de clientes por fecha",
        icon: Users,
      },
      {
        key: "conjuntos_a_armar",
        title: "Conjuntos a armar",
        desc: "Listado por fecha",
        icon: ClipboardList,
      },
      {
        key: "ordenes_produccion",
        title: "Órdenes de producción",
        desc: "Entre fechas",
        icon: ClipboardList,
      },
      {
        key: "no_devolvieron",
        title: "No devolvieron",
        desc: "Clientes pendientes por fecha",
        icon: CircleAlert,
      },
      {
        key: "productos_criticos",
        title: "Productos críticos",
        desc: "Indisponibles entre fechas",
        icon: Boxes,
      },
    ],
    []
  );

  // placeholder para mantener compatibilidad si se reutiliza en el futuro

  return (
    <div className="p-3 p-md-4">
      <div className="mb-4">
        <h1 className="fw-bold">Reportes</h1>
        <p className="text-muted">Elegí un reporte para ver o exportar.</p>
      </div>
      <div className="row g-2 align-items-stretch">
        {reportTiles.map(({ key, title, desc, icon: Icon }) => (
          <div key={key} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <button
              onClick={() => setSelectedReporte(key)}
              className={`card text-start h-100 w-100 ${selectedReporte === key ? 'border-primary' : ''}`}
            >
              <div className="card-body d-flex align-items-start gap-2">
                <div className="p-2 rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
                  <Icon />
                </div>
                <div className="d-flex flex-column justify-content-between flex-grow-1" style={{ minHeight: 52 }}>
                  <div className="fw-semibold lh-sm">{title}</div>
                  <div className="small text-muted lh-sm">{desc}</div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
      <style jsx>{`
        .card { transition: box-shadow .15s ease; }
        .card:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.05); }
      `}</style>
    </div>
  );
}

