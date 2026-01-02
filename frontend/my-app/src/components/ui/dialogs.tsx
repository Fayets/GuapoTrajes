"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
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
    <>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            open: isOpen,
            onOpenChange: handleOpenChange,
          })
        }
        return child
      })}
    </>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, open, onOpenChange, ...props }, ref) => {
    const handleClose = () => {
      onOpenChange?.(false)
    }

    if (!open) return null

    return (
      <>
        <div
          className={cn("modal fade show", className)}
          style={{ display: "block" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          ref={ref}
          {...props}
        >
          <div className="modal-dialog">
            <div className="modal-content">{children}</div>
          </div>
        </div>
        <div className="modal-backdrop fade show" onClick={handleClose}></div>
      </>
    )
  },
)
DialogContent.displayName = "DialogContent"

export const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("modal-header", className)} {...props} />,
)
DialogHeader.displayName = "DialogHeader"

export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h5 ref={ref} className={cn("modal-title", className)} {...props} />,
)
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-muted", className)} {...props} />,
)
DialogDescription.displayName = "DialogDescription"

export const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("modal-footer", className)} {...props} />,
)
DialogFooter.displayName = "DialogFooter"

