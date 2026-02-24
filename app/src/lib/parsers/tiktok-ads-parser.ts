import * as XLSX from 'xlsx';
import type { ProgressCallback } from './income-parser';

// ==========================================
// Types for TikTok Ads Creative Report
// ==========================================

export interface TikTokAdCreative {
    campaignName: string;
    campaignId: string;
    productId: string;
    creativeType: string;       // "Video" | "Thẻ sản phẩm"
    videoTitle: string;
    videoId: string;
    tiktokAccount: string;
    postTime: string;
    status: string;             // "Đang phân phối" | "Không khả dụng" | "Cần ủy quyền"
    authType: string;
    cost: number;
    orders: number;
    costPerOrder: number;
    grossRevenue: number;
    roi: number;
    impressions: number;
    clicks: number;
    ctr: number;                // click-through rate
    conversionRate: number;
    videoView2s: number;
    videoView6s: number;
    videoView25pct: number;
    videoView50pct: number;
    videoView75pct: number;
    videoView100pct: number;
    currency: string;
}

export interface TikTokAdCampaignSummary {
    name: string;
    id: string;
    totalCost: number;
    totalOrders: number;
    totalRevenue: number;
    avgROI: number;
    avgCTR: number;
    avgConversionRate: number;
    totalImpressions: number;
    totalClicks: number;
    creativesCount: number;
    activeCount: number;
}

export interface TikTokAdProductSummary {
    productId: string;
    totalCost: number;
    totalOrders: number;
    totalRevenue: number;
    avgROI: number;
    avgCostPerOrder: number;
    creativesCount: number;
}

export interface TikTokAdsResult {
    creatives: TikTokAdCreative[];
    campaigns: TikTokAdCampaignSummary[];
    products: TikTokAdProductSummary[];
    summary: {
        totalCost: number;
        totalOrders: number;
        totalRevenue: number;
        avgROI: number;
        avgCTR: number;
        avgConversionRate: number;
        totalImpressions: number;
        totalClicks: number;
        totalCreatives: number;
        totalCampaigns: number;
        totalProducts: number;
        activeCreatives: number;
        videoCreatives: number;
        productCardCreatives: number;
    };
}

// ==========================================
// Helpers
// ==========================================

