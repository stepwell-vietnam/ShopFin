'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, ShoppingCart, Percent, BarChart3, AlertTriangle, DollarSign, Edit3, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ProductDetailModal from './ProductDetailModal';
import type { UnifiedOrder, UnifiedIncome } from './ProductDetailModal';

// ---------- Types ----------

interface ShopData {
    id: string;
    name: string;
    platform: string;
    monthlyData: {
        id: string;
        dataType: string;
        month: string;
        rawData?: string;
        totalOrders: number;
        totalRevenue: number;
    }[];
}

interface SkuMetrics {
    sku: string;
    productName: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    totalQty: number;
    completedQty: number;
    revenue: number;
    originalPrice: number;
    sellerDiscount: number;
    platformDiscount: number;
    totalFees: number;
    commissionFee: number;
    affiliateCommission: number;
    settlement: number;
    cancelRate: number;
    returnRate: number;
    revenueShare: number;
    cumulativeShare: number;
    avgSalePrice: number;
    variants: Record<string, number>;
}

// ---------- Helpers ----------

function fmtCur(v: number): string {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'tỷ';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'tr';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return Math.round(v).toLocaleString('vi-VN') + 'đ';
}

function fmtPct(v: number): string {
    return v.toFixed(1) + '%';
}

// ---------- Parse helpers ----------

interface TikTokOrderRaw {
    orderId: string;
    status: string;
    substatus: string;
    sellerSku: string;
    productName: string;
    variation: string;
    quantity: number;
    unitOriginalPrice: number;
    subtotalAfterDiscount: number;
    sellerDiscount: number;
    platformDiscount: number;
    orderAmount: number;
    orderRefundAmount: number;
    cancelReturnType: string;
    cancelBy: string;
    cancelReason: string;
    createdTime: string;
    province: string;
    district: string;
}

interface ShopeeOrderRaw {
    orderId: string;
    status: string;
    sku: string;
    productName: string;
    variantName: string;
    quantity: number;
    originalPrice: number;
    salePrice: number;
    totalProductPrice: number;
    sellerDiscount: number;
    shopeeDiscount: number;
    cancelReason: string;
    cancelBy: string;
    returnStatus: string;
    orderDate: string;
    province: string;
    district: string;
    fixedFee: number;
    serviceFee: number;
    paymentFee: number;
}

interface IncomeOrderRaw {
    orderId: string;
    totalFees: number;
    commissionFee: number;
    affiliateCommission: number;
    totalSettlement: number;
    transactionFee: number;
    voucherXtraFee: number;
    orderProcessingFee: number;
    sellerShippingFee: number;
    // Shopee-specific
    fixedFee: number;
    serviceFee: number;
    paymentFee: number;
}

function isCompleted(o: TikTokOrderRaw | ShopeeOrderRaw, platform: string): boolean {
    if (platform === 'tiktok') {
        const t = o as TikTokOrderRaw;
        const st = t.substatus || t.status;
        return ['Đã giao', 'Hoàn tất', 'Đã hoàn tất', 'Đã vận chuyển'].includes(st);
    }
    return ['Hoàn thành', 'Đã nhận hàng'].includes((o as ShopeeOrderRaw).status);
}

function isCancelled(o: TikTokOrderRaw | ShopeeOrderRaw): boolean {
    return o.status === 'Đã hủy';
}

function extractSku(o: TikTokOrderRaw | ShopeeOrderRaw, platform: string): string {
    if (platform === 'tiktok') {
        const m = (o as TikTokOrderRaw).sellerSku.match(/^([A-Za-z]+\d+)/);
        return m ? m[1].toUpperCase() : (o as TikTokOrderRaw).sellerSku;
    }
    return (o as ShopeeOrderRaw).sku || 'N/A';
}

function extractVariant(o: TikTokOrderRaw | ShopeeOrderRaw, platform: string): string {
    if (platform === 'tiktok') return (o as TikTokOrderRaw).variation || 'N/A';
    return (o as ShopeeOrderRaw).variantName || 'N/A';
}

function extractProductName(o: TikTokOrderRaw | ShopeeOrderRaw): string {
    return o.productName || 'N/A';
}

