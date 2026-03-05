"use client"

import { useAuth } from '@/context/auth-context'
import { Sidebar } from "@/components/ui/sidebar"
import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const SIDEBAR_BREAKPOINT = 992

export default function DashboardPage({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const router = useRouter()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT - 1}px)`)
    const handler = () => {
      setIsMobile(mql.matches)
      if (!mql.matches) setMobileOpen(false)
    }
    handler()
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (!token) {
      router.push('/login')
    }
  }, [token])

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev)
  }

  if (!token) return null

  return (
    <div className="d-flex">
      {isMobile && (
        <button
          type="button"
          className="dashboard-mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <i className="bi bi-list" aria-hidden />
        </button>
      )}
      {isMobile && (
        <div
          className={cn("sidebar-backdrop", mobileOpen && "is-open")}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        toggleSidebar={handleToggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className={cn("dashboard-content", sidebarCollapsed && "collapsed")}>{children}</main>
    </div>
  )
}
