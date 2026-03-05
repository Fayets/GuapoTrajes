"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const [isOpen, setIsOpen] = React.useState(open || false)

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open)
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <div className={cn("sheet", isOpen && "sheet-open")}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            open: isOpen,
            onOpenChange: handleOpenChange,
          })
        }
        return child
      })}
    </div>
  )
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right" | "top" | "bottom"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = "right", open, onOpenChange, ...props }, ref) => {
    const handleClose = () => {
      onOpenChange?.(false)
    }

    // Mapear el lado a clases de Bootstrap para offcanvas
    const sideClass =
      side === "left"
        ? "offcanvas-start"
        : side === "right"
          ? "offcanvas-end"
          : side === "top"
            ? "offcanvas-top"
            : "offcanvas-bottom"

    return (
      <div ref={ref} className={cn("offcanvas", sideClass, open && "show", className)} tabIndex={-1} {...props}>
        <div className="offcanvas-header">
          <button type="button" className="btn-close text-reset" onClick={handleClose} aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">{children}</div>
        {open && <div className="offcanvas-backdrop fade show" onClick={handleClose}></div>}
      </div>
    )
  },
)
SheetContent.displayName = "SheetContent"

