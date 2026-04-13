import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, value, ...props }, ref) => {
  const normalizedValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string"
      ? value
      : value === undefined || value === null
      ? ""
      : String(value)

  return <input type={type} className={cn("form-control", className)} ref={ref} value={normalizedValue} {...props} />
})
Input.displayName = "Input"

export { Input }

