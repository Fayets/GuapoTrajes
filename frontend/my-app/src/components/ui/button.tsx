import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark"
    | "link"
    | "outline"
    | "ghost"
  size?: "sm" | "md" | "lg"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button"

    // Mapear variantes a clases de Bootstrap
    const variantClass =
      variant === "ghost"
        ? "btn-link text-dark text-decoration-none"
        : variant === "outline"
          ? "btn-outline-primary"
          : `btn-${variant}`

    // Mapear tamaños a clases de Bootstrap
    const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : ""

    return <Comp className={cn("btn", variantClass, sizeClass, className)} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button }

