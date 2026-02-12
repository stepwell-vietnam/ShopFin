import * as XLSX from 'xlsx';
import type { ProgressCallback } from './income-parser';

// ==========================================
// ShopeeOrder — parsed from Order.all Excel
// ==========================================
export interface ShopeeOrder {
    orderId: string;
    packageId: string;
    orderDate: string;          // "2026-01-01 00:01"
    status: string;             // "Hoàn thành", "Đã hủy", etc.
    isBestSeller: boolean;
    cancelReason: string;
    buyerComment: string;
    trackingNumber: string;
    carrier: string;
    shippingMethod: string;
    orderType: string;
    expectedDelivery: string;
    shippedDate: string;
    deliveredDate: string;
    returnStatus: string;

    // Product
    sku: string;
    productName: string;
    productWeight: number;
    totalWeight: number;
    warehouse: string;
    variantSku: string;
    variantName: string;

    // Pricing
    originalPrice: number;
    sellerDiscount: number;
    shopeeDiscount: number;
    totalDiscount: number;
    salePrice: number;
    quantity: number;
    returnQuantity: number;
    totalProductPrice: number;
    totalOrderValue: number;

    // Vouchers / Promotions
    shopVoucher: number;
    coinCashback: number;
    shopeeVoucher: number;
    comboDiscount: number;
    shopeeComboDiscount: number;
    shopComboDiscount: number;
    shopeeCoinReturn: number;
    debitCardDiscount: number;
    tradeInDiscount: number;
    tradeInBonus: number;

    // Shipping
    estimatedShippingFee: number;
    tradeInBonusSeller: number;
    buyerShippingFee: number;
    shopeeShippingSubsidy: number;
    returnShippingFee: number;
    totalBuyerPaid: number;

    // Timestamps
    completedTime: string;
    paidTime: string;
    paymentMethod: string;

    // Fees
    fixedFee: number;
    serviceFee: number;
    paymentFee: number;
    deposit: number;

    // Customer
    buyerUsername: string;
    recipientName: string;
    phone: string;
    province: string;
    district: string;
    ward: string;
    address: string;
    country: string;
    note: string;
}

export interface OrderParseResult {
    orders: ShopeeOrder[];
    totalRows: number;
}

// ==========================================
// Column mapping (0-indexed)
// ==========================================
function toNum(val: unknown): number {
    if (!val) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

export async function parseOrderExcel(file: File, onProgress?: ProgressCallback): Promise<OrderParseResult> {
    const report = onProgress || (() => { });

    report(5, 'Đang đọc file Excel...');
    const buffer = await file.arrayBuffer();
    await new Promise(r => setTimeout(r, 0));

    report(15, 'Đang phân tích cấu trúc...');
    const wb = XLSX.read(buffer, { type: 'array' });
    await new Promise(r => setTimeout(r, 0));

    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('Không tìm thấy sheet trong file');

    report(30, 'Đang đọc dữ liệu...');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (rows.length < 2) throw new Error('File không có dữ liệu');
    await new Promise(r => setTimeout(r, 0));

    const orders: ShopeeOrder[] = [];
    const totalRows = rows.length - 1;

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        // Report progress every 500 rows
        if (i % 500 === 0) {
            const pct = 30 + Math.round((i / totalRows) * 65);
            report(pct, `Đang xử lý đơn hàng (${i.toLocaleString()}/${totalRows.toLocaleString()})...`);
            await new Promise(r => setTimeout(r, 0));
        }

        // Normalize status — group "Người mua xác nhận..." into "Đã nhận hàng"
        let status = toStr(r[3]);
        if (status.startsWith('Người mua xác nhận')) status = 'Đã nhận hàng';

        orders.push({
            orderId: toStr(r[0]),
            packageId: toStr(r[1]),
            orderDate: toStr(r[2]),
            status,
            isBestSeller: toStr(r[4]) === 'Y',
            cancelReason: toStr(r[5]),
            buyerComment: toStr(r[6]),
            trackingNumber: toStr(r[7]),
            carrier: toStr(r[8]),
            shippingMethod: toStr(r[9]),
            orderType: toStr(r[10]),
            expectedDelivery: toStr(r[11]),
            shippedDate: toStr(r[12]),
            deliveredDate: toStr(r[13]),
            returnStatus: toStr(r[14]),

            sku: toStr(r[15]),
            productName: toStr(r[16]),
            productWeight: toNum(r[17]),
            totalWeight: toNum(r[18]),
            warehouse: toStr(r[19]),
            variantSku: toStr(r[20]),
            variantName: toStr(r[21]),

            originalPrice: toNum(r[22]),
            sellerDiscount: toNum(r[23]),
            shopeeDiscount: toNum(r[24]),
            totalDiscount: toNum(r[25]),
            salePrice: toNum(r[26]),
            quantity: toNum(r[27]),
            returnQuantity: toNum(r[28]),
            totalProductPrice: toNum(r[29]),
            totalOrderValue: toNum(r[30]),

            shopVoucher: toNum(r[31]),
            coinCashback: toNum(r[32]),
            shopeeVoucher: toNum(r[33]),
            comboDiscount: toNum(r[34]),
            shopeeComboDiscount: toNum(r[35]),
            shopComboDiscount: toNum(r[36]),
            shopeeCoinReturn: toNum(r[37]),
            debitCardDiscount: toNum(r[38]),
            tradeInDiscount: toNum(r[39]),
            tradeInBonus: toNum(r[40]),

            estimatedShippingFee: toNum(r[41]),
            tradeInBonusSeller: toNum(r[42]),
            buyerShippingFee: toNum(r[43]),
            shopeeShippingSubsidy: toNum(r[44]),
            returnShippingFee: toNum(r[45]),
            totalBuyerPaid: toNum(r[46]),

            completedTime: toStr(r[47]),
            paidTime: toStr(r[48]),
            paymentMethod: toStr(r[49]),

            fixedFee: toNum(r[50]),
            serviceFee: toNum(r[51]),
            paymentFee: toNum(r[52]),
            deposit: toNum(r[53]),

            buyerUsername: toStr(r[54]),
            recipientName: toStr(r[55]),
            phone: toStr(r[56]),
            province: toStr(r[57]),
            district: toStr(r[58]),
            ward: toStr(r[59]),
            address: toStr(r[60]),
            country: toStr(r[61]),
            note: toStr(r[62]),
        });
    }

    report(100, 'Hoàn tất!');
    return { orders, totalRows: rows.length - 1 };
}
