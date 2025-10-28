"use client";

import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  toggleSidebar: () => void;
}

type Rol = "ADMIN" | "EMPLEADO";

interface MenuItem {
  title: string;
  icon: string;
  href: string;
  allow?: Rol[]; // si no se define, se muestra a ambos roles
}

export function Sidebar({ collapsed, toggleSidebar }: SidebarProps) {
  const { me, logout, loading } = useAuth();
  const pathname = usePathname();

  const menuItems = [
    {
      title: "Dashboard",
      icon: "bi-grid",
      href: "/dashboard",
    },
    {
      title: "Clientes",
      icon: "bi-people",
      href: "/clientes",
    },
    {
      title: "Preclientes",
      icon: "bi-people",
      href: "/preclientes",
    },
    {
      title: "Presupuestos",
      icon: "bi-file-text",
      href: "/presupuestos",
    },
    {
      title: "Órdenes de trabajo",
      icon: "bi-clipboard",
      href: "/ordenes",
    },
    {
      title: "Ventas",
      icon: "bi-cash",
      href: "/ventas",
    },
    {
      title: "Eventos",
      icon: "bi-clipboard",
      href: "/eventos",
      allow: ["ADMIN"],
    },
    {
      title: "Productos",
      icon: "bi-box",
      href: "/productos",
    },
    {
      title: "Caja diaria",
      icon: "bi-cash",
      href: "/caja",
    },
    {
      title: "Stock",
      icon: "bi-cart",
      href: "/stock",
    },
    {
      title: "Sucursales",
      icon: "bi-building",
      href: "/sucursales",
      allow: ["ADMIN"],
    },
    {
      title: "Reportes",
      icon: "bi-bar-chart",
      href: "/reportes",
      allow: ["ADMIN"],
    },

    {
      title: "Modista",
      icon: "bi-basket",
      href: "/modista",
      allow: ["ADMIN"],
    },
    {
      title: "Lavanderia",
      icon: "bi-scissors",
      href: "/lavanderia",
      allow: ["ADMIN"],
    },
  ];
  // Mientras carga /auth/me, no renderizamos
  if (loading) return null;

  const role = me?.role; // ya normalizado en tu AuthContext
  const visibleItems = menuItems.filter((item) =>
    item.allow ? (role ? item.allow.includes(role) : false) : true
  );

  return (
    <div
      className={cn(
        "sidebar d-flex flex-column",
        collapsed && "sidebar-collapsed"
      )}
    >
      <div className="sidebar-header d-flex align-items-center">
        <h5 className="mb-0 fw-bold">Guapo Trajes</h5>
        <button
          className="btn btn-link text-white ms-auto p-0"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <i
            className={`bi ${
              collapsed ? "bi-arrow-right-square" : "bi-arrow-left-square"
            }`}
          ></i>
        </button>
      </div>

      <ul className="nav flex-column mt-3">
        {visibleItems.map((item) => (
          <li className="nav-item" key={item.href}>
            <Link
              href={item.href}
              className={`nav-link ${pathname === item.href ? "active" : ""}`}
            >
              <i className={`bi ${item.icon}`}></i>
              <span>{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer mt-auto">
        <div className="d-flex align-items-center mb-3">
          <i className="bi bi-person-circle"></i>
          <span className="ms-2">{me?.role}</span>
        </div>
        <button className="btn btn-outline-light w-100" onClick={logout}>
          <i className="bi bi-box-arrow-right me-2"></i>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
