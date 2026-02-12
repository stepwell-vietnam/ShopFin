/**
 * ShopFin — Wallet Transaction Excel Parser
 * 
 * Parses Shopee's "Biến động tài khoản" / "Balance Transaction Report"
 * 
 * File structure (my_balance_transaction_report.shopee.*.xlsx):
 * - Sheet: "Transaction Report"
 * - Rows 0-9: Metadata (title, account info)
 * - Row 10: Summary header ("Tóm tắt")
 * - Row 11-12: Totals (income/expense)
 * - Row 15: "Chi tiết giao dịch"
 * - Row 17: Actual column headers:
 *     Ngày | Loại giao dịch | Chi tiết | Mã đơn hàng | Dòng tiền | Số tiền | Trạng thái | Số dư Ví sau giao dịch
 * - Row 18+: Transaction data
 */

import * as XLSX from 'xlsx';
import type { WalletTransaction, WalletTransactionType } from '@/types';

/** Parse VN formatted number */
function parseVNNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/** Detect transaction type from description and flow direction */
function detectTransactionType(description: string, flowDirection: string): WalletTransactionType {
    const lower = (description + ' ' + flowDirection).toLowerCase();
    if (lower.includes('quảng cáo') || lower.includes('ads') || lower.includes('nạp')) {
        return 'ads_expense';
    }
    if (lower.includes('rút') || lower.includes('chuyển tiền') || lower.includes('withdraw')) {
        return 'withdrawal';
    }
    if (lower.includes('doanh thu') || lower.includes('thu nhập') || lower.includes('tiền vào') || lower.includes('income')) {
        return 'income';
    }
    if (lower.includes('tiền ra')) {
        return 'withdrawal';
    }
    return 'other';
}

/** Parse date from various formats */
function parseWalletDate(dateStr: unknown): string {
    if (!dateStr) return '';
    const str = String(dateStr).trim();

    // "2026-01-31 23:49:07" → "2026-01-31"
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];

    // "31-01-2026" → "2026-01-31"
    const match2 = str.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (match2) return `${match2[3]}-${match2[2]}-${match2[1]}`;

    // "31/01/2026" → "2026-01-31"
    const match3 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match3) return `${match3[3]}-${match3[2]}-${match3[1]}`;

    return str;
}

export interface WalletParseResult {
    transactions: WalletTransaction[];
    summary: {
        totalIncome: number;
        totalAdsExpense: number;
        totalWithdrawal: number;
        netIncome: number;
    };
}

/**
 * Find the header row index by scanning for known column names
 */
function findHeaderRow(rawRows: unknown[][]): number {
    for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row)) continue;
        const joined = row.map(c => String(c || '').toLowerCase()).join(' ');
        if (joined.includes('ngày') && (joined.includes('số tiền') || joined.includes('giao dịch'))) {
            return i;
        }
    }
    return -1;
}

/**
 * Find the best matching column index from headers
 */
function findColIndex(headers: string[], patterns: string[]): number {
    for (let i = 0; i < headers.length; i++) {
        const lower = headers[i].toLowerCase();
        for (const pattern of patterns) {
            if (lower.includes(pattern)) return i;
        }
    }
    return -1;
}

/**
 * Parse the Shopee Wallet Transaction Excel file
 */
export async function parseWalletFile(file: File): Promise<WalletParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) throw new Error('File không có sheet dữ liệu');

    // Get raw rows (array of arrays) so we can find the real header
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    if (rawRows.length === 0) throw new Error('File không có dữ liệu');

    // Find the actual header row (may not be row 0)
    const headerRowIdx = findHeaderRow(rawRows);
    if (headerRowIdx === -1) throw new Error('Không tìm thấy header cột trong file');

    const headers = (rawRows[headerRowIdx] as unknown[]).map(h => String(h || ''));

    // Detect column indices
    const dateIdx = findColIndex(headers, ['ngày', 'date', 'thời gian']);
    const typeIdx = findColIndex(headers, ['loại giao dịch', 'loại', 'type']);
    const detailIdx = findColIndex(headers, ['chi tiết', 'mô tả', 'description', 'nội dung']);
    const flowIdx = findColIndex(headers, ['dòng tiền', 'flow']);
    const amountIdx = findColIndex(headers, ['số tiền', 'amount', 'giá trị']);

    const transactions: WalletTransaction[] = [];
    let totalIncome = 0;
    let totalAdsExpense = 0;
    let totalWithdrawal = 0;

    // Parse data rows (after header)
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i] as unknown[];
        if (!row || row.length === 0) continue;

        const date = dateIdx >= 0 ? parseWalletDate(row[dateIdx]) : '';
        const rawAmount = amountIdx >= 0 ? parseVNNumber(row[amountIdx]) : 0;
        const amount = Math.abs(rawAmount);
        const typeStr = typeIdx >= 0 ? String(row[typeIdx] || '') : '';
        const detail = detailIdx >= 0 ? String(row[detailIdx] || '') : '';
        const flow = flowIdx >= 0 ? String(row[flowIdx] || '') : '';

        if (!amount || !date) continue;

        const description = typeStr || detail;
        const type = detectTransactionType(description, flow);

        transactions.push({ date, type, amount, description });

        switch (type) {
            case 'income':
                totalIncome += amount;
                break;
            case 'ads_expense':
                totalAdsExpense += amount;
                break;
            case 'withdrawal':
                totalWithdrawal += amount;
                break;
        }
    }

    if (transactions.length === 0) {
        throw new Error('Không tìm thấy giao dịch trong file');
    }

    return {
        transactions,
        summary: {
            totalIncome,
            totalAdsExpense,
            totalWithdrawal,
            netIncome: totalIncome - totalAdsExpense,
        },
    };
}
