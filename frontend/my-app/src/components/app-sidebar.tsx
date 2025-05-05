"use client"

import { useAuth } from "@/context/auth-context"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSidebar } from "@/components/ui/sidebar" // Asegúrate de importar el hook

import {
  Sidebar, 
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Users,
  FileText,
  Clipboard,
  Package,
  Tag,
  DollarSign,
  BarChart3,
  ShoppingCart,
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export function AppSidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  // Obtén el estado del Sidebar y la función toggle desde el contexto
  const { collapsed, toggleSidebar } = useSidebar()

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
    },
    {
      title: "Clientes",
      icon: Users,
      href: "/clientes",
    },
    {
      title: "Presupuestos",
      icon: FileText,
      href: "/presupuestos",
    },
    {
      title: "Órdenes de trabajo",
      icon: Clipboard,
      href: "/ordenes",
    },
    {
      title: "Productos",
      icon: Package,
      href: "/productos",
    },
    {
      title: "Categorías",
      icon: Tag,
      href: "/categorias",
    },
    {
      title: "Caja diaria",
      icon: DollarSign,
      href: "/caja",
    },
    {
      title: "Stock",
      icon: ShoppingCart,
      href: "/stock",
    },
    {
      title: "Reportes",
      icon: BarChart3,
      href: "/reportes",
    },
  ]

  return (
    <Sidebar collapsed={collapsed} onToggle={toggleSidebar}> {/* Usa el contexto para collapsed y onToggle */}
      <SidebarHeader className="border-b py-4">
        <div className="flex items-center px-4">
          <h1 className="text-xl font-bold">Guapo Trajes</h1>
          <SidebarTrigger className="ml-auto" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5" />
          <span className="text-sm font-medium">{user?.name}</span>
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
