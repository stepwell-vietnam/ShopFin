/**
 * ShopFin — Income Excel Parser
 * 
 * Parses Shopee's detailed income report Excel file:
 * - Sheet "Summary": Monthly totals (revenue, fees, taxes)
 * - Sheet "Doanh thu": Per-order income records (~2000 rows)
 * - Sheet "Adjustment": Refund/adjustment transactions
 * - Sheet "Service Fee Details": Per-order fee breakdown
 * 
 * This replaces the PDF parser for better accuracy and detail.
 */

import * as XLSX from 'xlsx';
import type {
    IncomeReport,
    IncomeOrderRecord,
    DailyIncome,
    AdjustmentRecord,
} from '@/types';

// ==========================================
// Helper functions
// ==========================================

/** Safely parse a number from any cell value */
function toNum(val: unknown): number {
    if (val === null || val === undefined || val === '' || val === '-') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/[₫đ,\s]/gi, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/** Find a labeled value in summary rows.
 * Summary sheet layout:
 *   Main items: row[0]="1. Tổng doanh thu", row[3]=244085570
 *   Sub-items:  row[1]="Giá gốc", row[2]=370654000
 *   Categories:  row[0]="Phụ phí", row[3]=-69412643
 */
function findSummaryValue(rows: unknown[][], label: string): number {
    for (const row of rows) {
        if (!row) continue;
        // Check each cell for the label
        for (let c = 0; c < (row.length || 0); c++) {
            if (row[c] && String(row[c]).includes(label)) {
                // Found the label! Now find the numeric value:
                // Main items (col 0) → value in col 3
                // Sub-items (col 1) → value in col 2
                // Try rightmost numeric value first (most reliable)
                for (let v = (row.length || 0) - 1; v > c; v--) {
                    const num = toNum(row[v]);
                    if (num !== 0 || String(row[v]) === '0') return num;
                }
                // Fallback: next cell after label
                return toNum(row[c + 1]);
            }
        }
    }
    return 0;
}

/** Find a labeled string in summary rows */
function findSummaryString(rows: unknown[][], label: string): string {
    for (const row of rows) {
        if (row && row[0] && String(row[0]).includes(label)) {
            return String(row[1] || '');
        }
    }
    return '';
}

// ==========================================
// Parse Summary Sheet
// ==========================================

function parseSummarySheet(sheet: XLSX.WorkSheet): IncomeReport {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    return {
        shopName: findSummaryString(rows, 'Người Bán'),
        period: {
            from: findSummaryString(rows, 'Từ'),
            to: findSummaryString(rows, 'Đến'),
        },

        // Revenue
        totalRevenue: findSummaryValue(rows, '1. Tổng doanh thu'),
        productTotal: findSummaryValue(rows, 'Tổng hàng hóa'),
        originalPrice: findSummaryValue(rows, 'Giá gốc'),
        sellerDiscount: findSummaryValue(rows, 'Số tiền bạn trợ giá'),
        refundAmount: findSummaryValue(rows, 'Số tiền hoàn lại'),

        // Discounts
        totalDiscounts: findSummaryValue(rows, 'Mã giảm giá'),
        sellerCoupon: findSummaryValue(rows, 'Mã ưu đãi do Người Bán chịu'),

        // Costs
        totalCosts: findSummaryValue(rows, '2. Tổng chi phí'),

        // Shipping
        shippingBuyerPaid: findSummaryValue(rows, 'Phí vận chuyển Người mua trả'),
        shippingActual: findSummaryValue(rows, 'Phí vận chuyển thực tế'),
        shippingShopeeSubsidy: findSummaryValue(rows, 'Phí vận chuyển được trợ giá từ Shopee'),
        shippingReturn: findSummaryValue(rows, 'Phí vận chuyển trả hàng (đơn Trả hàng/hoàn tiền)'),
        shippingPiship: findSummaryValue(rows, 'Phí vận chuyển được hoàn bởi PiShip'),

        // Transaction fees
        fixedFee: findSummaryValue(rows, 'Phí cố định'),
        serviceFee: findSummaryValue(rows, 'Phí Dịch Vụ'),
        paymentFee: findSummaryValue(rows, 'Phí thanh toán'),
        affiliateFee: findSummaryValue(rows, 'Phí hoa hồng Tiếp thị liên kết'),
        pishipFee: findSummaryValue(rows, 'Phí dịch vụ PiShip'),
        totalFees: findSummaryValue(rows, 'Phụ phí'),

        // Tax
        vatTax: findSummaryValue(rows, 'Thuế GTGT'),
        pitTax: findSummaryValue(rows, 'Thuế TNCN'),
        totalTax: findSummaryValue(rows, 'Thuế'),

        // Final
        netRevenue: findSummaryValue(rows, '3. Tổng số tiền'),
    };
}

// ==========================================
// Parse "Doanh thu" Sheet (per-order)
// ==========================================

function parseDoanhThuSheet(sheet: XLSX.WorkSheet): IncomeOrderRecord[] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const records: IncomeOrderRecord[] = [];

    // Header is in row index 2 (row 0 = group header, row 1 = sub header, row 2 = column names)
    // Data starts at row index 3
    // Columns based on actual file structure:
    // [0] STT, [1] Order/Sku, [2] Mã đơn hàng, [3] Mã số thuế, [4] Mã yêu cầu hoàn tiền,
    // [5] Mã sản phẩm, [6] Tên sản phẩm, [7] Ngày đặt hàng, [8] Ngày hoàn thành TT,
    // [9] PTTT, [10] Loại đơn hàng, [11] Sản phẩm Bán Chạy,
    // [12] Tổng tiền đã TT, [13] Giá SP, [14] Số tiền hoàn lại,
    // [15] Phí VC Người mua, [16] Phí VC thực tế, [17] Phí VC trợ giá Shopee,
    // [18] Phí VC trả hàng, [19] Phí VC PiShip, [20] Phí VC giao không thành công,
    // [21] SP trợ giá Shopee, [22] Mã ưu đãi Người Bán, ...
    // [26] Phí cố định, [27] Phí Dịch Vụ, [28] Phí thanh toán,
    // [29] Phí hoa hồng TTLK, [30] Phí dịch vụ PiShip,
    // [31] Mức Nạp Tiền, [32] Thuế GTGT, [33] Thuế TNCN

    for (let i = 3; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        const rowType = String(r[1] || '');
        // Only process "Order" rows (skip "Sku" duplicates)
        if (rowType !== 'Order') continue;

        const record: IncomeOrderRecord = {
            transactionId: toNum(r[0]),
            rowType: 'Order',
            orderId: String(r[2] || ''),
            productId: undefined,
            productName: undefined,
            orderDate: formatExcelDate(r[7]),
            paymentDate: formatExcelDate(r[8]),
            paymentMethod: String(r[9] || ''),
            orderType: String(r[10] || ''),

            totalPaid: toNum(r[12]),
            productPrice: toNum(r[13]),
            refund: toNum(r[14]),

            shippingBuyerPaid: toNum(r[15]),
            shippingActual: toNum(r[16]),
            shippingShopeeSubsidy: toNum(r[17]),
            shippingReturn: toNum(r[18]),
            shippingPiship: toNum(r[19]),
            shippingFailedDelivery: toNum(r[20]),

            fixedFee: toNum(r[26]),
            serviceFee: toNum(r[27]),
            paymentFee: toNum(r[28]),
            affiliateFee: toNum(r[29]),
            pishipServiceFee: toNum(r[30]),

            vatTax: toNum(r[32]),
            pitTax: toNum(r[33]),
        };

        records.push(record);
    }

    return records;
}

