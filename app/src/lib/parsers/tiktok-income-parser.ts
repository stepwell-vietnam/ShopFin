import * as XLSX from 'xlsx';
import type { ProgressCallback } from './income-parser';

// ==========================================
// Types for TikTok Income Report
// ==========================================

export interface TikTokReportSummary {
    timePeriod: string;
    timezone: string;
    currency: string;

    // Top-level
    totalSettlement: number;
    totalRevenue: number;
    totalFees: number;
    totalAdjustments: number;

    // Revenue breakdown
    subtotalAfterDiscount: number;
    subtotalBeforeDiscount: number;
    sellerDiscounts: number;
    refundAfterDiscount: number;
    refundBeforeDiscount: number;
    refundOfDiscount: number;

    // Fee breakdown
    transactionFee: number;
    commissionFee: number;
    sellerShippingFee: number;
    actualShippingFee: number;
    platformShippingDiscount: number;
    customerShippingFee: number;
    returnShippingFee: number;
    refundedCustomerShipping: number;
    sfrReimbursement: number;
    failedDeliverySubsidy: number;
    shippingSubsidy: number;
    affiliateCommission: number;
    affiliateCommissionBeforePIT: number;
    affiliatePIT: number;
    affiliateShopAds: number;
    affiliateShopAdsBeforePIT: number;
    affiliateShopAdsPIT: number;
    affiliatePartnerCommission: number;
    affiliateCommissionDeposit: number;
    affiliateCommissionRefund: number;
    affiliatePartnerShopAds: number;
    sfpServiceFee: number;
    bonusCashbackFee: number;
    liveSpecialsFee: number;
    voucherXtraFee: number;
    orderProcessingFee: number;
    eamsServiceFee: number;
    flashSaleFee: number;
    vatWithheld: number;
    pitWithheld: number;
    tikTokPayLaterFee: number;
    campaignResourceFee: number;
    sfrServiceFee: number;

    // Adjustments breakdown
    shippingFeeAdjustment: number;
    shippingFeeCompensation: number;
    chargeback: number;
    customerServiceCompensation: number;
    promotionAdjustment: number;
    platformCompensation: number;
    platformPenalty: number;
    sampleShippingFee: number;
    logisticsReimbursement: number;
    platformReimbursement: number;
    deductionsBySeller: number;
    shippingFeeRebate: number;
    warehouseServiceFee: number;
    platformCommissionAdjustment: number;
    platformCommissionCompensation: number;
    transactionFeeAdjustment: number;
    campaignPackage: number;
    additionalCampaignPackage: number;
    gmvPaymentPromote: number;
    gmvPaymentTikTokAds: number;
    campaignResourceFeeCompensation: number;
    otherAdjustment: number;
}

export interface TikTokOrderRecord {
    orderId: string;
    type: string;              // "Order" | "Adjustment"
    orderCreatedTime: string;
    orderSettledTime: string;
    currency: string;
    totalSettlement: number;
    totalRevenue: number;
    subtotalAfterDiscount: number;
    subtotalBeforeDiscount: number;
    sellerDiscounts: number;
    refundAfterDiscount: number;
    refundBeforeDiscount: number;
    refundOfDiscount: number;
    totalFees: number;
    transactionFee: number;
    commissionFee: number;
    sellerShippingFee: number;
    actualShippingFee: number;
    platformShippingDiscount: number;
    customerShippingFee: number;
    returnShippingFee: number;
    // Extended fields
    affiliateCommission: number;
    affiliateShopAds: number;
    voucherXtraFee: number;
    orderProcessingFee: number;
    // Tax fields
    vatWithheld: number;
    pitWithheld: number;
}

export interface TikTokWithdrawal {
    type: string;
    referenceId: string;
    requestTime: string;
    amount: number;
    status: string;
    successTime: string;
    bankAccount: string;
}

export interface TikTokIncomeResult {
    summary: TikTokReportSummary;
    orders: TikTokOrderRecord[];
    withdrawals: TikTokWithdrawal[];
}

// ==========================================
// Helpers
// ==========================================

