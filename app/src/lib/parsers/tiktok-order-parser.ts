import * as XLSX from 'xlsx';
import type { ProgressCallback } from './income-parser';

// ==========================================
// TikTokOrder — parsed from Order SKU List Excel
// ==========================================
export interface TikTokOrder {
    orderId: string;
    status: string;           // "Đã vận chuyển", "Đã hủy", etc.
    substatus: string;        // "Đã giao", "Đã hủy", etc.
    cancelReturnType: string; // "Cancel", "Return", ""
    normalOrPreorder: string;

    // SKU Info
    skuId: string;
    sellerSku: string;
    productName: string;
    variation: string;
    quantity: number;
    returnQuantity: number;

    // Pricing
    unitOriginalPrice: number;
    subtotalBeforeDiscount: number;
    platformDiscount: number;
    sellerDiscount: number;
    subtotalAfterDiscount: number;

    // Shipping
    shippingFeeAfterDiscount: number;
    originalShippingFee: number;
    shippingFeeSellerDiscount: number;
    shippingFeePlatformDiscount: number;

    // Payment & Tax
    paymentPlatformDiscount: number;
    taxes: number;
    orderAmount: number;
    orderRefundAmount: number;

    // Timestamps
    createdTime: string;
    paidTime: string;
    rtsTime: string;
    shippedTime: string;
    deliveredTime: string;
    cancelledTime: string;

    // Cancel Info
    cancelBy: string;
    cancelReason: string;

    // Fulfillment & Shipping
    fulfillmentType: string;
    warehouseName: string;
    trackingId: string;
    deliveryOption: string;
    shippingProviderName: string;

    // Buyer Info
    buyerMessage: string;
    buyerUsername: string;
    recipient: string;
    phone: string;
    country: string;
    province: string;
    district: string;
    commune: string;
    detailAddress: string;
    additionalAddress: string;

    // Other
    paymentMethod: string;
    weight: number;
    productCategory: string;
    packageId: string;
    sellerNote: string;
    checkedStatus: string;
    checkedMarkedBy: string;
}

export interface TikTokOrderParseResult {
    orders: TikTokOrder[];
    totalRows: number;
}

function toNum(val: unknown): number {
    if (!val) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

export async function parseTikTokOrderExcel(file: File, onProgress?: ProgressCallback): Promise<TikTokOrderParseResult> {
    const report = onProgress || (() => { });

    report(5, 'Đang đọc file Excel...');
    const buffer = await file.arrayBuffer();
    await new Promise(r => setTimeout(r, 0));

    report(15, 'Đang phân tích cấu trúc...');
    const wb = XLSX.read(buffer, { type: 'array' });
    await new Promise(r => setTimeout(r, 0));

    // Find the OrderSKUList sheet or fallback to first sheet
    const sheetName = wb.SheetNames.find(n => n === 'OrderSKUList') || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new Error('Không tìm thấy sheet trong file');

    report(30, 'Đang đọc dữ liệu đơn hàng...');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    // Row 0 = headers, Row 1 = descriptions, data from Row 2
    if (rows.length < 3) throw new Error('File không có dữ liệu đơn hàng');
    await new Promise(r => setTimeout(r, 0));

    const orders: TikTokOrder[] = [];
    const totalRows = rows.length - 2; // exclude header + description row

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        // Report progress every 500 rows
        if ((i - 2) % 500 === 0) {
            const pct = 30 + Math.round(((i - 2) / totalRows) * 65);
            report(pct, `Đang xử lý đơn hàng (${(i - 1).toLocaleString()}/${totalRows.toLocaleString()})...`);
            await new Promise(r => setTimeout(r, 0));
        }

        orders.push({
            orderId: toStr(r[0]),
            status: toStr(r[1]),
            substatus: toStr(r[2]),
            cancelReturnType: toStr(r[3]),
            normalOrPreorder: toStr(r[4]),

            skuId: toStr(r[5]),
            sellerSku: toStr(r[6]),
            productName: toStr(r[7]),
            variation: toStr(r[8]),
            quantity: toNum(r[9]),
            returnQuantity: toNum(r[10]),

            unitOriginalPrice: toNum(r[11]),
            subtotalBeforeDiscount: toNum(r[12]),
            platformDiscount: toNum(r[13]),
            sellerDiscount: toNum(r[14]),
            subtotalAfterDiscount: toNum(r[15]),

            shippingFeeAfterDiscount: toNum(r[16]),
            originalShippingFee: toNum(r[17]),
            shippingFeeSellerDiscount: toNum(r[18]),
            shippingFeePlatformDiscount: toNum(r[19]),

            paymentPlatformDiscount: toNum(r[20]),
            taxes: toNum(r[21]),
            orderAmount: toNum(r[22]),
            orderRefundAmount: toNum(r[23]),

            createdTime: toStr(r[24]),
            paidTime: toStr(r[25]),
            rtsTime: toStr(r[26]),
            shippedTime: toStr(r[27]),
            deliveredTime: toStr(r[28]),
            cancelledTime: toStr(r[29]),

            cancelBy: toStr(r[30]),
            cancelReason: toStr(r[31]),

            fulfillmentType: toStr(r[32]),
            warehouseName: toStr(r[33]),
            trackingId: toStr(r[34]),
            deliveryOption: toStr(r[35]),
            shippingProviderName: toStr(r[36]),

            buyerMessage: toStr(r[37]),
            buyerUsername: toStr(r[38]),
            recipient: toStr(r[39]),
            phone: toStr(r[40]),
            country: toStr(r[41]),
            province: toStr(r[42]),
            district: toStr(r[43]),
            commune: toStr(r[44]),
            detailAddress: toStr(r[45]),
            additionalAddress: toStr(r[46]),

            paymentMethod: toStr(r[47]),
            weight: toNum(r[48]),
            productCategory: toStr(r[49]),
            packageId: toStr(r[50]),
            sellerNote: toStr(r[51]),
            checkedStatus: toStr(r[52]),
            checkedMarkedBy: toStr(r[53]),
        });
    }

    report(100, 'Hoàn tất!');
    return { orders, totalRows };
}
