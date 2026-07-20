"use client";

import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

const SIDEBAR_BREAKPOINT = 992;

const habilitarEtiquetasMigracion =
  process.env.NEXT_PUBLIC_HABILITAR_ETIQUETAS_MIGRACION !== "false";

interface SidebarProps {
  collapsed: boolean;
  toggleSidebar: () => void;
  /** En tablet/móvil: sidebar visible como overlay */
  mobileOpen?: boolean;
  /** En tablet/móvil: cerrar sidebar (ej. al tocar backdrop) */
  onMobileClose?: () => void;
}

type Rol = "ADMIN" | "EMPLEADO" | "SUPER_ADMIN";

interface SubMenuItem {
  title: string;
  icon: string;
  href: string;
  allow?: Rol[];
}

interface MenuItem {
  title: string;
  icon: string;
  href?: string;
  allow?: Rol[]; // si no se define, se muestra a ambos roles
  subItems?: SubMenuItem[]; // subitems para menús anidados
}

export function Sidebar({ collapsed, toggleSidebar, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { me, logout, loading } = useAuth();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => setFlyoutGroup(null), [pathname]);

  useEffect(() => {
    if (!flyoutGroup) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const el = flyoutRef.current;
      if (el && !el.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest?.(".sidebar-modern")) setFlyoutGroup(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [flyoutGroup]);

  const menuItems: MenuItem[] = [
    { title: "Dashboard", icon: "bi-grid", href: "/dashboard" },
    { title: "Preclientes", icon: "bi-people", href: "/preclientes" },
    { title: "Clientes", icon: "bi-people", href: "/clientes" },
    { title: "Productos", icon: "bi-box", href: "/productos" },
    ...(habilitarEtiquetasMigracion
      ? [
          {
            title: "Etiquetas inventario",
            icon: "bi-upc-scan",
            href: "/etiquetas-inventario",
            allow: ["ADMIN", "EMPLEADO"] as Rol[],
          },
        ]
      : []),
    { title: "Presupuestos", icon: "bi-file-text", href: "/presupuestos" },
    { title: "Órdenes de trabajo", icon: "bi-clipboard", href: "/ordenes" },
    { title: "Contratos", icon: "bi-file-earmark-text", href: "/contratos" },
    {
      title: "Devoluciones",
      icon: "bi-arrow-return-left",
      href: "/devoluciones",
    },
    { title: "Ventas", icon: "bi-cash", href: "/ventas" },
    { title: "Caja diaria", icon: "bi-cash", href: "/caja" },
    { title: "Caja chica", icon: "bi-wallet2", href: "/caja-chica" },
    {
      title: "Caja concentradora",
      icon: "bi-bank",
      href: "/caja-concentradora",
      allow: ["ADMIN"],
    },
    {
      title: "Reportes",
      icon: "bi-bar-chart",
      href: "/reportes",
      allow: ["ADMIN", "EMPLEADO"],
    },
    {
      title: "Ajustes",
      icon: "bi-gear",
      allow: ["ADMIN", "SUPER_ADMIN", "EMPLEADO"],
      subItems: [
        {
          title: "Eventos",
          icon: "bi-calendar-event",
          href: "/eventos",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
        {
          title: "Modista",
          icon: "bi-scissors",
          href: "/modista",
          allow: ["ADMIN", "SUPER_ADMIN", "EMPLEADO"],
        },
        {
          title: "Lavanderia",
          icon: "bi-basket",
          href: "/lavanderia",
          allow: ["ADMIN", "SUPER_ADMIN", "EMPLEADO"],
        },
        {
          title: "Sucursales",
          icon: "bi-building",
          href: "/sucursales",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
        {
          title: "Cuentas Destino",
          icon: "bi-wallet",
          href: "/cuentas-destino",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
        {
          title: "Métodos de Pago",
          icon: "bi-credit-card",
          href: "/metodos-pago",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
        {
          title: "Productos",
          icon: "bi-box-seam",
          href: "/configuraciones/productos",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
        {
          title: "Usuarios",
          icon: "bi-people-fill",
          href: "/usuarios",
          allow: ["ADMIN", "SUPER_ADMIN"],
        },
      ],
    },
    {
      title: "Auditoría",
      icon: "bi-person-lines-fill",
      href: "/auditoria",
      allow: ["ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Logs del sistema",
      icon: "bi-file-text",
      href: "/logs",
      allow: ["SUPER_ADMIN"],
    },
  ];

  // Expandir automáticamente items que tienen subitems activos
  useEffect(() => {
    const checkActiveSubItems = () => {
      setExpandedItems((prev) => {
        const newSet = new Set(prev);
        menuItems.forEach((item) => {
          if (item.subItems && item.subItems.some((subItem) => pathname === subItem.href)) {
            newSet.add(item.title);
          }
        });
        return newSet;
      });
    };
    checkActiveSubItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  if (loading) return null;

  const role = me?.role;
  const visibleItems = menuItems.filter((item) =>
    item.allow ? (role ? item.allow.includes(role) : false) : true
  );

  const userBranch = me?.sucursalNombre || "Sucursal no asignada";

  return (
    <aside
      className={cn(
        "sidebar-modern",
        collapsed && "sidebar-modern-collapsed",
        isMobile && "sidebar-modern-mobile",
        isMobile && !mobileOpen && "sidebar-modern-mobile-closed"
      )}
    >
      <div className="sidebar-modern-header">
        {!collapsed ? (
          <span className="sidebar-modern-logo">Guapo Trajes</span>
        ) : (
          <span className="sidebar-modern-logo">GT</span>
        )}

        {isMobile ? (
          <button
            type="button"
            className="sidebar-modern-toggle"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
          >
            <i className="bi bi-x-lg" />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-modern-toggle"
            onClick={toggleSidebar}
            aria-label="Contraer o expandir barra lateral"
          >
            <i
              className={`bi ${
                collapsed ? "bi-chevron-right" : "bi-chevron-left"
              }`}
            />
          </button>
        )}
      </div>

      {/* ÁREA SCROLLEABLE */}
      <nav className="sidebar-modern-nav sidebar-modern-nav-scroll">
        {visibleItems.map((item) => {
          // Si tiene subitems, renderizar como menú desplegable
          if (item.subItems && item.subItems.length > 0) {
            const hasVisibleSubItems = item.subItems.some((subItem) =>
              subItem.allow
                ? me?.role && subItem.allow.includes(me.role)
                : true
            );

            if (!hasVisibleSubItems) return null;

            const isExpanded = expandedItems.has(item.title);
            const hasActiveSubItem = item.subItems.some(
              (subItem) => pathname === subItem.href
            );

            const showFlyout = collapsed && flyoutGroup === item.title;
            const visibleSubItems = item.subItems.filter((subItem) =>
              subItem.allow ? me?.role && subItem.allow.includes(me.role) : true
            );

            return (
              <div key={item.title} className="sidebar-modern-group">
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      setFlyoutGroup((prev) => (prev === item.title ? null : item.title));
                    } else {
                      toggleExpanded(item.title);
                    }
                  }}
                  className={cn(
                    "sidebar-modern-link sidebar-modern-link-group",
                    showFlyout && "sidebar-modern-link-group-flyout-open"
                  )}
                  aria-expanded={!collapsed ? isExpanded : showFlyout}
                  aria-haspopup="true"
                >
                  <i className={cn("bi", item.icon)}></i>
                  <span>{item.title}</span>
                  {!collapsed && (
                    <i
                      className={cn(
                        "bi sidebar-modern-chevron",
                        isExpanded ? "bi-chevron-down" : "bi-chevron-right"
                      )}
                    ></i>
                  )}
                  {collapsed && (
                    <i className="bi bi-chevron-right sidebar-modern-chevron"></i>
                  )}
                </button>
                {!collapsed && isExpanded && (
                  <div className="sidebar-modern-submenu">
                    {visibleSubItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          href={subItem.href}
                          key={subItem.href}
                          className={cn(
                            "sidebar-modern-link sidebar-modern-sublink",
                            isSubActive && "active"
                          )}
                          onClick={onMobileClose}
                        >
                          <i className={cn("bi", subItem.icon)}></i>
                          <span>{subItem.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {collapsed && showFlyout && (
                  <div
                    ref={flyoutRef}
                    className="sidebar-modern-flyout"
                    role="menu"
                  >
                    {visibleSubItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          href={subItem.href}
                          key={subItem.href}
                          className={cn(
                            "sidebar-modern-link sidebar-modern-sublink",
                            isSubActive && "active"
                          )}
                          role="menuitem"
                          onClick={() => setFlyoutGroup(null)}
                        >
                          <i className={cn("bi", subItem.icon)}></i>
                          <span>{subItem.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Item normal sin subitems
          const isActive = pathname === item.href;
          return (
            <Link
              href={item.href || "#"}
              key={item.href || item.title}
              className={cn("sidebar-modern-link", isActive && "active")}
              onClick={onMobileClose}
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