function toNum(val: unknown): number {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

// ==========================================
// Parse "Reports" sheet (tree-structured)
// ==========================================

function parseReportsSheet(sheet: XLSX.WorkSheet): TikTokReportSummary {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    // Helper: get value from col F (index 5) at a given row
    const val = (rowIdx: number): number => {
        const r = rows[rowIdx];
        return r ? toNum(r[5]) : 0;
    };
    const str = (rowIdx: number): string => {
        const r = rows[rowIdx];
        return r ? toStr(r[5]) : '';
    };

    return {
        timePeriod: str(1),
        timezone: str(2),
        currency: str(3),

        totalSettlement: val(5),
        totalRevenue: val(6),
        totalFees: val(13),
        totalAdjustments: val(47),

        // Revenue
        subtotalAfterDiscount: val(7),
        subtotalBeforeDiscount: val(8),
        sellerDiscounts: val(9),
        refundAfterDiscount: val(10),
        refundBeforeDiscount: val(11),
        refundOfDiscount: val(12),

        // Fees
        transactionFee: val(14),
        commissionFee: val(15),
        sellerShippingFee: val(16),
        actualShippingFee: val(17),
        platformShippingDiscount: val(18),
        customerShippingFee: val(19),
        returnShippingFee: val(20),
        refundedCustomerShipping: val(21),
        sfrReimbursement: val(22),
        failedDeliverySubsidy: val(23),
        shippingSubsidy: val(24),
        affiliateCommission: val(25),
        affiliateCommissionBeforePIT: val(26),
        affiliatePIT: val(27),
        affiliateShopAds: val(28),
        affiliateShopAdsBeforePIT: val(29),
        affiliateShopAdsPIT: val(30),
        affiliatePartnerCommission: val(31),
        affiliateCommissionDeposit: val(32),
        affiliateCommissionRefund: val(33),
        affiliatePartnerShopAds: val(34),
        sfpServiceFee: val(35),
        bonusCashbackFee: val(36),
        liveSpecialsFee: val(37),
        voucherXtraFee: val(38),
        orderProcessingFee: val(39),
        eamsServiceFee: val(40),
        flashSaleFee: val(41),
        vatWithheld: val(42),
        pitWithheld: val(43),
        tikTokPayLaterFee: val(44),
        campaignResourceFee: val(45),
        sfrServiceFee: val(46),

        // Adjustments
        shippingFeeAdjustment: val(48),
        shippingFeeCompensation: val(49),
        chargeback: val(50),
        customerServiceCompensation: val(51),
        promotionAdjustment: val(52),
        platformCompensation: val(53),
        platformPenalty: val(54),
        sampleShippingFee: val(55),
        logisticsReimbursement: val(56),
        platformReimbursement: val(57),
        deductionsBySeller: val(58),
        shippingFeeRebate: val(59),
        warehouseServiceFee: val(60),
        platformCommissionAdjustment: val(61),
        platformCommissionCompensation: val(62),
        transactionFeeAdjustment: val(63),
        campaignPackage: val(64),
        additionalCampaignPackage: val(65),
        gmvPaymentPromote: val(66),
        gmvPaymentTikTokAds: val(67),
        campaignResourceFeeCompensation: val(68),
        otherAdjustment: val(69),
    };
}

// ==========================================
// Parse "Order details" sheet
// ==========================================

function parseOrderDetailsSheet(sheet: XLSX.WorkSheet): TikTokOrderRecord[] {
    // TikTok export bug: sheet['!ref'] may be truncated (e.g. 'A1:U2')
    // but actual data extends much further. Auto-detect the real range.
    if (sheet['!ref']) {
        const decoded = XLSX.utils.decode_range(sheet['!ref']);
        // Scan column A to find the actual last row with data
        let lastRow = decoded.e.r;
        for (let r = decoded.e.r + 1; r < 100000; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
            if (!cell || cell.v == null) { lastRow = r - 1; break; }
            lastRow = r;
        }
        // Also scan header row to find actual last column
        let lastCol = decoded.e.c;
        for (let c = decoded.e.c + 1; c < 100; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
            if (!cell || cell.v == null) break;
            lastCol = c;
        }
        if (lastRow > decoded.e.r || lastCol > decoded.e.c) {
            decoded.e.r = Math.max(decoded.e.r, lastRow);
            decoded.e.c = Math.max(decoded.e.c, lastCol);
            sheet['!ref'] = XLSX.utils.encode_range(decoded);
        }
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const records: TikTokOrderRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        records.push({
            orderId: toStr(r[0]),
            type: toStr(r[1]),
            orderCreatedTime: toStr(r[2]),
            orderSettledTime: toStr(r[3]),
            currency: toStr(r[4]),
            totalSettlement: toNum(r[5]),
            totalRevenue: toNum(r[6]),
            subtotalAfterDiscount: toNum(r[7]),
            subtotalBeforeDiscount: toNum(r[8]),
            sellerDiscounts: toNum(r[9]),
            refundAfterDiscount: toNum(r[10]),
            refundBeforeDiscount: toNum(r[11]),
            refundOfDiscount: toNum(r[12]),
            totalFees: toNum(r[13]),
            transactionFee: toNum(r[14]),
            commissionFee: toNum(r[15]),
            sellerShippingFee: toNum(r[16]),
            actualShippingFee: toNum(r[17]),
            platformShippingDiscount: toNum(r[18]),
            customerShippingFee: toNum(r[19]),
            returnShippingFee: toNum(r[20]),
            // Extended fields
            affiliateCommission: toNum(r[25]),
            affiliateShopAds: toNum(r[28]),
            voucherXtraFee: toNum(r[38]),
            orderProcessingFee: toNum(r[39]),
            // Tax fields
            vatWithheld: toNum(r[42]),
            pitWithheld: toNum(r[43]),
        });
    }

    return records;
}

// ==========================================
// Parse "Withdrawal records" sheet
// ==========================================

function parseWithdrawalSheet(sheet: XLSX.WorkSheet): TikTokWithdrawal[] {
    // TikTok export bug: sheet['!ref'] may be truncated (same as Order details).
    // Auto-detect the real range by scanning column A.
    if (sheet['!ref']) {
        const decoded = XLSX.utils.decode_range(sheet['!ref']);
        let lastRow = decoded.e.r;
        for (let r = decoded.e.r + 1; r < 100000; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
            if (!cell || cell.v == null) { lastRow = r - 1; break; }
            lastRow = r;
        }
        if (lastRow > decoded.e.r) {
            decoded.e.r = lastRow;
            sheet['!ref'] = XLSX.utils.encode_range(decoded);
        }
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const records: TikTokWithdrawal[] = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        records.push({
            type: toStr(r[0]),
            referenceId: toStr(r[1]),
            requestTime: toStr(r[2]),
            amount: toNum(r[3]),
            status: toStr(r[4]),
            successTime: toStr(r[5]),
            bankAccount: toStr(r[6]),
        });
    }

    return records;
}

// ==========================================
// Main parser
// ==========================================

export async function parseTikTokIncomeExcel(
    file: File,
    onProgress?: ProgressCallback
): Promise<TikTokIncomeResult> {
    const report = onProgress || (() => { });

    report(5, 'Đang đọc file Excel...');
    const buffer = await file.arrayBuffer();
    await new Promise(r => setTimeout(r, 0));

    report(15, 'Đang phân tích cấu trúc...');
    const workbook = XLSX.read(buffer, { type: 'array' });
    await new Promise(r => setTimeout(r, 0));

    // Parse Reports sheet
    report(30, 'Đang đọc báo cáo tổng hợp...');
    const reportsSheet = workbook.Sheets['Reports'];
    if (!reportsSheet) throw new Error('Không tìm thấy sheet "Reports" trong file TikTok Income');
    const summary = parseReportsSheet(reportsSheet);
    await new Promise(r => setTimeout(r, 0));

    // Parse Order details
    report(60, 'Đang xử lý chi tiết đơn hàng...');
    const orderSheet = workbook.Sheets['Order details'];
    const orders = orderSheet ? parseOrderDetailsSheet(orderSheet) : [];
    await new Promise(r => setTimeout(r, 0));

    // Parse Withdrawals
    report(85, 'Đang đọc lịch sử rút tiền...');
    const withdrawalSheet = workbook.Sheets['Withdrawal records'];
    const withdrawals = withdrawalSheet ? parseWithdrawalSheet(withdrawalSheet) : [];

    report(100, 'Hoàn tất!');
    return { summary, orders, withdrawals };
}
