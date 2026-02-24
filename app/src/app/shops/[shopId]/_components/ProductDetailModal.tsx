'use client';

import { useMemo } from 'react';
import { X, Package, TrendingUp, ShoppingCart, DollarSign, Percent, MapPin, AlertTriangle, Tag } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ---------- Types ----------

/** Unified order shape. Caller normalizes before passing. */
export interface UnifiedOrder {
    orderId: string;
    status: string;           // completed / cancelled / other
    variation: string;
    quantity: number;
    revenue: number;          // subtotalAfterDiscount (tiktok) or totalProductPrice (shopee)
    originalPrice: number;    // per-unit original
    sellerDiscount: number;
    platformDiscount: number; // platformDiscount (tiktok) or shopeeDiscount (shopee)
    cancelReason: string;
    cancelBy: string;
    cancelReturnType: string;
    province: string;
    district: string;
    createdTime: string;      // ISO or dd/mm/yyyy HH:mm:ss
    productName: string;
}

export interface UnifiedIncome {
    orderId: string;
    totalSettlement: number;
    totalFees: number;
    commissionFee: number;
    affiliateCommission: number;
    transactionFee: number;
    voucherXtraFee: number;
    orderProcessingFee: number;
    sellerShippingFee: number;
    // Shopee-specific fees
    fixedFee: number;
    serviceFee: number;
    paymentFee: number;
}

interface Props {
    sku: string;
    platform: 'tiktok' | 'shopee';
    orders: UnifiedOrder[];
    incomeMap: Record<string, UnifiedIncome>;
    costPrice: number;
    onClose: () => void;
}

// ---------- Helpers ----------

function fmtCur(v: number): string {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'tỷ';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'tr';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return Math.round(v).toLocaleString('vi-VN') + 'đ';
}

function fmtPct(v: number): string { return v.toFixed(1) + '%'; }
function fmtNum(v: number): string { return v.toLocaleString('vi-VN'); }

function parseDate(s: string): Date | null {
    if (!s) return null;
    // dd/mm/yyyy HH:mm:ss
    const m1 = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1], +m1[4], +m1[5], +m1[6]);
    // yyyy-mm-dd HH:mm
    const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5]);
    return new Date(s);
}

const COLORS = ['#2dd4bf', '#818cf8', '#f59e0b', '#ef4444', '#22c55e', '#f472b6', '#a78bfa', '#fb923c', '#67e8f9', '#fbbf24'];

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', borderRadius: 12, padding: 20,
    border: '1px solid var(--border-default)',
};

const sectionTitle = (icon: React.ReactNode, title: string) => (
    <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}{title}
    </h3>
);

// ---------- Component ----------

