import ExcelJS from "exceljs";

export type ExcelCell = string | number | boolean | null | undefined;

/**
 * Genera un .xlsx desde filas (primera fila = encabezados) y dispara la descarga en el navegador.
 */
export async function downloadExcelFromAoA(
  fileNameBase: string,
  sheetName: string,
  rows: ExcelCell[][],
  columnWidth = 20
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Datos");

  rows.forEach((row) => {
    ws.addRow(row.map((c) => (c === null || c === undefined ? "" : c)));
  });

  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (let i = 1; i <= maxCols; i++) {
    ws.getColumn(i).width = columnWidth;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = fileNameBase.replace(/\.xlsx$/i, "");
  a.download = `${safe}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