/** Format Excel date (could be serial number or string) */
function formatExcelDate(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(val);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    const str = String(val);
    // Already ISO-like format
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10);
    return str;
}

// ==========================================
// Aggregate to Daily Income
// ==========================================

export function aggregateDailyIncome(records: IncomeOrderRecord[]): DailyIncome[] {
    const byDate: Record<string, DailyIncome> = {};

    for (const r of records) {
        const date = r.paymentDate || r.orderDate;
        if (!date) continue;

        if (!byDate[date]) {
            byDate[date] = {
                date,
                orderCount: 0,
                productPrice: 0,
                refund: 0,
                netProductRevenue: 0,
                fixedFee: 0,
                serviceFee: 0,
                paymentFee: 0,
                affiliateFee: 0,
                pishipFee: 0,
                totalFees: 0,
                vatTax: 0,
                pitTax: 0,
                totalTax: 0,
                totalPayment: 0,
            };
        }

        const d = byDate[date];
        d.orderCount++;
        d.productPrice += r.productPrice;
        d.refund += r.refund;
        d.fixedFee += r.fixedFee;
        d.serviceFee += r.serviceFee;
        d.paymentFee += r.paymentFee;
        d.affiliateFee += r.affiliateFee;
        d.pishipFee += r.pishipServiceFee;
        d.vatTax += r.vatTax;
        d.pitTax += r.pitTax;
        d.totalPayment += r.totalPaid;
    }

    // Calculate derived totals
    for (const d of Object.values(byDate)) {
        d.netProductRevenue = d.productPrice + d.refund;
        d.totalFees = d.fixedFee + d.serviceFee + d.paymentFee + d.affiliateFee + d.pishipFee;
        d.totalTax = d.vatTax + d.pitTax;
    }

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ==========================================
// Parse Adjustment Sheet
// ==========================================

function parseAdjustmentSheet(sheet: XLSX.WorkSheet): AdjustmentRecord[] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const records: AdjustmentRecord[] = [];

    // Data rows start after "Chi tiết danh sách giao dịch điều chỉnh" header
    // Columns: [0] STT, [1] Ngày, [2] Loại, [3] Lý do, [4] Số tiền, [5] Mã đơn liên quan, [6] Ngày TT
    let dataStarted = false;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;

        // Find data header row
        if (String(r[0] || '').includes('Mã giao dịch')) {
            dataStarted = true;
            continue;
        }

        if (!dataStarted) continue;

        // Stop at total row
        if (String(r[0] || '').includes('Tổng cộng')) break;

        if (typeof r[0] !== 'number') continue;

        records.push({
            date: formatExcelDate(r[1]),
            type: String(r[2] || ''),
            amount: toNum(r[4]),
            relatedOrderId: String(r[5] || ''),
        });
    }

    return records;
}

