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

<<<<<<< HEAD
  const menuItems: MenuItem[] = [
    { title: "Dashboard", icon: "bi-grid", href: "/dashboard" },
    { title: "Clientes", icon: "bi-people", href: "/clientes" },
    { title: "Preclientes", icon: "bi-people", href: "/preclientes" },
    { title: "Presupuestos", icon: "bi-file-text", href: "/presupuestos" },
    { title: "Órdenes de trabajo", icon: "bi-clipboard", href: "/ordenes" },
    { title: "Ventas", icon: "bi-cash", href: "/ventas" },
=======
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
    {
      title: "Eventos",
      icon: "bi-clipboard",
      href: "/eventos",
      allow: ["ADMIN"],
    },
<<<<<<< HEAD
    { title: "Productos", icon: "bi-box", href: "/productos" },
    { title: "Caja diaria", icon: "bi-cash", href: "/caja" },
    { title: "Caja chica", icon: "bi-wallet2", href: "/caja-chica" },
    {
      title: "Caja concentradora",
      icon: "bi-bank",
      href: "/caja-concentradora",
      allow: ["ADMIN"],
=======
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
    { title: "Modista", icon: "bi-basket", href: "/modista", allow: ["ADMIN"] },
=======

    {
      title: "Modista",
      icon: "bi-basket",
      href: "/modista",
      allow: ["ADMIN"],
    },
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
    {
      title: "Lavanderia",
      icon: "bi-scissors",
      href: "/lavanderia",
      allow: ["ADMIN"],
    },
  ];
<<<<<<< HEAD

  if (loading) return null;

  const role = me?.role;
=======
  // Mientras carga /auth/me, no renderizamos
  if (loading) return null;

  const role = me?.role; // ya normalizado en tu AuthContext
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  const visibleItems = menuItems.filter((item) =>
    item.allow ? (role ? item.allow.includes(role) : false) : true
  );

<<<<<<< HEAD
  const userBranch = me?.sucursalNombre || "Sucursal no asignada";

  return (
    <aside
      className={cn("sidebar-modern", collapsed && "sidebar-modern-collapsed")}
    >
      <div className="sidebar-modern-header">
        {!collapsed ? (
          <span className="sidebar-modern-logo">Guapo Trajes</span>
        ) : (
          <span className="sidebar-modern-logo">GT</span>
        )}

        <button
          className="sidebar-modern-toggle"
=======
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <i
            className={`bi ${
<<<<<<< HEAD
              collapsed ? "bi-chevron-right" : "bi-chevron-left"
=======
              collapsed ? "bi-arrow-right-square" : "bi-arrow-left-square"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            }`}
          ></i>
        </button>
      </div>

<<<<<<< HEAD
      {/* ÁREA SCROLLEABLE */}
      <nav className="sidebar-modern-nav sidebar-modern-nav-scroll">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              href={item.href}
              key={item.href}
              className={cn("sidebar-modern-link", isActive && "active")}
            >
              <i className={cn("bi", item.icon)}></i>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-modern-footer">
        <div className="sidebar-modern-user">
          <span className="sidebar-modern-bullet">
            <i className="bi bi-building"></i>
          </span>
          <div className="sidebar-modern-user-details">
            <p className="sidebar-modern-user-branch">{userBranch}</p>
            <p className="sidebar-modern-user-role">{me?.role || ""}</p>
          </div>
        </div>
        <button className="sidebar-modern-logout" onClick={logout}>
          <i className="bi bi-box-arrow-right"></i>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
=======
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  );
}