function normalizeOrder(o: TikTokOrderRaw | ShopeeOrderRaw, platform: string): UnifiedOrder {
    if (platform === 'tiktok') {
        const t = o as TikTokOrderRaw;
        const completed = ['Đã giao', 'Hoàn tất', 'Đã hoàn tất', 'Đã vận chuyển'].includes(t.substatus || t.status);
        const cancelled = t.status === 'Đã hủy';
        return {
            orderId: t.orderId, status: completed ? 'completed' : cancelled ? 'cancelled' : 'other',
            variation: t.variation || '', quantity: t.quantity || 1,
            revenue: t.subtotalAfterDiscount || 0, originalPrice: t.unitOriginalPrice || 0,
            sellerDiscount: t.sellerDiscount || 0, platformDiscount: t.platformDiscount || 0,
            cancelReason: t.cancelReason || '', cancelBy: t.cancelBy || '',
            cancelReturnType: t.cancelReturnType || '',
            province: t.province || '', district: t.district || '',
            createdTime: t.createdTime || '', productName: t.productName || '',
        };
    }
    const s = o as ShopeeOrderRaw;
    const completed = ['Hoàn thành', 'Đã nhận hàng'].includes(s.status);
    const cancelled = s.status === 'Đã hủy';
    return {
        orderId: s.orderId, status: completed ? 'completed' : cancelled ? 'cancelled' : 'other',
        variation: s.variantName || '', quantity: s.quantity || 1,
        revenue: s.totalProductPrice || 0, originalPrice: s.originalPrice || 0,
        sellerDiscount: s.sellerDiscount || 0, platformDiscount: s.shopeeDiscount || 0,
        cancelReason: s.cancelReason || '', cancelBy: s.cancelBy || '',
        cancelReturnType: s.returnStatus || '',
        province: s.province || '', district: s.district || '',
        createdTime: s.orderDate || '', productName: s.productName || '',
    };
}

function normalizeIncomeMap(raw: Record<string, IncomeOrderRaw>): Record<string, UnifiedIncome> {
    const result: Record<string, UnifiedIncome> = {};
    for (const [k, v] of Object.entries(raw)) {
        result[k] = {
            orderId: v.orderId, totalSettlement: v.totalSettlement || 0,
            totalFees: Math.abs(v.totalFees || 0),
            commissionFee: Math.abs(v.commissionFee || 0),
            affiliateCommission: Math.abs(v.affiliateCommission || 0),
            transactionFee: Math.abs(v.transactionFee || 0),
            voucherXtraFee: Math.abs(v.voucherXtraFee || 0),
            orderProcessingFee: Math.abs(v.orderProcessingFee || 0),
            sellerShippingFee: Math.abs(v.sellerShippingFee || 0),
            fixedFee: Math.abs(v.fixedFee || 0),
            serviceFee: Math.abs(v.serviceFee || 0),
            paymentFee: Math.abs(v.paymentFee || 0),
        };
    }
    return result;
}

// ---------- Cost Price localStorage ----------

const COST_STORAGE_KEY = 'shopfin-cost-prices';

function loadCostPrices(shopId: string): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(COST_STORAGE_KEY);
        if (!raw) return {};
        const all = JSON.parse(raw);
        return all[shopId] || {};
    } catch { return {}; }
}

function saveCostPrices(shopId: string, costs: Record<string, number>) {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(COST_STORAGE_KEY);
        const all = raw ? JSON.parse(raw) : {};
        all[shopId] = costs;
        localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(all));
    } catch { /* skip */ }
}

// ---------- Inline Cost Input ----------

function CostInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value > 0 ? String(value / 1000) : '');

    useEffect(() => {
        setText(value > 0 ? String(value / 1000) : '');
    }, [value]);

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                style={{
                    background: value > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${value > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 4, cursor: 'pointer', padding: '2px 6px',
                    color: value > 0 ? '#22c55e' : '#f59e0b',
                    fontSize: '0.75rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                }}
                title="Click để nhập giá vốn"
            >
                {value > 0 ? fmtCur(value) : '+ Nhập'}
                <Edit3 size={10} />
            </button>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
                autoFocus
                type="number"
                value={text}
                onChange={e => setText(e.target.value)}
                onBlur={() => {
                    const num = parseFloat(text) * 1000;
                    if (!isNaN(num) && num > 0) onChange(num);
                    else if (text === '' || text === '0') onChange(0);
                    setEditing(false);
                }}
                onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setText(value > 0 ? String(value / 1000) : ''); setEditing(false); }
                }}
                placeholder="VD: 110"
                style={{
                    width: 56, padding: '2px 4px', borderRadius: 4,
                    border: '1px solid var(--accent-primary)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    fontSize: '0.75rem', textAlign: 'right', outline: 'none',
                }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>K</span>
        </div>
    );
}

