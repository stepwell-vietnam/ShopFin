/**
 * ShopFin — File Type Auto-Detector
 * 
 * Detects the type of uploaded file based on:
 * 1. File extension
 * 2. Filename patterns
 * 3. Excel sheet names and column headers
 */

import type { FileType } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Detect the file type from a File object
 */
export async function detectFileType(file: File): Promise<FileType | null> {
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop();

    // Only Excel/CSV supported now
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        return await detectExcelType(file);
    }

    return null;
}

/**
 * Detect Excel file type by analyzing sheets, filename, and column headers
 */
async function detectExcelType(file: File): Promise<FileType | null> {
    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 20 });

        const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) return null;

        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 });
        const fileName = file.name.toLowerCase();

        // 1. Income report: has "Summary" and "Doanh thu" sheets
        if (sheetNames.includes('summary') && sheetNames.includes('doanh thu')) return 'income';
        if (fileName.includes('income')) return 'income';

        // 2. Wallet / Balance transaction
        if (fileName.includes('balance_transaction') || fileName.includes('wallet') || fileName.includes('giao_dich') || fileName.includes('bien_dong')) return 'wallet';

        // 3. Orders
        if (fileName.includes('order.all') || fileName.includes('order_all')) return 'orders';

        // 4. Products
        if (fileName.includes('productoverview') || fileName.includes('product_overview')) return 'products';

        // Sheet name fallback
        if (sheetNames.some(s => s === 'orders' || s.includes('đơn hàng'))) return 'orders';
        if (sheetNames.some(s => s === 'overview' || s.includes('sản phẩm'))) return 'products';
        if (sheetNames.some(s => s.includes('transaction') || s.includes('giao dịch') || s.includes('ví'))) return 'wallet';

        // Header content fallback
        for (const row of rows) {
            const headerStr = (row || []).map(h => String(h).toLowerCase()).join(' ');
            if (headerStr.includes('mã đơn hàng') || headerStr.includes('trạng thái đơn hàng')) return 'orders';
            if (headerStr.includes('lượt truy cập sản phẩm') || headerStr.includes('lượt xem trang sản phẩm')) return 'products';
            if (headerStr.includes('loại giao dịch') || headerStr.includes('dòng tiền') || headerStr.includes('số dư ví')) return 'wallet';
        }

        // Generic filename fallback
        if (fileName.includes('order')) return 'orders';
        if (fileName.includes('product') || fileName.includes('overview')) return 'products';

        return null;
    } catch {
        return null;
    }
}

/**
 * Get human-readable label for file type
 */
export function getFileTypeLabel(type: FileType): string {
    const labels: Record<FileType, string> = {
        income: 'Báo cáo Thu nhập (Excel)',
        orders: 'Đơn hàng (Excel)',
        products: 'Sản phẩm (Excel)',
        wallet: 'Giao dịch Ví (Excel)',
    };
    return labels[type];
}

/**
 * Get accepted file extensions
 */
export function getAcceptedExtensions(): string {
    return '.xlsx,.xls,.csv';
}
