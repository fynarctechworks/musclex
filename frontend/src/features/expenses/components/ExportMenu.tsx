"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExportExpenses, type ExportExpensesInput } from "@/features/payments";

interface ExportMenuProps {
  filters: Omit<ExportExpensesInput, "format">;
}

export function ExportMenu({ filters }: ExportMenuProps) {
  const exportMut = useExportExpenses();
  const handle = (format: "csv" | "xlsx") =>
    exportMut.mutate({ format, ...filters });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 border-border text-foreground"
          disabled={exportMut.isPending}
        >
          <Download className="h-4 w-4" />
          {exportMut.isPending ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => handle("csv")}>
          <FileText className="mr-2 h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("xlsx")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
