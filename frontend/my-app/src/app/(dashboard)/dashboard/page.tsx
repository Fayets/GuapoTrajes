import Link from "next/link";

export default function Dashboard() {
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
      title: "Ventas",
      description: "Venta de productos",
      icon: "bi-box",
      href: "/ventas",
      color: "bg-warning bg-opacity-10 text-warning",
    },
    {
      title: "Eventos",
      description: "Tipos de eventos",
      icon: "bi-box",
      href: "/eventos",
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
      title: "Sucursales",
      description: "Carga de sucursales",
      icon: "bi-building",
      href: "/sucursales",
      color: "bg-info bg-opacity-10 text-info",
    },
    {
      title: "Stock",
      description: "Control de inventario",
      icon: "bi-cart",
      href: "/stock",
      color: "bg-secondary bg-opacity-10 text-secondary",
    },
    {
      title: "Reportes",
      description: "Generación de reportes",
      icon: "bi-bar-chart",
      href: "/reportes",
      color: "bg-dark bg-opacity-10 text-dark",
    },

    {
      title: "Modista",
      description: "Gestión de modistas",
      icon: "bi-scissors",
      href: "/modista",
      color: "bg-dark bg-opacity-10 text-info",
    },

    {
      title: "Lavanderia",
      description: "Gestión de lavandería",
      icon: "bi-basket",
      href: "/lavanderia",
      color: "bg-dark bg-opacity-10 text-info",
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h1 className="fw-bold">Dashboard</h1>
        <p className="text-muted">
          Bienvenido al sistema de administración de Guapo Trajes
        </p>
      </div>

      <div className="row g-4">
        {modules.map((module) => (
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
