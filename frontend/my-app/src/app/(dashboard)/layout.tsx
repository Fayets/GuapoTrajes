"use client"

import { useAuth } from '@/context/auth-context'
import { Sidebar } from "@/components/ui/sidebar"
import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
<<<<<<< HEAD
import { cn } from "@/lib/utils"
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8

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
<<<<<<< HEAD
      <main className={cn("dashboard-content", sidebarCollapsed && "collapsed")}>{children}</main>
=======
      <main className="content-wrapper p-4">{children}</main>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
    </div>
  )
}
