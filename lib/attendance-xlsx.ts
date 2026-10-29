/**
 * Excel-native XLSX export built with ExcelJS rather than a handwritten ZIP/OOXML package.
 * Runs only in Node.js API routes. All input values are saved as literals, never as formulas.
 */
import ExcelJS from 'exceljs';

export type XCell = string | number | null | undefined;
export type XSheet = {
  name: string;
  title: string;
  subtitle: string;
  note?: string;
  columns: { label: string; width: number }[];
  rows: XCell[][];
  totals?: XCell[];
  statusColumns?: number[];
  numericColumns?: number[];
};

type Paint = {fill: string; text: string};

const BLACK = '17283F';
const NAVY = '152940';
const BLUE = '2859B3';
const SOFT = 'F0F5FB';
const BORDER = 'E3EBF5';

function paintForStatus(value: XCell): Paint | null {
  const status = String(value ?? '').trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (['PRESENT', 'ON-SITE', 'APPROVED', 'LEAVE', 'WEEKLY-OFF'].includes(status)) {
    return {fill: 'E8F7F0', text: '187046'};
  }
  if (['ABSENT', 'OFF-SITE', 'REJECTED'].includes(status)) {
    return {fill: 'FDE9E9', text: 'AB3232'};
  }
  if (['HALF-DAY', 'LATE', 'MISSING-CHECKOUT', 'IN-PROGRESS', 'PENDING'].includes(status)) {
    return {fill: 'FFF1DB', text: '966213'};
  }
  return null;
}

/** Prevent Excel from trying to parse invalid control chars or non-text cell objects. */
function safeValue(value: XCell): string | number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');
  if (!text) return null;
  // ExcelJS stores ordinary strings as shared/inline strings; it does not interpret them as formulas.
  return text.length <= 32767 ? text : text.slice(0, 32767);
}

function fill(argb: string): ExcelJS.Fill {
  return {type: 'pattern', pattern: 'solid', fgColor: {argb: `FF${argb}`}};
}

function applySheet(workbook: ExcelJS.Workbook, sheet: XSheet, index: number): void {
  const width = sheet.columns.length;
  const sanitized = sheet.name.replace(/[\\/:?*\[\]]/g, '').slice(0, 31) || `Sheet ${index + 1}`;
  const worksheet = workbook.addWorksheet(sanitized, {
    views: [{state: 'frozen', ySplit: 6, showGridLines: false}],
    pageSetup: {fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape', paperSize: 9},
    properties: {defaultRowHeight: 21},
  });

  sheet.columns.forEach((column, colIndex) => {
    worksheet.getColumn(colIndex + 1).width = Math.max(11, Math.min(43, Number(column.width) || 17));
  });

  const setMerged = (startRow: number, endRow: number, text: string, color: string, size: number, bold: boolean, rowHeight: number) => {
    if (width > 1 || endRow > startRow) worksheet.mergeCells(startRow, 1, endRow, width);
    const cell = worksheet.getCell(startRow, 1);
    cell.value = safeValue(text);
    cell.fill = fill(color);
    cell.font = {name: 'Aptos', size, bold, color: {argb: bold && color === NAVY ? 'FFFFFFFF' : `FF${BLACK}`}};
    cell.alignment = {vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1};
    worksheet.getRow(startRow).height = rowHeight;
  };

  setMerged(1, 2, sheet.title, NAVY, 18, true, 30);
  setMerged(3, 3, sheet.subtitle, 'EAF1FB', 11, true, 29);
  setMerged(4, 4, sheet.note || 'All times use India Standard Time (IST).', 'F3F6FB', 10, false, 46);

  const header = worksheet.getRow(6);
  header.height = 34;
  sheet.columns.forEach((col, j) => {
    const cell = header.getCell(j + 1);
    cell.value = safeValue(col.label);
    cell.fill = fill(BLUE);
    cell.font = {name: 'Aptos', size: 10, bold: true, color: {argb: 'FFFFFFFF'}};
    cell.alignment = {vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true};
  });

  sheet.rows.forEach((values, i) => {
    const row = worksheet.getRow(i + 7);
    row.height = 25;
    for (let j = 0; j < width; j++) {
      const value = safeValue(values[j]);
      const cell = row.getCell(j + 1);
      cell.value = value;
      const stripe = i % 2 === 0 ? 'FFFFFF' : SOFT;
      cell.fill = fill(stripe);
      cell.font = {name: 'Aptos', size: 10, bold: j === 0, color: {argb: `FF${BLACK}`}};
      cell.alignment = {vertical: 'middle', horizontal: sheet.numericColumns?.includes(j) ? 'center' : 'left', indent: sheet.numericColumns?.includes(j) ? 0 : 1};
      cell.border = {bottom: {style: 'hair', color: {argb: `FF${BORDER}`}}};
      if (sheet.numericColumns?.includes(j) && typeof value === 'number') cell.numFmt = '#,##0';
      if (sheet.statusColumns?.includes(j)) {
        const statusPaint = paintForStatus(value);
        if (statusPaint) {
          cell.fill = fill(statusPaint.fill);
          cell.font = {name: 'Aptos', size: 10, bold: true, color: {argb: `FF${statusPaint.text}`}};
          cell.alignment = {vertical: 'middle', horizontal: 'center'};
        }
      }
    }
  });

  if (sheet.totals) {
    const last = worksheet.getRow(8 + sheet.rows.length);
    last.height = 29;
    for (let j = 0; j < width; j++) {
      const cell = last.getCell(j + 1);
      cell.value = safeValue(sheet.totals[j]);
      cell.fill = fill(NAVY);
      cell.font = {name: 'Aptos', size: 10, bold: true, color: {argb: 'FFFFFFFF'}};
      cell.alignment = {vertical: 'middle', horizontal: sheet.numericColumns?.includes(j) ? 'center' : 'left', indent: 1};
      if (sheet.numericColumns?.includes(j)) cell.numFmt = '#,##0';
    }
  }

  if (sheet.rows.length > 0) {
    worksheet.autoFilter = {from: {row: 6, column: 1}, to: {row: 6 + sheet.rows.length, column: width}};
  }
  worksheet.views = [{state: 'frozen', ySplit: 6, showGridLines: false}];
}

/** Two-sheet monthly and single-sheet daily exports share the same standards-based writer. */
export async function createAttendanceWorkbook(sheets: XSheet[]): Promise<Buffer> {
  if (!sheets.length || sheets.length > 6) throw Error('Invalid worksheet count.');
  for (const sheet of sheets) {
    if (sheet.columns.length < 1 || sheet.columns.length > 25 || sheet.rows.length > 25000) {
      throw Error('Spreadsheet export exceeds the permitted range.');
    }
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Work Mate';
  workbook.lastModifiedBy = 'Work Mate';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = false;
  sheets.forEach((sheet, index) => applySheet(workbook, sheet, index));
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

export function istDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(instant).replace(',', '');
}

export function istToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}
