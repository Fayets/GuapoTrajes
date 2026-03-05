import * as React from "react"
import { cn } from "@/lib/utils"

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border",
          orientation === "horizontal" ? "border-top w-100 my-2" : "border-start h-100 mx-2",
          className,
        )}
        {...props}
      />
    )
  },
)
Separator.displayName = "Separator"

