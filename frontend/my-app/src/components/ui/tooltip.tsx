"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

export function TooltipProvider({ children, delayDuration = 300 }: TooltipProviderProps) {
  return <div data-tooltip-delay={delayDuration}>{children}</div>
}

interface TooltipProps {
  children: React.ReactNode
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

export const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      // Cuando asChild es true, no podemos usar ref ni className en Fragment
      return <React.Fragment {...props}>{children}</React.Fragment>
    }

    return (
      <div ref={ref} className={cn("tooltip-trigger", className)} {...props}>
        {children}
      </div>
    )
  },
)
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  hidden?: boolean
}

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", align = "center", hidden = false, ...props }, ref) => {
    if (hidden) return null

    // Mapear side y align a clases de Bootstrap para tooltips
    const placement = side === "top" ? "top" : side === "right" ? "end" : side === "bottom" ? "bottom" : "start"

    return (
      <div
        ref={ref}
        className={cn("tooltip bs-tooltip-auto", `bs-tooltip-${placement}`, hidden && "d-none", className)}
        role="tooltip"
        data-popper-placement={placement}
        {...props}
      >
        <div className="tooltip-arrow"></div>
        <div className="tooltip-inner">{props.children}</div>
      </div>
    )
  },
)
TooltipContent.displayName = "TooltipContent"