// ---------- Main Component ----------

export default function ProductsTab({ shop }: { shop: ShopData }) {
    // Cost prices state
    const [costPrices, setCostPrices] = useState<Record<string, number>>({});
    const [selectedSku, setSelectedSku] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    // Collect available months from monthlyData
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        shop.monthlyData.filter(m => m.dataType === 'orders').forEach(m => { if (m.month) months.add(m.month); });
        return Array.from(months).sort();
    }, [shop.monthlyData]);

    useEffect(() => {
        setCostPrices(loadCostPrices(shop.id));
    }, [shop.id]);

    const updateCost = useCallback((sku: string, cost: number) => {
        setCostPrices(prev => {
            const next = { ...prev };
            if (cost > 0) next[sku] = cost;
            else delete next[sku];
            saveCostPrices(shop.id, next);
            return next;
        });
    }, [shop.id]);

    const analysis = useMemo(() => {
        const orderMonthlyData = shop.monthlyData.filter(m => m.dataType === 'orders' && (selectedMonth === 'all' || m.month === selectedMonth));
        const incomeMonthlyData = shop.monthlyData.filter(m => m.dataType === 'income' && (selectedMonth === 'all' || m.month === selectedMonth));

        if (orderMonthlyData.length === 0) return null;

        const allOrders: (TikTokOrderRaw | ShopeeOrderRaw)[] = [];
        for (const md of orderMonthlyData) {
            if (!md.rawData) continue;
            try {
                const parsed = JSON.parse(md.rawData);
                allOrders.push(...(parsed.orders || []));
            } catch { /* skip */ }
        }

        if (allOrders.length === 0) return null;

        const incomeMap: Record<string, IncomeOrderRaw> = {};
        for (const md of incomeMonthlyData) {
            if (!md.rawData) continue;
            try {
                const parsed = JSON.parse(md.rawData);
                for (const o of (parsed.orders || [])) {
                    if (o.orderId) incomeMap[o.orderId] = o;
                }
            } catch { /* skip */ }
        }

        const skuMap: Record<string, SkuMetrics> = {};

        for (const o of allOrders) {
            const sku = extractSku(o, shop.platform);
            if (!skuMap[sku]) {
                skuMap[sku] = {
                    sku, productName: extractProductName(o),
                    totalOrders: 0, completedOrders: 0, cancelledOrders: 0, returnedOrders: 0,
                    totalQty: 0, completedQty: 0,
                    revenue: 0, originalPrice: 0, sellerDiscount: 0, platformDiscount: 0,
                    totalFees: 0, commissionFee: 0, affiliateCommission: 0, settlement: 0,
                    cancelRate: 0, returnRate: 0, revenueShare: 0, cumulativeShare: 0, avgSalePrice: 0,
                    variants: {},
                };
            }

            const m = skuMap[sku];
            const qty = (o as any).quantity || 1;
            m.totalOrders++;
            m.totalQty += qty;

            if (isCompleted(o, shop.platform)) {
                m.completedOrders++;
                m.completedQty += qty;
                if (shop.platform === 'tiktok') {
                    const t = o as TikTokOrderRaw;
                    m.revenue += t.subtotalAfterDiscount || 0;
                    m.originalPrice += (t.unitOriginalPrice || 0) * qty;
                    m.sellerDiscount += t.sellerDiscount || 0;
                    m.platformDiscount += t.platformDiscount || 0;
                } else {
                    const s = o as ShopeeOrderRaw;
                    m.revenue += s.totalProductPrice || 0;
                    m.originalPrice += (s.originalPrice || 0) * qty;
                    m.sellerDiscount += (s.sellerDiscount || 0) * qty;
                }
                m.variants[extractVariant(o, shop.platform)] = (m.variants[extractVariant(o, shop.platform)] || 0) + qty;

                const orderId = o.orderId || '';
                if (incomeMap[orderId]) {
                    const inc = incomeMap[orderId];
                    m.totalFees += Math.abs(inc.totalFees || 0);
                    m.commissionFee += Math.abs(inc.commissionFee || 0);
                    m.affiliateCommission += Math.abs(inc.affiliateCommission || 0);
                    m.settlement += inc.totalSettlement || 0;
                }
            } else if (isCancelled(o)) {
                m.cancelledOrders++;
            }

            if (shop.platform === 'tiktok') {
                if ((o as TikTokOrderRaw).cancelReturnType) m.returnedOrders++;
            } else {
                if ((o as ShopeeOrderRaw).returnStatus) m.returnedOrders++;
            }
        }

        const totalRevenue = Object.values(skuMap).reduce((s, m) => s + m.revenue, 0);
        const skus = Object.values(skuMap)
            .map(m => ({
                ...m,
                cancelRate: m.totalOrders > 0 ? (m.cancelledOrders / m.totalOrders) * 100 : 0,
                returnRate: m.completedOrders > 0 ? (m.returnedOrders / m.completedOrders) * 100 : 0,
                revenueShare: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
                avgSalePrice: m.completedQty > 0 ? m.revenue / m.completedQty : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue);

        let cumulative = 0;
        for (const s of skus) { cumulative += s.revenueShare; s.cumulativeShare = cumulative; }

        const totalOrders = allOrders.length;
        const completed = allOrders.filter(o => isCompleted(o, shop.platform));
        const cancelled = allOrders.filter(o => isCancelled(o));
        const totalCompletedQty = completed.reduce((s, o) => s + ((o as any).quantity || 1), 0);
        const aov = totalCompletedQty > 0 ? totalRevenue / totalCompletedQty : 0;
        const cancelRate = totalOrders > 0 ? (cancelled.length / totalOrders) * 100 : 0;
        const totalSettlement = skus.reduce((s, m) => s + m.settlement, 0);

        return { skus, totalRevenue, totalOrders, totalSku: skus.length, bestSku: skus[0]?.sku || '-', bestRevenue: skus[0]?.revenue || 0, aov, cancelRate, totalCompletedQty, totalSettlement, allOrders, incomeMap };
    }, [shop, selectedMonth]);

    if (!analysis) {
        return (
            <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
                <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Chưa có dữ liệu đơn hàng. Hãy upload file Order trước.</p>
            </div>
        );
    }

    const { skus, totalRevenue } = analysis;

    // Profit calculations
    const costEntered = Object.keys(costPrices).length;
    const totalCostGoods = skus.reduce((s, sk) => s + (costPrices[sk.sku] || 0) * sk.completedQty, 0);
    const totalNetProfit = analysis.totalSettlement - totalCostGoods;
    const netMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    const top10Chart = skus.slice(0, 10).map(s => ({
        name: s.sku,
        revenue: Math.round(s.revenue / 1e6 * 10) / 10,
        qty: s.completedQty,
    })).reverse();

    const variantMap: Record<string, number> = {};
    for (const s of skus) {
        for (const [v, count] of Object.entries(s.variants)) {
            const key = `${s.sku} / ${v}`;
            variantMap[key] = (variantMap[key] || 0) + count;
        }
    }
    const topVariants = Object.entries(variantMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, value]) => ({ name: name.length > 30 ? name.substring(0, 30) + '…' : name, value }))
        .reverse();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Month Filter */}
            {availableMonths.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lọc theo tháng:</span>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{
                            padding: '6px 12px', borderRadius: 8,
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)', fontSize: '0.8rem',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="all">Tất cả ({availableMonths.length} tháng)</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    {selectedMonth !== 'all' && (
                        <button onClick={() => setSelectedMonth('all')} style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem',
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                        }}>✕ Xóa lọc</button>
                    )}
                </div>
            )}

            {/* KPI Cards — 5 cards now */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {[
                    { label: 'Tổng SKU', value: String(analysis.totalSku), sub: `${analysis.totalCompletedQty.toLocaleString('vi-VN')} sp bán`, color: '#2dd4bf', icon: Package },
                    { label: 'SP bán chạy nhất', value: analysis.bestSku, sub: fmtCur(analysis.bestRevenue), color: '#f59e0b', icon: TrendingUp },
                    { label: 'AOV trung bình', value: fmtCur(analysis.aov), sub: `${analysis.totalOrders.toLocaleString('vi-VN')} đơn`, color: '#818cf8', icon: ShoppingCart },
                    { label: 'Tỷ lệ hủy', value: fmtPct(analysis.cancelRate), sub: analysis.cancelRate > 20 ? '⚠️ Cao' : '✅ Bình thường', color: analysis.cancelRate > 20 ? '#ef4444' : '#22c55e', icon: Percent },
                    {
                        label: 'Lợi nhuận ròng',
                        value: costEntered > 0 ? fmtCur(totalNetProfit) : '—',
                        sub: costEntered > 0 ? `Biên ${fmtPct(netMargin)} · ${costEntered} SKU có giá vốn` : 'Nhập giá vốn bên dưới ↓',
                        color: totalNetProfit > 0 ? '#22c55e' : '#ef4444',
                        icon: DollarSign,
                    },
                ].map((card, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)', borderRadius: 10, padding: '16px 18px',
                        border: '1px solid var(--border-default)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.label}</span>
                            <card.icon size={16} style={{ color: card.color, opacity: 0.7 }} />
                        </div>
                        <div style={{ fontSize: card.value.length > 8 ? '1.1rem' : '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-default)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={16} style={{ color: '#2dd4bf' }} />Top 10 SKU theo Doanh thu
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={top10Chart} layout="vertical" margin={{ left: 50, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `${v}M`} />
                            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={55} />
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                                formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}M (${fmtCur((v ?? 0) * 1e6)})`, 'Doanh thu']} />
                            <Bar dataKey="revenue" name="Doanh thu (M)" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-default)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={16} style={{ color: '#818cf8' }} />Top 15 Phân loại bán chạy
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={topVariants} layout="vertical" margin={{ left: 120, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={120} />
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                                formatter={(v: number | undefined) => [`${v ?? 0} sp`, 'SL bán']} />
                            <Bar dataKey="value" name="SL bán" fill="#818cf8" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* SKU Ranking Table with Cost Price */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={16} style={{ color: '#22c55e' }} />
                        Bảng xếp hạng SKU ({skus.length} sản phẩm)
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DollarSign size={12} style={{ color: '#22c55e' }} />
                        Click &quot;+ Nhập&quot; để thêm giá vốn · Đơn vị: nghìn đồng (K)
                    </div>
                </div>
                <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-tertiary)' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>SKU</th>
                                <th style={{ ...thStyle, minWidth: 120 }}>Tên SP</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Doanh thu</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>% DT</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>% Tích lũy</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Giá TB</th>
                                <th style={{ ...thStyle, textAlign: 'center', color: '#22c55e', minWidth: 80 }}>💰 Giá vốn</th>
                                <th style={{ ...thStyle, textAlign: 'right', color: '#22c55e' }}>LN ròng</th>
                                <th style={{ ...thStyle, textAlign: 'right', color: '#22c55e' }}>Biên LN</th>
                                <th style={{ ...thStyle, textAlign: 'right', color: '#22c55e' }}>LN/sp</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Phí sàn</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Hủy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {skus.map((s, i) => {
                                const feeRate = s.revenue > 0 ? (s.totalFees / s.revenue) * 100 : 0;
                                const isTop3 = i < 3;
                                const cost = costPrices[s.sku] || 0;
                                const hasCost = cost > 0;
                                const totalCost = cost * s.completedQty;
                                const netProfit = hasCost ? s.settlement - totalCost : 0;
                                const profitMargin = hasCost && s.revenue > 0 ? (netProfit / s.revenue) * 100 : 0;
                                const profitPerUnit = hasCost && s.completedQty > 0 ? netProfit / s.completedQty : 0;

                                return (
                                    <tr key={s.sku} onClick={() => setSelectedSku(s.sku)} style={{
                                        borderTop: '1px solid var(--border-default)',
                                        background: isTop3 ? 'rgba(45,212,191,0.03)' : undefined,
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                    }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,212,191,0.08)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = isTop3 ? 'rgba(45,212,191,0.03)' : '')}>
                                        <td style={{ ...tdStyle, fontWeight: 700, color: isTop3 ? '#2dd4bf' : 'var(--text-muted)' }}>
                                            {i + 1}
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{s.sku}</td>
                                        <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.73rem' }}>
                                            {s.productName.substring(0, 40)}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{s.completedQty.toLocaleString('vi-VN')}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {fmtCur(s.revenue)}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtPct(s.revenueShare)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(s.cumulativeShare, 100)}%`, height: '100%', borderRadius: 2, background: s.cumulativeShare <= 80 ? '#2dd4bf' : '#f59e0b' }} />
                                                </div>
                                                <span style={{ fontSize: '0.73rem' }}>{fmtPct(s.cumulativeShare)}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(s.avgSalePrice)}</td>
                                        {/* Cost Price Input */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <CostInput value={cost} onChange={v => updateCost(s.sku, v)} />
                                        </td>
                                        {/* Net Profit */}
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: hasCost ? (netProfit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                            {hasCost ? fmtCur(netProfit) : '—'}
                                        </td>
                                        {/* Profit Margin */}
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: hasCost ? 600 : 400, color: hasCost ? (profitMargin > 15 ? '#22c55e' : profitMargin > 5 ? '#f59e0b' : '#ef4444') : 'var(--text-muted)' }}>
                                            {hasCost ? fmtPct(profitMargin) : '—'}
                                        </td>
                                        {/* Profit per unit */}
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasCost ? (profitPerUnit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                            {hasCost ? fmtCur(profitPerUnit) : '—'}
                                        </td>
                                        {/* Platform Fees */}
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums', fontSize: '0.73rem' }}>
                                            {s.totalFees > 0 ? `${fmtCur(s.totalFees)} (${fmtPct(feeRate)})` : '—'}
                                        </td>
                                        {/* Cancel Rate */}
                                        <td style={{ ...tdStyle, textAlign: 'right', color: s.cancelRate > 20 ? '#ef4444' : 'var(--text-muted)', fontWeight: s.cancelRate > 20 ? 600 : 400 }}>
                                            {fmtPct(s.cancelRate)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
                                <td style={tdStyle} colSpan={3}>TỔNG</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{skus.reduce((s, m) => s + m.completedQty, 0).toLocaleString('vi-VN')}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>{fmtCur(totalRevenue)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>100%</td>
                                <td colSpan={2} />
                                <td style={{ ...tdStyle, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {costEntered > 0 ? `${costEntered} SKU` : ''}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: costEntered > 0 ? (totalNetProfit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)', fontWeight: 700 }}>
                                    {costEntered > 0 ? fmtCur(totalNetProfit) : '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: costEntered > 0 ? '#22c55e' : 'var(--text-muted)' }}>
                                    {costEntered > 0 ? fmtPct(netMargin) : '—'}
                                </td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Pareto Note */}
            {skus.length >= 3 && (() => {
                const top2Share = skus.slice(0, 2).reduce((s, m) => s + m.revenueShare, 0);
                if (top2Share > 70) {
                    return (
                        <div style={{
                            padding: '12px 16px', borderRadius: 10,
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                        }}>
                            <AlertTriangle size={18} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <strong style={{ color: '#f59e0b' }}>Rủi ro tập trung doanh thu:</strong>{' '}
                                Top 2 SKU ({skus[0].sku}, {skus[1].sku}) chiếm <strong>{fmtPct(top2Share)}</strong> tổng doanh thu.
                                Nên đẩy mạnh các SKU tiềm năng khác để phân tán rủi ro.
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Product Detail Modal */}
            {selectedSku && analysis.allOrders && (
                <ProductDetailModal
                    sku={selectedSku}
                    platform={shop.platform as 'tiktok' | 'shopee'}
                    orders={analysis.allOrders
                        .filter(o => extractSku(o, shop.platform) === selectedSku)
                        .map(o => normalizeOrder(o, shop.platform))}
                    incomeMap={normalizeIncomeMap(analysis.incomeMap)}
                    costPrice={costPrices[selectedSku] || 0}
                    onClose={() => setSelectedSku(null)}
                />
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px 8px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: '0.73rem', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '7px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap',
};
