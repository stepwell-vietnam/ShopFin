'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
    LayoutDashboard,
    Store,
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    DollarSign,
    ArrowRight,
    BarChart3,
    Filter,
    Package,
    Percent,
    AlertTriangle,
    Tag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface ShopStat {
    id: string;
    name: string;
    platform: string;
    revenue: number;
    settlement: number;
    fees: number;
    orders: number;
    completed: number;
    cancelled: number;
    monthlyRevenue: Array<{ month: string; revenue: number; settlement: number; fees: number }>;
    monthlyOrders: Array<{ month: string; orders: number; completed: number; cancelled: number }>;
}

interface SkuShopStat {
    shopId: string;
    shopName: string;
    platform: string;
    orders: number;
    completed: number;
    cancelled: number;
    revenue: number;
    settlement: number;
    fees: number;
    qty: number;
}

interface SkuStat {
    sku: string;
    productName: string;
    shops: SkuShopStat[];
    totalOrders: number;
    totalCompleted: number;
    totalCancelled: number;
    totalRevenue: number;
    totalSettlement: number;
    totalFees: number;
    totalQty: number;
    cancelRate: number;
}

interface DashboardData {
    shopStats: ShopStat[];
    monthlyTrend: Array<{ month: string; revenue: number; orders: number; fees: number }>;
    platformStats: {
        shopee: { shops: number; revenue: number; orders: number };
        tiktok: { shops: number; revenue: number; orders: number };
    };
    totalShops: number;
    totalMonths: number;
    skuStats: SkuStat[];
}