export default function ProductDetailModal({ sku, platform, orders, incomeMap, costPrice, onClose }: Props) {
    const analysis = useMemo(() => {
        const completed = orders.filter(o => o.status === 'completed');
        const cancelled = orders.filter(o => o.status === 'cancelled');
        const returned = orders.filter(o => !!o.cancelReturnType);

        const compQty = completed.reduce((s, o) => s + (o.quantity || 1), 0);
        const revenue = completed.reduce((s, o) => s + (o.revenue || 0), 0);
        const originalTotal = completed.reduce((s, o) => s + (o.originalPrice || 0) * (o.quantity || 1), 0);
        const sellerDisc = completed.reduce((s, o) => s + (o.sellerDiscount || 0), 0);
        const platformDisc = completed.reduce((s, o) => s + (o.platformDiscount || 0), 0);

        // Income fees
        let totalFees = 0, commission = 0, affiliate = 0, transactionFee = 0,
            voucherXtra = 0, processing = 0, shipping = 0, settlement = 0,
            fixedFee = 0, serviceFee = 0, paymentFee = 0;
        for (const o of completed) {
            const inc = incomeMap[o.orderId];
            if (inc) {
                totalFees += Math.abs(inc.totalFees || 0);
                commission += Math.abs(inc.commissionFee || 0);
                affiliate += Math.abs(inc.affiliateCommission || 0);
                transactionFee += Math.abs(inc.transactionFee || 0);
                voucherXtra += Math.abs(inc.voucherXtraFee || 0);
                processing += Math.abs(inc.orderProcessingFee || 0);
                shipping += Math.abs(inc.sellerShippingFee || 0);
                fixedFee += Math.abs(inc.fixedFee || 0);
                serviceFee += Math.abs(inc.serviceFee || 0);
                paymentFee += Math.abs(inc.paymentFee || 0);
                settlement += inc.totalSettlement || 0;
            }
        }

        const totalCost = costPrice * compQty;
        const netProfit = settlement - totalCost;
        const avgPrice = compQty > 0 ? revenue / compQty : 0;
        const cancelRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

        // Daily revenue
        const dailyMap: Record<string, { revenue: number; orders: number; qty: number }> = {};
        for (const o of completed) {
            const d = parseDate(o.createdTime);
            if (!d) continue;
            const key = `${d.getDate()}/${d.getMonth() + 1}`;
            if (!dailyMap[key]) dailyMap[key] = { revenue: 0, orders: 0, qty: 0 };
            dailyMap[key].revenue += o.revenue || 0;
            dailyMap[key].orders++;
            dailyMap[key].qty += o.quantity || 1;
        }
        const dailyData = Object.entries(dailyMap)
            .map(([day, d]) => ({ day, revenue: Math.round(d.revenue / 1e6 * 10) / 10, orders: d.orders, qty: d.qty }))
            .sort((a, b) => {
                const [ad, am] = a.day.split('/').map(Number);
                const [bd, bm] = b.day.split('/').map(Number);
                return am === bm ? ad - bd : am - bm;
            });

        // Variants
        const varMap: Record<string, { qty: number; revenue: number; cancelled: number; total: number }> = {};
        for (const o of orders) {
            const v = o.variation || 'N/A';
            if (!varMap[v]) varMap[v] = { qty: 0, revenue: 0, cancelled: 0, total: 0 };
            varMap[v].total++;
            if (o.status === 'completed') {
                varMap[v].qty += o.quantity || 1;
                varMap[v].revenue += o.revenue || 0;
            }
            if (o.status === 'cancelled') varMap[v].cancelled++;
        }
        const variants = Object.entries(varMap)
            .map(([name, d]) => ({ name, ...d, cancelRate: d.total > 0 ? (d.cancelled / d.total) * 100 : 0, share: revenue > 0 ? (d.revenue / revenue) * 100 : 0 }))
            .sort((a, b) => b.revenue - a.revenue);

        // Cancel reasons
        const cancelReasons: Record<string, number> = {};
        const cancelByMap: Record<string, number> = {};
        for (const o of cancelled) {
            const r = o.cancelReason || 'Không rõ';
            cancelReasons[r] = (cancelReasons[r] || 0) + 1;
            const by = o.cancelBy || 'Không rõ';
            cancelByMap[by] = (cancelByMap[by] || 0) + 1;
        }
        const cancelReasonData = Object.entries(cancelReasons)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name: name.length > 35 ? name.substring(0, 35) + '…' : name, value }));

        // Provinces
        const provMap: Record<string, { orders: number; revenue: number; cancelled: number; total: number }> = {};
        for (const o of orders) {
            const p = o.province || 'Không rõ';
            if (!provMap[p]) provMap[p] = { orders: 0, revenue: 0, cancelled: 0, total: 0 };
            provMap[p].total++;
            if (o.status === 'completed') { provMap[p].orders++; provMap[p].revenue += o.revenue || 0; }
            if (o.status === 'cancelled') provMap[p].cancelled++;
        }
        const provinces = Object.entries(provMap)
            .map(([name, d]) => ({ name, ...d, cancelRate: d.total > 0 ? (d.cancelled / d.total) * 100 : 0 }))
            .sort((a, b) => b.revenue - a.revenue).slice(0, 15);

        // Fee breakdown — platform-dependent
        const fees = platform === 'tiktok' ? [
            { name: 'Hoa hồng TikTok', value: commission },
            { name: 'Affiliate', value: affiliate },
            { name: 'Phí giao dịch', value: transactionFee },
            { name: 'Voucher Xtra', value: voucherXtra },
            { name: 'Phí xử lý đơn', value: processing },
            { name: 'Phí vận chuyển Seller', value: shipping },
        ].filter(f => f.value > 0) : [
            { name: 'Hoa hồng Shopee', value: commission },
            { name: 'Phí cố định', value: fixedFee },
            { name: 'Phí dịch vụ', value: serviceFee },
            { name: 'Phí thanh toán', value: paymentFee },
            { name: 'Phí vận chuyển Seller', value: shipping },
        ].filter(f => f.value > 0);

        // Price distribution
        const priceMap: Record<number, number> = {};
        for (const o of completed) {
            const p = Math.round((o.revenue || 0) / (o.quantity || 1) / 10000) * 10000;
            priceMap[p] = (priceMap[p] || 0) + (o.quantity || 1);
        }
        const priceDistribution = Object.entries(priceMap)
            .map(([price, count]) => ({ price: `${(+price / 1000).toFixed(0)}K`, count, priceNum: +price }))
            .sort((a, b) => a.priceNum - b.priceNum);

        // Waterfall
        const otherFees = platform === 'tiktok'
            ? totalFees - commission - affiliate - transactionFee - voucherXtra - processing
            : totalFees - commission - fixedFee - serviceFee - paymentFee;
        const waterfall = [
            { name: 'Giá niêm yết', value: originalTotal, fill: '#818cf8' },
            { name: 'Seller giảm', value: -sellerDisc, fill: '#ef4444' },
            { name: platform === 'tiktok' ? 'Platform giảm' : 'Shopee giảm', value: -platformDisc, fill: '#f59e0b' },
            { name: 'DT sau giảm', value: revenue, fill: '#22c55e', isTotal: true },
            { name: platform === 'tiktok' ? 'Hoa hồng' : 'HH Shopee', value: -commission, fill: '#ef4444' },
            ...(platform === 'tiktok' ? [
                { name: 'Affiliate', value: -affiliate, fill: '#ef4444' },
                { name: 'Phí GD', value: -transactionFee, fill: '#ef4444' },
                { name: 'V.Xtra+Khác', value: -(voucherXtra + processing + otherFees), fill: '#ef4444' },
            ] : [
                { name: 'Phí CĐ+DV', value: -(fixedFee + serviceFee), fill: '#ef4444' },
                { name: 'Phí TT+Khác', value: -(paymentFee + otherFees), fill: '#ef4444' },
            ]),
            { name: 'Thực nhận', value: settlement, fill: '#2dd4bf', isTotal: true },
        ];
        if (costPrice > 0) {
            waterfall.push({ name: 'Giá vốn', value: -totalCost, fill: '#ef4444' });
            waterfall.push({ name: 'LN ròng', value: netProfit, fill: netProfit > 0 ? '#22c55e' : '#ef4444', isTotal: true });
        }

        return {
            productName: orders[0]?.productName || sku,
            total: orders.length, completed: completed.length, cancelled: cancelled.length, returned: returned.length,
            compQty, revenue, originalTotal, sellerDisc, platformDisc,
            totalFees, settlement, totalCost, netProfit, avgPrice, cancelRate,
            dailyData, variants, cancelReasonData, cancelBy: cancelByMap, provinces, fees, priceDistribution, waterfall,
        };
    }, [orders, incomeMap, costPrice, sku, platform]);

    const a = analysis;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            overflow: 'auto', padding: '20px 0',
        }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '95%', maxWidth: 1200, background: 'var(--bg-primary)',
                borderRadius: 16, overflow: 'hidden',
                border: '1px solid var(--border-default)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    position: 'sticky', top: 0, zIndex: 10,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2dd4bf', fontFamily: 'monospace' }}>{sku}</span>
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: platform === 'tiktok' ? 'rgba(45,212,191,0.1)' : 'rgba(238,77,45,0.1)', color: platform === 'tiktok' ? '#2dd4bf' : '#ee4d2d' }}>
                                {platform === 'tiktok' ? '🎵 TikTok' : '🛒 Shopee'} · {fmtNum(a.total)} đơn · {fmtNum(a.compQty)} sp bán
                            </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {a.productName.substring(0, 80)}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 8 }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* ===================== KPI Cards (6) ===================== */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                        {[
                            { label: 'Doanh thu', value: fmtCur(a.revenue), color: '#22c55e', icon: TrendingUp },
                            { label: 'Số lượng bán', value: fmtNum(a.compQty), color: '#2dd4bf', icon: Package },
                            { label: 'Giá bán TB', value: fmtCur(a.avgPrice), color: '#818cf8', icon: Tag },
                            { label: 'Thực nhận', value: fmtCur(a.settlement), color: '#f59e0b', icon: DollarSign },
                            { label: 'LN ròng', value: costPrice > 0 ? fmtCur(a.netProfit) : '—', color: a.netProfit > 0 ? '#22c55e' : '#ef4444', icon: DollarSign },
                            { label: 'Tỷ lệ hủy', value: fmtPct(a.cancelRate), color: a.cancelRate > 20 ? '#ef4444' : '#22c55e', icon: Percent },
                        ].map((c, i) => (
                            <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-default)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.label}</span>
                                    <c.icon size={14} style={{ color: c.color, opacity: 0.6 }} />
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* ===================== Row 1: Waterfall + Fee Breakdown ===================== */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                        <div style={cardStyle}>
                            {sectionTitle(<DollarSign size={16} style={{ color: '#22c55e' }} />, 'Dòng tiền Lợi nhuận (Waterfall)')}
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={a.waterfall} margin={{ left: 10, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                                        formatter={(v: number | undefined) => [fmtCur(Math.abs(v ?? 0)), '']}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {a.waterfall.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} opacity={(entry as any).isTotal ? 1 : 0.75} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.73rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                <span>Giá gốc: <strong style={{ color: '#818cf8' }}>{fmtCur(a.originalTotal)}</strong></span>
                                <span>Seller giảm: <strong style={{ color: '#ef4444' }}>-{fmtCur(a.sellerDisc)}</strong> ({fmtPct(a.originalTotal > 0 ? a.sellerDisc / a.originalTotal * 100 : 0)})</span>
                                <span>Phí sàn: <strong style={{ color: '#ef4444' }}>-{fmtCur(a.totalFees)}</strong> ({fmtPct(a.revenue > 0 ? a.totalFees / a.revenue * 100 : 0)})</span>
                                {costPrice > 0 && <span>Giá vốn: <strong style={{ color: '#f59e0b' }}>{fmtCur(costPrice)}/sp × {fmtNum(a.compQty)}</strong></span>}
                            </div>
                        </div>

                        <div style={cardStyle}>
                            {sectionTitle(<Percent size={16} style={{ color: '#ef4444' }} />, 'Cơ cấu Phí sàn')}
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={a.fees} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        innerRadius={50} outerRadius={80} paddingAngle={2}>
                                        {a.fees.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: '0.78rem' }}
                                        formatter={(v: number | undefined) => [fmtCur(v ?? 0), '']} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem' }}>
                                {a.fees.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>{f.name}</span>
                                        </span>
                                        <span style={{ color: '#ef4444', fontWeight: 500 }}>{fmtCur(f.value)} <span style={{ color: 'var(--text-muted)' }}>({fmtPct(a.revenue > 0 ? f.value / a.revenue * 100 : 0)})</span></span>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 4, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                    <span style={{ color: 'var(--text-primary)' }}>Tổng</span>
                                    <span style={{ color: '#ef4444' }}>{fmtCur(a.totalFees)} ({fmtPct(a.revenue > 0 ? a.totalFees / a.revenue * 100 : 0)})</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===================== Row 2: Revenue Timeline ===================== */}
                    <div style={cardStyle}>
                        {sectionTitle(<TrendingUp size={16} style={{ color: '#22c55e' }} />, 'Doanh thu theo ngày')}
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={a.dailyData} margin={{ left: 10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `${v}M`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    formatter={(v: number | undefined, name: string | undefined) => [name === 'Doanh thu (M)' ? `${(v ?? 0).toFixed(1)}M (${fmtCur((v ?? 0) * 1e6)})` : `${v ?? 0} đơn`, name ?? '']} />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu (M)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                                <Line yAxisId="right" type="monotone" dataKey="orders" name="Số đơn" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ===================== Row 3: Variant Analysis + Order Funnel ===================== */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                        <div style={cardStyle}>
                            {sectionTitle(<Tag size={16} style={{ color: '#818cf8' }} />, `Phân loại sản phẩm (${a.variants.length} variants)`)}
                            <div style={{ overflow: 'auto', maxHeight: 360 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                                            <th style={thS}>Phân loại</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>SL bán</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>Doanh thu</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>% DT</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>Hủy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {a.variants.map((v, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid var(--border-default)' }}>
                                                <td style={{ ...tdS, fontWeight: i < 3 ? 600 : 400 }}>{v.name}</td>
                                                <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(v.qty)}</td>
                                                <td style={{ ...tdS, textAlign: 'right', color: '#22c55e', fontWeight: 500 }}>{fmtCur(v.revenue)}</td>
                                                <td style={{ ...tdS, textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                                        <div style={{ width: 30, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(v.share, 100)}%`, height: '100%', borderRadius: 2, background: '#818cf8' }} />
                                                        </div>
                                                        {fmtPct(v.share)}
                                                    </div>
                                                </td>
                                                <td style={{ ...tdS, textAlign: 'right', color: v.cancelRate > 25 ? '#ef4444' : 'var(--text-muted)', fontWeight: v.cancelRate > 25 ? 600 : 400 }}>
                                                    {fmtPct(v.cancelRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={cardStyle}>
                            {sectionTitle(<ShoppingCart size={16} style={{ color: '#2dd4bf' }} />, 'Phễu đơn hàng')}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                                {[
                                    { label: 'Tổng đơn', value: a.total, pct: 100, color: '#818cf8', icon: '📦' },
                                    { label: 'Hoàn thành', value: a.completed, pct: a.total > 0 ? a.completed / a.total * 100 : 0, color: '#22c55e', icon: '✅' },
                                    { label: 'Đã hủy', value: a.cancelled, pct: a.total > 0 ? a.cancelled / a.total * 100 : 0, color: '#ef4444', icon: '❌' },
                                    { label: 'Trả hàng', value: a.returned, pct: a.total > 0 ? a.returned / a.total * 100 : 0, color: '#f59e0b', icon: '🔁' },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {item.icon} {item.label}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.color }}>
                                                {fmtNum(item.value)} <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-muted)' }}>({fmtPct(item.pct)})</span>
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                            <div style={{ width: `${item.pct}%`, height: '100%', borderRadius: 4, background: item.color, transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {Object.keys(a.cancelBy).length > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Hủy bởi:</div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {Object.entries(a.cancelBy).map(([by, count]) => (
                                            <span key={by} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                {by}: {count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===================== Row 4: Cancel Reasons + Geographic ===================== */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={cardStyle}>
                            {sectionTitle(<AlertTriangle size={16} style={{ color: '#ef4444' }} />, `Lý do hủy đơn (${a.cancelled} đơn)`)}
                            {a.cancelReasonData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={a.cancelReasonData} layout="vertical" margin={{ left: 140, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={140} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: '0.78rem' }}
                                            formatter={(v: number | undefined) => [`${v ?? 0} đơn`, 'Số lượng']} />
                                        <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (<p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Không có đơn hủy</p>)}
                        </div>

                        <div style={cardStyle}>
                            {sectionTitle(<MapPin size={16} style={{ color: '#f59e0b' }} />, `Top Tỉnh/Thành phố (${a.provinces.length})`)}
                            <div style={{ overflow: 'auto', maxHeight: 300 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                                            <th style={thS}>Tỉnh/TP</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>Đơn</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>Doanh thu</th>
                                            <th style={{ ...thS, textAlign: 'right' }}>Hủy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {a.provinces.map((p, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid var(--border-default)' }}>
                                                <td style={{ ...tdS, fontWeight: i < 3 ? 600 : 400 }}>{p.name}</td>
                                                <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(p.orders)}</td>
                                                <td style={{ ...tdS, textAlign: 'right', color: '#22c55e', fontWeight: 500 }}>{fmtCur(p.revenue)}</td>
                                                <td style={{ ...tdS, textAlign: 'right', color: p.cancelRate > 25 ? '#ef4444' : 'var(--text-muted)' }}>
                                                    {fmtPct(p.cancelRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ===================== Row 5: Price Distribution ===================== */}
                    <div style={cardStyle}>
                        {sectionTitle(<Tag size={16} style={{ color: '#f59e0b' }} />, 'Phân tích Giá bán & Discount')}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div>
                                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>Phân bổ giá bán thực tế (sau discount)</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={a.priceDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                        <XAxis dataKey="price" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: '0.78rem' }}
                                            formatter={(v: number | undefined) => [`${v ?? 0} sp`, 'SL']} />
                                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Tóm tắt chiến lược giá</h4>
                                {[
                                    { label: 'Giá niêm yết TB', value: fmtCur(a.compQty > 0 ? a.originalTotal / a.compQty : 0), color: '#818cf8' },
                                    { label: 'Giá bán thực TB', value: fmtCur(a.avgPrice), color: '#22c55e' },
                                    { label: 'Mức giảm giá TB', value: fmtPct(a.originalTotal > 0 ? (a.originalTotal - a.revenue) / a.originalTotal * 100 : 0), color: '#ef4444' },
                                    { label: 'Seller tự giảm', value: `${fmtCur(a.sellerDisc)} (${fmtPct(a.originalTotal > 0 ? a.sellerDisc / a.originalTotal * 100 : 0)})`, color: '#ef4444' },
                                    { label: platform === 'tiktok' ? 'Platform trợ giá' : 'Shopee trợ giá', value: `${fmtCur(a.platformDisc)} (${fmtPct(a.originalTotal > 0 ? a.platformDisc / a.originalTotal * 100 : 0)})`, color: '#f59e0b' },
                                    { label: 'Phí sàn / DT', value: fmtPct(a.revenue > 0 ? a.totalFees / a.revenue * 100 : 0), color: '#ef4444' },
                                    ...(costPrice > 0 ? [
                                        { label: 'Giá vốn', value: fmtCur(costPrice), color: '#f59e0b' },
                                        { label: 'Biên LN ròng', value: fmtPct(a.revenue > 0 ? a.netProfit / a.revenue * 100 : 0), color: a.netProfit > 0 ? '#22c55e' : '#ef4444' },
                                    ] : []),
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-default)', fontSize: '0.78rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                        <span style={{ fontWeight: 600, color: item.color }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const thS: React.CSSProperties = {
    padding: '8px 6px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap',
};

const tdS: React.CSSProperties = {
    padding: '6px', color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: '0.75rem',
};
