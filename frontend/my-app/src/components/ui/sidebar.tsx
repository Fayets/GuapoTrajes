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
      title: "Caja chica",
      icon: "bi-wallet2",
      href: "/caja-chica",
    },
    {
      title: "Caja concentradora",
      icon: "bi-bank",
      href: "/caja-concentradora",
      allow: ["ADMIN"],
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

  const userBranch = me?.sucursalNombre || "Sucursal no asignada";

  return (
    <aside className={cn("sidebar-modern", collapsed && "sidebar-modern-collapsed")}> 
      <div className="sidebar-modern-header">
        {!collapsed ? (
          <span className="sidebar-modern-logo">Guapo Trajes</span>
        ) : (
          <span className="sidebar-modern-logo">GT</span>
        )}
        <button
          className="sidebar-modern-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}></i>
        </button>
      </div>

      <nav className="sidebar-modern-nav">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              href={item.href}
              key={item.href}
              className={cn(
                "sidebar-modern-link",
                isActive && "active"
              )}
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
  );
}
