import * as React from "react"
import { cn } from "@/lib/utils"

// Componente Table
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => <table ref={ref} className={cn("table", className)} {...props} />,
)
Table.displayName = "Table"

// Componente TableHeader
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn(className)} {...props} />,
)
TableHeader.displayName = "TableHeader"

// Componente TableBody
const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />,
)
TableBody.displayName = "TableBody"

// Componente TableRow
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={cn(className)} {...props} />,
)
TableRow.displayName = "TableRow"

// Componente TableHead
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={cn(className)} {...props} />,
)
TableHead.displayName = "TableHead"

// Componente TableCell
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn(className)} {...props} />,
)
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }

