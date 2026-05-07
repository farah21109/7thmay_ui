import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { WorkOrderItem } from './work-order.model';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {

  generateEstimateSheet(
    nameOfWork: string,
    savedItems: WorkOrderItem[],
    gstRate: number,
    gstAmount: number,
    grandTotal: number
  ): void {

    const wb = XLSX.utils.book_new();

    const materialItems    = savedItems.filter(i => i.isMaterial === 'Yes');
    const nonMaterialItems = savedItems.filter(i => i.isMaterial === 'No');
    const materialTotal    = materialItems.reduce((s, i) => s + i.amount, 0);
    const nonMaterialTotal = nonMaterialItems.reduce((s, i) => s + i.amount, 0);
    const abstractGrand    = materialTotal + nonMaterialTotal + gstAmount;

    // ── Sheet 1: Material ──────────────────────────────────────────
    this.addItemSheet(wb, 'Material Sheet', materialItems, materialTotal);

    // ── Sheet 2: Non-Material ──────────────────────────────────────
    this.addItemSheet(wb, 'Non-Material Sheet', nonMaterialItems, nonMaterialTotal);

    // ── Sheet 3: Abstract ─────────────────────────────────────────
    this.addAbstractSheet(wb, materialTotal, nonMaterialTotal, gstRate, gstAmount, abstractGrand);

    // ── Download ──────────────────────────────────────────────────
    const safeName = (nameOfWork || 'Work Order').trim();
    const fileName = `Estimate Sheet- ${safeName}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  private addItemSheet(
    wb: XLSX.WorkBook,
    sheetName: string,
    items: WorkOrderItem[],
    total: number
  ): void {

    const ws = XLSX.utils.aoa_to_sheet([]);

    // ── Header row ─────────────────────────────────────────────────
    const headers = [
      'Sl.No', 'Item Description', 'Numbers',
      'Length', 'Breadth', 'Depth',
      'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)'
    ];
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

    // ── Data rows ──────────────────────────────────────────────────
    const rows = items.map((item, idx) => [
      idx + 1,
      item.description,
      item.numbers,
      item.length  || '',
      item.breadth || '',
      item.depth   || '',
      item.quantity,
      item.unit,
      item.rate,
      item.amount
    ]);

    if (rows.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' });
    } else {
      XLSX.utils.sheet_add_aoa(ws, [['No items']], { origin: 'A2' });
    }

    // ── Total row ──────────────────────────────────────────────────
    const totalRowIdx = rows.length + 2; // 1-based, after header + data
    XLSX.utils.sheet_add_aoa(ws, [
      ['', '', '', '', '', '', '', '', 'Total Amount (₹)', total]
    ], { origin: `A${totalRowIdx}` });

    // ── Column widths ──────────────────────────────────────────────
    ws['!cols'] = [
      { wch: 7 },   // Sl.No
      { wch: 45 },  // Description
      { wch: 10 },  // Numbers
      { wch: 10 },  // Length
      { wch: 10 },  // Breadth
      { wch: 10 },  // Depth
      { wch: 12 },  // Quantity
      { wch: 8 },   // Unit
      { wch: 14 },  // Rate
      { wch: 14 },  // Amount
    ];

    // ── Cell styles ────────────────────────────────────────────────
    this.styleHeaderRow(ws, headers.length);
    this.styleTotalRow(ws, totalRowIdx, headers.length);
    this.styleDataRows(ws, 2, rows.length, headers.length);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  private addAbstractSheet(
    wb: XLSX.WorkBook,
    materialTotal: number,
    nonMaterialTotal: number,
    gstRate: number,
    gstAmount: number,
    abstractGrand: number
  ): void {

    const ws = XLSX.utils.aoa_to_sheet([]);

    const headers = ['Sl.No', 'Description', 'Amount (₹)'];
    const data = [
      [1, 'Material Items Total',          materialTotal],
      [2, 'Non-Material Items Total',       nonMaterialTotal],
      [3, `GST (${gstRate}%)`,             gstAmount],
      [4, 'LST',                            0],
    ];

    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, data, { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [
      ['', 'Grand Total', abstractGrand]
    ], { origin: `A${data.length + 2}` });

    ws['!cols'] = [
      { wch: 7 },
      { wch: 35 },
      { wch: 18 },
    ];

    this.styleHeaderRow(ws, 3);
    this.styleTotalRow(ws, data.length + 2, 3);
    this.styleDataRows(ws, 2, data.length, 3);

    XLSX.utils.book_append_sheet(wb, ws, 'Abstract');
  }

  // ── Styling helpers ────────────────────────────────────────────

  private styleHeaderRow(ws: XLSX.WorkSheet, colCount: number): void {
    const cols = 'ABCDEFGHIJ'.split('').slice(0, colCount);
    cols.forEach(col => {
      const cellRef = `${col}1`;
      if (!ws[cellRef]) return;
      ws[cellRef].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
        fill:      { fgColor: { rgb: '1565C0' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border:    this.thinBorder()
      };
    });
  }

  private styleDataRows(ws: XLSX.WorkSheet, startRow: number, rowCount: number, colCount: number): void {
    const cols = 'ABCDEFGHIJ'.split('').slice(0, colCount);
    for (let r = startRow; r < startRow + rowCount; r++) {
      const isEven = (r - startRow) % 2 === 1;
      cols.forEach((col, ci) => {
        const cellRef = `${col}${r}`;
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].s = {
          font:      { sz: 11, name: 'Arial' },
          fill:      { fgColor: { rgb: isEven ? 'EBF5FF' : 'FFFFFF' } },
          alignment: {
            horizontal: ci === 1 ? 'left' : (ci >= 8 ? 'right' : 'center'),
            vertical: 'center'
          },
          border: this.thinBorder()
        };
      });
    }
  }

  private styleTotalRow(ws: XLSX.WorkSheet, rowNum: number, colCount: number): void {
    const cols = 'ABCDEFGHIJ'.split('').slice(0, colCount);
    cols.forEach(col => {
      const cellRef = `${col}${rowNum}`;
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].s = {
        font:      { bold: true, sz: 12, name: 'Arial', color: { rgb: '1B5E20' } },
        fill:      { fgColor: { rgb: 'C8E6C9' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border:    this.thinBorder()
      };
    });
  }

  private thinBorder() {
    const side = { style: 'thin', color: { rgb: 'CCCCCC' } };
    return { top: side, bottom: side, left: side, right: side };
  }
}