const SHOP_COLORS = ['#2dd4bf', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c', '#38bdf8', '#f87171', '#a3e635'];

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [platformFilter, setPlatformFilter] = useState<'all' | 'shopee' | 'tiktok'>('all');

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetch('/api/dashboard')
                .then(r => r.json())
                .then(d => { setData(d); setLoading(false); })
                .catch(() => setLoading(false));
        }
    }, [status]);

    const filteredShops = useMemo(() => {
        if (!data) return [];
        if (platformFilter === 'all') return data.shopStats;
        return data.shopStats.filter(s => s.platform === platformFilter);
    }, [data, platformFilter]);

    const totals = useMemo(() => {
        const shops = filteredShops;
        return {
            revenue: shops.reduce((s, sh) => s + sh.revenue, 0),
            orders: shops.reduce((s, sh) => s + sh.orders, 0),
            fees: shops.reduce((s, sh) => s + sh.fees, 0),
            settlement: shops.reduce((s, sh) => s + sh.settlement, 0),
            completed: shops.reduce((s, sh) => s + sh.completed, 0),
            cancelled: shops.reduce((s, sh) => s + sh.cancelled, 0),
        };
    }, [filteredShops]);

    // Cost prices from localStorage (cross-shop) — must be before conditional returns
    const costPrices = useMemo(() => {
        if (typeof window === 'undefined') return {};
        try {
            const all: Record<string, number> = {};
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith('shopfin-cost-prices-')) {
                    const d = JSON.parse(localStorage.getItem(key) || '{}');
                    Object.assign(all, d);
                }
            }
            return all;
        } catch { return {}; }
    }, []);

    // Filter SKU stats by platform — must be before conditional returns
    const filteredSkuStats = useMemo(() => {
        if (!data?.skuStats) return [];
        if (platformFilter === 'all') return data.skuStats;
        return data.skuStats
            .map(s => ({
                ...s,
                shops: s.shops.filter(sh => sh.platform === platformFilter),
            }))
            .filter(s => s.shops.length > 0)
            .map(s => ({
                ...s,
                totalRevenue: s.shops.reduce((sum, sh) => sum + sh.revenue, 0),
                totalSettlement: s.shops.reduce((sum, sh) => sum + sh.settlement, 0),
                totalFees: s.shops.reduce((sum, sh) => sum + sh.fees, 0),
                totalOrders: s.shops.reduce((sum, sh) => sum + sh.orders, 0),
                totalCompleted: s.shops.reduce((sum, sh) => sum + sh.completed, 0),
                totalCancelled: s.shops.reduce((sum, sh) => sum + sh.cancelled, 0),
                totalQty: s.shops.reduce((sum, sh) => sum + sh.qty, 0),
                cancelRate: s.shops.reduce((sum, sh) => sum + sh.orders, 0) > 0
                    ? (s.shops.reduce((sum, sh) => sum + sh.cancelled, 0) / s.shops.reduce((sum, sh) => sum + sh.orders, 0)) * 100 : 0,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [data?.skuStats, platformFilter]);

    if (status === 'loading' || loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
    }
    if (!session || !data) return null;

    const fmt = (n: number) => n.toLocaleString('vi-VN');
    const fmtCur = (n: number) => {
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'tỷ';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'tr';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
        return Math.round(n).toLocaleString('vi-VN') + 'đ';
    };
    const fmtPct = (n: number) => n.toFixed(1) + '%';
    const hasData = data.shopStats.some(s => s.revenue > 0 || s.orders > 0);

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        <LayoutDashboard style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} size={24} />
                        Dashboard
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Xin chào, {session.user?.name || session.user?.email} 👋
                    </p>
                </div>
                {/* Platform Filter */}
                <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'shopee', 'tiktok'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPlatformFilter(p)}
                            style={{
                                padding: '6px 14px', borderRadius: 8,
                                border: `2px solid ${platformFilter === p ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                background: platformFilter === p ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            {p === 'all' ? <><Filter size={12} /> Tất cả</> :
                                <><img src={`/logo-${p}.png`} alt={p} style={{ width: 14, height: 14, objectFit: 'contain' }} /> {p === 'shopee' ? 'Shopee' : 'TikTok'}</>}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Gian hàng', value: `${filteredShops.length}`, icon: Store, color: '#2dd4bf' },
                    { label: 'Tổng doanh thu', value: `${fmt(totals.revenue)}đ`, icon: DollarSign, color: '#22c55e' },
                    { label: 'Tổng đơn', value: fmt(totals.orders), icon: ShoppingCart, color: '#3b82f6' },
                    { label: 'Tổng phí', value: `${fmt(totals.fees)}đ`, icon: TrendingDown, color: '#ef4444' },
                    { label: 'Thu ròng', value: `${fmt(totals.settlement)}đ`, icon: TrendingUp, color: '#a855f7' },
                ].map((kpi, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 12, padding: '16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <kpi.icon size={16} style={{ color: kpi.color }} />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{kpi.label}</span>
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Revenue Bar Chart + Shop Comparison */}
            {hasData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* Revenue by Shop (Horizontal Bar Chart) */}
                    <div style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        borderRadius: 12, padding: '20px',
                    }}>
                        <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BarChart3 size={16} style={{ color: '#818cf8' }} /> Doanh thu theo gian hàng
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredShops
                                .sort((a, b) => b.revenue - a.revenue)
                                .map((shop, i) => {
                                    const maxRev = Math.max(...filteredShops.map(s => s.revenue), 1);
                                    const pct = (shop.revenue / maxRev) * 100;
                                    return (
                                        <div key={shop.id}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <img src={shop.platform === 'shopee' ? '/logo-shopee.png' : '/logo-tiktok.png'} alt={shop.platform} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{shop.name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: SHOP_COLORS[i % SHOP_COLORS.length], fontWeight: 600 }}>{fmt(shop.revenue)}đ</span>
                                            </div>
                                            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 4,
                                                    background: SHOP_COLORS[i % SHOP_COLORS.length],
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Platform Breakdown */}
                    <div style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        borderRadius: 12, padding: '20px',
                    }}>
                        <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Store size={16} style={{ color: '#f472b6' }} /> So sánh nền tảng
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* Shopee card */}
                            <div style={{
                                background: 'var(--bg-primary)', borderRadius: 10, padding: '16px',
                                border: '1px solid var(--border-default)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <img src="/logo-shopee.png" alt="Shopee" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Shopee</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Doanh thu</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ee4d2d', marginBottom: 8 }}>{fmt(data.platformStats.shopee.revenue)}đ</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Đơn hàng</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(data.platformStats.shopee.orders)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>{data.platformStats.shopee.shops} gian hàng</div>
                            </div>
                            {/* TikTok card */}
                            <div style={{
                                background: 'var(--bg-primary)', borderRadius: 10, padding: '16px',
                                border: '1px solid var(--border-default)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <img src="/logo-tiktok.png" alt="TikTok" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>TikTok</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Doanh thu</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ff0050', marginBottom: 8 }}>{fmt(data.platformStats.tiktok.revenue)}đ</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Đơn hàng</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(data.platformStats.tiktok.orders)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>{data.platformStats.tiktok.shops} gian hàng</div>
                            </div>
                        </div>

                        {/* Revenue share */}
                        {(data.platformStats.shopee.revenue + data.platformStats.tiktok.revenue) > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Tỷ trọng doanh thu</div>
                                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(data.platformStats.shopee.revenue / (data.platformStats.shopee.revenue + data.platformStats.tiktok.revenue)) * 100}%`,
                                        background: '#ee4d2d', height: '100%',
                                    }} />
                                    <div style={{
                                        flex: 1, background: '#ff0050', height: '100%',
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    <span>Shopee {((data.platformStats.shopee.revenue / (data.platformStats.shopee.revenue + data.platformStats.tiktok.revenue)) * 100).toFixed(1)}%</span>
                                    <span>TikTok {((data.platformStats.tiktok.revenue / (data.platformStats.shopee.revenue + data.platformStats.tiktok.revenue)) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Monthly Trend */}
            {data.monthlyTrend.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    borderRadius: 12, padding: '20px', marginBottom: 24,
                }}>
                    <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={16} style={{ color: '#fbbf24' }} /> Xu hướng theo tháng
                    </h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Tháng</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Doanh thu</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Đơn hàng</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Phí</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Biên lợi nhuận</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>MoM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.monthlyTrend.map((m, i) => {
                                    const prev = i > 0 ? data.monthlyTrend[i - 1] : null;
                                    const mom = prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue * 100) : null;
                                    const margin = m.revenue > 0 ? ((m.revenue - m.fees) / m.revenue * 100) : 0;
                                    return (
                                        <tr key={m.month} style={{ borderTop: '1px solid var(--border-default)' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.month}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmt(m.revenue)}đ</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(m.orders)}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{fmt(m.fees)}đ</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: margin >= 70 ? '#22c55e' : margin >= 50 ? '#fbbf24' : '#ef4444', fontWeight: 500 }}>
                                                {margin.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                {mom !== null ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 2,
                                                        padding: '2px 8px', borderRadius: 6,
                                                        background: mom >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: mom >= 0 ? '#22c55e' : '#ef4444',
                                                        fontSize: '0.72rem', fontWeight: 600,
                                                    }}>
                                                        {mom >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                        {mom >= 0 ? '+' : ''}{mom.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========== Cross-Shop SKU Analysis ========== */}
            {filteredSkuStats.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    borderRadius: 12, overflow: 'hidden', marginBottom: 24,
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={18} style={{ color: '#2dd4bf' }} />
                            Phân tích Sản phẩm Cross-Shop ({filteredSkuStats.length} SKU)
                        </h2>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click "+Nhập" để thêm giá vốn · Đơn vị: nghìn đồng (K)</span>
                    </div>

                    {/* Stacked Bar Chart: Top 10 SKU by Revenue (Shopee vs TikTok) */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                        <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BarChart3 size={14} style={{ color: '#818cf8' }} /> Top 10 SKU — Doanh thu theo Nền tảng
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={filteredSkuStats.slice(0, 10).map(s => {
                                const shopee = s.shops.filter(sh => sh.platform === 'shopee').reduce((sum, sh) => sum + sh.revenue, 0) / 1e6;
                                const tiktok = s.shops.filter(sh => sh.platform === 'tiktok').reduce((sum, sh) => sum + sh.revenue, 0) / 1e6;
                                return { sku: s.sku, shopee: Math.round(shopee * 10) / 10, tiktok: Math.round(tiktok * 10) / 10, total: Math.round((shopee + tiktok) * 10) / 10 };
                            })} margin={{ left: 10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis dataKey="sku" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `${v}M`} />
                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                    formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}M (${fmtCur((v ?? 0) * 1e6)})`, undefined]} />
                                <Legend />
                                <Bar dataKey="shopee" name="🛒 Shopee" stackId="a" fill="#ee4d2d" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="tiktok" name="🎵 TikTok" stackId="a" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* SKU Table */}
                    <div style={{ overflow: 'auto', maxHeight: 500 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 2 }}>
                                    <th style={thD}>#</th>
                                    <th style={thD}>SKU</th>
                                    <th style={thD}>Tên SP</th>
                                    <th style={{ ...thD, textAlign: 'center' }}>Nền tảng</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>SL</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Doanh thu</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Thực nhận</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Phí sàn (%)</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Giá vốn</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>LN ròng</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Biên LN</th>
                                    <th style={{ ...thD, textAlign: 'right' }}>Hủy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSkuStats.slice(0, 20).map((s, i) => {
                                    const cost = costPrices[s.sku] || 0;
                                    const totalCost = cost * s.totalQty;
                                    const netProfit = cost > 0 ? s.totalSettlement - totalCost : 0;
                                    const margin = cost > 0 && s.totalRevenue > 0 ? (netProfit / s.totalRevenue) * 100 : 0;
                                    const feeRate = s.totalRevenue > 0 ? (s.totalFees / s.totalRevenue) * 100 : 0;
                                    const isTop3 = i < 3;
                                    const isLoss = cost > 0 && netProfit < 0;
                                    const highCancel = s.cancelRate > 20;

                                    const shopeeRev = s.shops.filter(sh => sh.platform === 'shopee').reduce((sum, sh) => sum + sh.revenue, 0);
                                    const tiktokRev = s.shops.filter(sh => sh.platform === 'tiktok').reduce((sum, sh) => sum + sh.revenue, 0);

                                    return (
                                        <tr key={s.sku} style={{
                                            borderTop: '1px solid var(--border-default)',
                                            background: isLoss ? 'rgba(239,68,68,0.04)' : isTop3 ? 'rgba(45,212,191,0.03)' : undefined,
                                        }}>
                                            <td style={{ ...tdD, fontWeight: 700, color: isTop3 ? '#2dd4bf' : 'var(--text-muted)' }}>{i + 1}</td>
                                            <td style={{ ...tdD, fontFamily: 'monospace', fontWeight: 600 }}>{s.sku}</td>
                                            <td style={{ ...tdD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={s.productName}>
                                                {s.productName.substring(0, 35)}{s.productName.length > 35 ? '…' : ''}
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    {shopeeRev > 0 && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(238,77,45,0.1)', color: '#ee4d2d' }}>🛒 {fmtCur(shopeeRev)}</span>}
                                                    {tiktokRev > 0 && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}>🎵 {fmtCur(tiktokRev)}</span>}
                                                </div>
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'right', fontWeight: 500 }}>{s.totalQty.toLocaleString('vi-VN')}</td>
                                            <td style={{ ...tdD, textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>{fmtCur(s.totalRevenue)}</td>
                                            <td style={{ ...tdD, textAlign: 'right', color: '#a855f7', fontWeight: 500 }}>{fmtCur(s.totalSettlement)}</td>
                                            <td style={{ ...tdD, textAlign: 'right', color: feeRate > 30 ? '#ef4444' : 'var(--text-muted)' }}>
                                                {fmtCur(s.totalFees)} <span style={{ fontSize: '0.68rem' }}>({fmtPct(feeRate)})</span>
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'right', color: 'var(--text-muted)' }}>
                                                {cost > 0 ? fmtCur(cost) + '/sp' : <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'right', fontWeight: 600, color: cost > 0 ? (netProfit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                                {cost > 0 ? fmtCur(netProfit) : '—'}
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'right', fontWeight: 600, color: cost > 0 ? (margin > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                                {cost > 0 ? fmtPct(margin) : '—'}
                                            </td>
                                            <td style={{ ...tdD, textAlign: 'right', color: highCancel ? '#ef4444' : 'var(--text-muted)', fontWeight: highCancel ? 600 : 400 }}>
                                                {fmtPct(s.cancelRate)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Smart Warnings */}
                    {(() => {
                        const warnings: { icon: string; text: string; color: string }[] = [];
                        const lossSkus = filteredSkuStats.filter(s => {
                            const cost = costPrices[s.sku] || 0;
                            return cost > 0 && (s.totalSettlement - cost * s.totalQty) < 0;
                        });
                        if (lossSkus.length > 0) {
                            warnings.push({ icon: '🔴', text: `${lossSkus.length} SKU đang BÁN LỖ: ${lossSkus.map(s => s.sku).join(', ')}`, color: '#ef4444' });
                        }
                        const highFeeSkus = filteredSkuStats.filter(s => s.totalRevenue > 0 && (s.totalFees / s.totalRevenue) > 0.30);
                        if (highFeeSkus.length > 0) {
                            warnings.push({ icon: '🟠', text: `${highFeeSkus.length} SKU phí sàn >30%: ${highFeeSkus.slice(0, 5).map(s => `${s.sku} (${fmtPct(s.totalFees / s.totalRevenue * 100)})`).join(', ')}`, color: '#f59e0b' });
                        }
                        const highCancelSkus = filteredSkuStats.filter(s => s.cancelRate > 25);
                        if (highCancelSkus.length > 0) {
                            warnings.push({ icon: '🟡', text: `${highCancelSkus.length} SKU hủy >25%: ${highCancelSkus.slice(0, 5).map(s => `${s.sku} (${fmtPct(s.cancelRate)})`).join(', ')}`, color: '#f59e0b' });
                        }
                        // ABC analysis
                        const totalRev = filteredSkuStats.reduce((s, sk) => s + sk.totalRevenue, 0);
                        let cumRev = 0;
                        let aCount = 0;
                        for (const s of filteredSkuStats) {
                            cumRev += s.totalRevenue;
                            aCount++;
                            if (cumRev / totalRev >= 0.8) break;
                        }
                        if (aCount <= 3 && filteredSkuStats.length > 5) {
                            warnings.push({ icon: '⚠️', text: `Rủi ro tập trung: chỉ ${aCount} SKU (${filteredSkuStats.slice(0, aCount).map(s => s.sku).join(', ')}) chiếm 80% doanh thu`, color: '#f59e0b' });
                        }

                        if (warnings.length === 0) return null;
                        return (
                            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {warnings.map((w, i) => (
                                    <div key={i} style={{
                                        padding: '8px 12px', borderRadius: 8,
                                        background: `${w.color}10`, border: `1px solid ${w.color}30`,
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        fontSize: '0.78rem', color: w.color,
                                    }}>
                                        <AlertTriangle size={14} /> {w.icon} {w.text}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Shop Comparison Table */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                borderRadius: 12, overflow: 'hidden', marginBottom: 24,
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        So sánh gian hàng
                    </h2>
                    <button
                        onClick={() => router.push('/shops')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 14px', borderRadius: 8,
                            background: 'var(--accent-primary)', color: '#fff',
                            border: 'none', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        Quản lý <ArrowRight size={12} />
                    </button>
                </div>

                {filteredShops.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                        <Store size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: '0.88rem' }}>Chưa có gian hàng nào</p>
                        <p style={{ fontSize: '0.78rem', marginTop: 4 }}>
                            Vào <strong>Gian hàng</strong> để tạo gian hàng đầu tiên
                        </p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-tertiary)' }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Gian hàng</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Doanh thu</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Đơn hàng</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Phí</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Thu ròng</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Tỷ trọng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredShops
                                .sort((a, b) => b.revenue - a.revenue)
                                .map((shop, i) => {
                                    const revShare = totals.revenue > 0 ? (shop.revenue / totals.revenue * 100) : 0;
                                    return (
                                        <tr
                                            key={shop.id}
                                            style={{ borderTop: '1px solid var(--border-default)', cursor: 'pointer' }}
                                            onClick={() => router.push(`/shops/${shop.id}`)}
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <img src={shop.platform === 'shopee' ? '/logo-shopee.png' : '/logo-tiktok.png'} alt={shop.platform} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shop.name}</div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{shop.platform.toUpperCase()}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>{fmt(shop.revenue)}đ</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(shop.orders)}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{fmt(shop.fees)}đ</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#a855f7' }}>{fmt(shop.settlement)}đ</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                                    <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${revShare}%`, height: '100%', borderRadius: 3, background: SHOP_COLORS[i % SHOP_COLORS.length] }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, minWidth: 36 }}>{revShare.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {/* Totals row */}
                            <tr style={{ borderTop: '2px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>TỔNG CỘNG</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{fmt(totals.revenue)}đ</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(totals.orders)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(totals.fees)}đ</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#a855f7' }}>{fmt(totals.settlement)}đ</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>100%</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const thD: React.CSSProperties = {
    padding: '10px 8px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-muted)', fontSize: '0.73rem', whiteSpace: 'nowrap',
};

const tdD: React.CSSProperties = {
    padding: '7px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: '0.78rem',
};
