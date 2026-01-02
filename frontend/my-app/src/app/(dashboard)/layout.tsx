"use client"

import { useAuth } from '@/context/auth-context'
import { Sidebar } from "@/components/ui/sidebar"
import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function DashboardPage({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const router = useRouter()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev)
  }

  useEffect(() => {
    if (!token) {
      router.push('/login')
    }
  }, [token])

  if (!token) return null // o spinner si preferís

  return (
    <div className="d-flex">
      <Sidebar collapsed={sidebarCollapsed} toggleSidebar={handleToggleSidebar} />
      <main className={cn("dashboard-content", sidebarCollapsed && "collapsed")}>{children}</main>
    </div>
  )
}
