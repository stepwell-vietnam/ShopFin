/**
 * ShopFin — Product Overview Excel Parser
 * 
 * Parses Shopee's "Product Overview" export file (productoverview*.xlsx)
 * Sheet name: "overview"
 * 
 * Key columns (Vietnamese):
 * - Ngày → date
 * - Lượt truy cập sản phẩm → visitors
 * - Lượt xem trang sản phẩm → pageViews
 * - Doanh số (Đơn đã đặt) (VND) → orderedSales (GMV)
 * - Doanh số (Đơn đã xác nhận) (VND) → confirmedSales
 */

import * as XLSX from 'xlsx';
import type { DailyProductData } from '@/types';

/** Parse VN formatted number: "8.622.294" → 8622294 */
function parseVNNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    // Vietnamese format uses dots as thousand separators
    const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/** Parse date: "01-01-2026" → "2026-01-01" */
function parseProductDate(dateStr: unknown): string {
    if (!dateStr) return '';
    const str = String(dateStr).trim();

    // Format: "DD-MM-YYYY"
    const match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    return str;
}

export interface ProductParseResult {
    dailyData: DailyProductData[];
    summary: {
        totalDays: number;
        totalPageViews: number;
        totalVisitors: number;
        totalConfirmedSales: number;
        totalOrderedSales: number;
    };
}

/**
 * Parse the Shopee Product Overview Excel file
 */
export async function parseProductFile(file: File): Promise<ProductParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) throw new Error('File không có sheet dữ liệu');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const dailyData: DailyProductData[] = [];
    let totalPageViews = 0;
    let totalVisitors = 0;
    let totalConfirmedSales = 0;
    let totalOrderedSales = 0;

    for (const row of rows) {
        const date = parseProductDate(row['Ngày']);
        if (!date) continue;

        const pageViews = parseVNNumber(row['Lượt xem trang sản phẩm']);
        const visitors = parseVNNumber(row['Lượt truy cập sản phẩm']);
        const confirmedSales = parseVNNumber(row['Doanh số (Đơn đã xác nhận) (VND)']);
        const orderedSales = parseVNNumber(row['Doanh số (Đơn đã đặt) (VND)']);

        dailyData.push({ date, pageViews, visitors, confirmedSales });

        totalPageViews += pageViews;
        totalVisitors += visitors;
        totalConfirmedSales += confirmedSales;
        totalOrderedSales += orderedSales;
    }

    // Sort by date
    dailyData.sort((a, b) => a.date.localeCompare(b.date));

    return {
        dailyData,
        summary: {
            totalDays: dailyData.length,
            totalPageViews,
            totalVisitors,
            totalConfirmedSales,
            totalOrderedSales,
        },
    };
}