function toNum(val: unknown): number {
    if (val === null || val === undefined || val === '' || val === '-' || val === 'N/A') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

// ==========================================
// Column name mapping (Vietnamese → key)
// ==========================================

const COLUMN_MAP: Record<string, keyof TikTokAdCreative> = {
    'Tên chiến dịch': 'campaignName',
    'ID chiến dịch': 'campaignId',
    'ID sản phẩm': 'productId',
    'Loại nội dung sáng tạo': 'creativeType',
    'Tiêu đề video': 'videoTitle',
    'ID video': 'videoId',
    'Tài khoản TikTok': 'tiktokAccount',
    'Thời gian đăng': 'postTime',
    'Trạng thái': 'status',
    'Loại ủy quyền': 'authType',
    'Chi phí': 'cost',
    'Số lượng đơn hàng SKU': 'orders',
    'Chi phí cho mỗi đơn hàng': 'costPerOrder',
    'Doanh thu gộp': 'grossRevenue',
    'ROI': 'roi',
    'Số lượt hiển thị quảng cáo sản phẩm': 'impressions',
    'Số lượt nhấp vào quảng cáo sản phẩm': 'clicks',
    'Tỷ lệ nhấp vào quảng cáo sản phẩm': 'ctr',
    'Tỷ lệ chuyển đổi quảng cáo': 'conversionRate',
    'Tỷ lệ xem video quảng cáo trong 2 giây': 'videoView2s',
    'Tỷ lệ xem video quảng cáo trong 6 giây': 'videoView6s',
    'Tỷ lệ xem 25% thời lượng video quảng cáo': 'videoView25pct',
    'Tỷ lệ xem 50% thời lượng video quảng cáo': 'videoView50pct',
    'Tỷ lệ xem 75% thời lượng video quảng cáo': 'videoView75pct',
    'Tỷ lệ xem 100% thời lượng video quảng cáo': 'videoView100pct',
    'Đơn vị tiền tệ': 'currency',
};

const NUM_FIELDS = new Set<keyof TikTokAdCreative>([
    'cost', 'orders', 'costPerOrder', 'grossRevenue', 'roi',
    'impressions', 'clicks', 'ctr', 'conversionRate',
    'videoView2s', 'videoView6s', 'videoView25pct', 'videoView50pct',
    'videoView75pct', 'videoView100pct',
]);

// ==========================================
// Main Parser
// ==========================================

export async function parseTikTokAdsExcel(
    file: File,
    onProgress?: ProgressCallback,
): Promise<TikTokAdsResult> {
    onProgress?.(10, 'Đang đọc file...');

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    onProgress?.(30, 'Đang phân tích dữ liệu...');

    // Find the data sheet (usually "Data" or first sheet)
    const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'data') || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    onProgress?.(50, `Đang xử lý ${rawRows.length} creatives...`);

    // Parse each row into TikTokAdCreative
    const creatives: TikTokAdCreative[] = rawRows.map(row => {
        const creative: Partial<TikTokAdCreative> = {};
        for (const [vnCol, key] of Object.entries(COLUMN_MAP)) {
            if (vnCol in row) {
                if (NUM_FIELDS.has(key)) {
                    (creative as Record<string, unknown>)[key] = toNum(row[vnCol]);
                } else {
                    (creative as Record<string, unknown>)[key] = toStr(row[vnCol]);
                }
            }
        }
        return creative as TikTokAdCreative;
    });

    onProgress?.(70, 'Đang tính toán chiến dịch...');

    // Aggregate by campaign
    const campaignMap = new Map<string, TikTokAdCreative[]>();
    for (const c of creatives) {
        const key = c.campaignId || c.campaignName;
        if (!campaignMap.has(key)) campaignMap.set(key, []);
        campaignMap.get(key)!.push(c);
    }

    const campaigns: TikTokAdCampaignSummary[] = Array.from(campaignMap.entries()).map(
        ([, items]) => {
            const totalCost = items.reduce((s, c) => s + c.cost, 0);
            const totalOrders = items.reduce((s, c) => s + c.orders, 0);
            const totalRevenue = items.reduce((s, c) => s + c.grossRevenue, 0);
            const totalImpressions = items.reduce((s, c) => s + c.impressions, 0);
            const totalClicks = items.reduce((s, c) => s + c.clicks, 0);
            const active = items.filter(c => c.status === 'Đang phân phối').length;
            return {
                name: items[0].campaignName,
                id: items[0].campaignId,
                totalCost,
                totalOrders,
                totalRevenue,
                avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
                avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
                avgConversionRate: totalClicks > 0 ? totalOrders / totalClicks : 0,
                totalImpressions,
                totalClicks,
                creativesCount: items.length,
                activeCount: active,
            };
        },
    );

    onProgress?.(85, 'Đang tính toán sản phẩm...');

    // Aggregate by product
    const productMap = new Map<string, TikTokAdCreative[]>();
    for (const c of creatives) {
        if (!productMap.has(c.productId)) productMap.set(c.productId, []);
        productMap.get(c.productId)!.push(c);
    }

    const products: TikTokAdProductSummary[] = Array.from(productMap.entries()).map(
        ([productId, items]) => {
            const totalCost = items.reduce((s, c) => s + c.cost, 0);
            const totalOrders = items.reduce((s, c) => s + c.orders, 0);
            const totalRevenue = items.reduce((s, c) => s + c.grossRevenue, 0);
            return {
                productId,
                totalCost,
                totalOrders,
                totalRevenue,
                avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
                avgCostPerOrder: totalOrders > 0 ? totalCost / totalOrders : 0,
                creativesCount: items.length,
            };
        },
    );

    onProgress?.(95, 'Hoàn tất...');

    // Overall summary
    const totalCost = creatives.reduce((s, c) => s + c.cost, 0);
    const totalOrders = creatives.reduce((s, c) => s + c.orders, 0);
    const totalRevenue = creatives.reduce((s, c) => s + c.grossRevenue, 0);
    const totalImpressions = creatives.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = creatives.reduce((s, c) => s + c.clicks, 0);

    const summary = {
        totalCost,
        totalOrders,
        totalRevenue,
        avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
        avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        avgConversionRate: totalClicks > 0 ? totalOrders / totalClicks : 0,
        totalImpressions,
        totalClicks,
        totalCreatives: creatives.length,
        totalCampaigns: campaigns.length,
        totalProducts: products.length,
        activeCreatives: creatives.filter(c => c.status === 'Đang phân phối').length,
        videoCreatives: creatives.filter(c => c.creativeType === 'Video').length,
        productCardCreatives: creatives.filter(c => c.creativeType !== 'Video').length,
    };

    onProgress?.(100, 'Hoàn tất!');

    return { creatives, campaigns, products, summary };
}