// ==========================================
// Main Export Function
// ==========================================

export interface IncomeParseResult {
    summary: IncomeReport;
    orders: IncomeOrderRecord[];
    dailyIncome: DailyIncome[];
    adjustments: AdjustmentRecord[];
}

export type ProgressCallback = (percent: number, message: string) => void;

export async function parseIncomeExcel(
    file: File,
    onProgress?: ProgressCallback
): Promise<IncomeParseResult> {
    const report = onProgress || (() => { });

    // Phase 1: Read file (0-30%)
    report(5, 'Đang đọc file Excel...');
    const buffer = await file.arrayBuffer();
    await new Promise(r => setTimeout(r, 0)); // yield to UI

    report(10, 'Đang phân tích cấu trúc...');
    const workbook = XLSX.read(buffer, { type: 'array' });
    await new Promise(r => setTimeout(r, 0));

    // Phase 2: Parse Summary (30%)
    report(30, 'Đang đọc bảng tổng hợp...');
    const summarySheet = workbook.Sheets['Summary'];
    if (!summarySheet) throw new Error('Không tìm thấy sheet "Summary" trong file Income');
    const summary = parseSummarySheet(summarySheet);
    await new Promise(r => setTimeout(r, 0));

    // Phase 3: Parse all "Doanh thu" sheets (30-80%)
    const doanhThuSheetNames = workbook.SheetNames.filter(n => n.startsWith('Doanh thu'));
    if (doanhThuSheetNames.length === 0) {
        throw new Error('Không tìm thấy sheet "Doanh thu" trong file Income');
    }

    let orders: IncomeOrderRecord[] = [];
    const sheetRange = 50; // 30% to 80%
    for (let i = 0; i < doanhThuSheetNames.length; i++) {
        const name = doanhThuSheetNames[i];
        const pct = 30 + Math.round((i / doanhThuSheetNames.length) * sheetRange);
        report(pct, `Đang xử lý ${name} (${i + 1}/${doanhThuSheetNames.length})...`);
        orders = orders.concat(parseDoanhThuSheet(workbook.Sheets[name]));
        await new Promise(r => setTimeout(r, 0));
    }

    // Phase 4: Aggregate (80-90%)
    report(80, `Đang tổng hợp ${orders.length.toLocaleString()} đơn hàng...`);
    const dailyIncome = aggregateDailyIncome(orders);
    await new Promise(r => setTimeout(r, 0));

    // Phase 5: Parse Adjustments (90-100%)
    report(90, 'Đang xử lý điều chỉnh...');
    const adjustmentSheetNames = workbook.SheetNames.filter(n => n.startsWith('Adjustment'));
    let adjustments: AdjustmentRecord[] = [];
    for (const name of adjustmentSheetNames) {
        adjustments = adjustments.concat(parseAdjustmentSheet(workbook.Sheets[name]));
    }

    report(100, 'Hoàn tất!');
    return { summary, orders, dailyIncome, adjustments };
}

