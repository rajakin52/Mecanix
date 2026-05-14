import * as XLSX from 'xlsx';

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Trigger a browser download of `rows` as a UTF-8 BOM CSV (opens cleanly
 * in Excel with accents preserved). `rows[0]` is the header.
 *
 * Prefer `downloadXlsx` for new code — produces a real Excel file that
 * preserves number types (no "01" → 1 nonsense) and skips Excel's CSV
 * import dialog.
 */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of `rows` as a real .xlsx (Excel) file.
 * `rows[0]` is the header. Numbers stay numbers, strings stay strings —
 * Excel respects the types and no CSV import dialog appears.
 *
 * @param filename — without extension (`.xlsx` is appended if missing)
 * @param rows — 2D array of cell values
 * @param sheetName — optional, defaults to "Report"
 */
export function downloadXlsx(
  filename: string,
  rows: unknown[][],
  sheetName = 'Report',
): void {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Auto-size columns (rough — uses content length, capped at 50 chars)
  const colWidths = (rows[0] ?? []).map((_, colIdx) => {
    const maxLen = rows.reduce((max, r) => {
      const v = r[colIdx];
      const len = v == null ? 0 : String(v).length;
      return len > max ? len : max;
    }, 0);
    return { wch: Math.min(50, Math.max(8, maxLen + 2)) };
  });
  ws['!cols'] = colWidths;

  // Strip any pre-existing .csv extension so legacy filenames like
  // 'report-2026-05-14.csv' still produce '.xlsx' output.
  const cleaned = filename.replace(/\.csv$/i, '');
  const name = cleaned.endsWith('.xlsx') ? cleaned : `${cleaned}.xlsx`;
  XLSX.writeFile(wb, name);
}
