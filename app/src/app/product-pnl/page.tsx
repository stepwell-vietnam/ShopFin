'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    BarChart3, Package, TrendingUp, DollarSign, AlertTriangle, Download,
    Filter, ArrowLeft, Edit3, Percent,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';

// ---------- Types ----------

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
    skuStats: SkuStat[];
    shopStats: { id: string; name: string; platform: string }[];
    totalShops: number;
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

const COST_STORAGE_KEY = 'shopfin-cost-prices';

function loadAllCostPrices(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
        const all: Record<string, number> = {};
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith(COST_STORAGE_KEY)) {
                const d = JSON.parse(localStorage.getItem(key) || '{}');
                Object.assign(all, d);
            }
        }
        return all;
    } catch { return {}; }
}

function saveGlobalCostPrices(prices: Record<string, number>) {
    if (typeof window === 'undefined') return;
    // Save to a global key for P&L page usage
    localStorage.setItem(`${COST_STORAGE_KEY}-global`, JSON.stringify(prices));
    // Also save to per-shop keys to maintain compatibility
    // We need to merge, not overwrite
    for (const key of Object.keys(localStorage)) {
        if (key.startsWith(COST_STORAGE_KEY + '-') && key !== `${COST_STORAGE_KEY}-global`) {
            const d = JSON.parse(localStorage.getItem(key) || '{}');
            for (const [sku, price] of Object.entries(prices)) {
                if (d[sku] !== undefined || price > 0) {
                    d[sku] = price;
                }
            }
            localStorage.setItem(key, JSON.stringify(d));
        }
    }
}

const COLORS = ['#2dd4bf', '#818cf8', '#f59e0b', '#ef4444', '#22c55e', '#f472b6', '#a78bfa', '#fb923c'];

// ---------- Cost Input Component ----------

function CostInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value > 0 ? String(value / 1000) : '');

    useEffect(() => { setText(value > 0 ? String(value / 1000) : ''); }, [value]);

    if (!editing) {
        return (
            <span
                onClick={() => setEditing(true)}
                style={{
                    cursor: 'pointer', color: value > 0 ? '#f59e0b' : 'var(--text-muted)',
                    fontWeight: value > 0 ? 500 : 400, fontSize: '0.78rem',
                    display: 'flex', alignItems: 'center', gap: 4,
                }}
            >
                {value > 0 ? `${(value / 1000).toFixed(0)}K` : '+ Nhập'}
                <Edit3 size={10} style={{ opacity: 0.5 }} />
            </span>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
                autoFocus type="number" value={text}
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
                placeholder="110"
                style={{
                    width: 52, padding: '2px 4px', borderRadius: 4,
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

export default function ProductPnlPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [platformFilter, setPlatformFilter] = useState<'all' | 'shopee' | 'tiktok'>('all');
    const [costPrices, setCostPrices] = useState<Record<string, number>>({});
    const [sortBy, setSortBy] = useState<'revenue' | 'profit' | 'margin' | 'qty' | 'cancel'>('revenue');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

    useEffect(() => {
        setCostPrices(loadAllCostPrices());
    }, []);

    const updateCost = useCallback((sku: string, price: number) => {
        setCostPrices(prev => {
            const next = { ...prev, [sku]: price };
            saveGlobalCostPrices(next);
            return next;
        });
    }, []);

    // Filtered and sorted SKU stats
    const skuStats = useMemo(() => {
        if (!data?.skuStats) return [];
        let stats = data.skuStats;

        if (platformFilter !== 'all') {
            stats = stats
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
                }));
        }

        // Sort
        return [...stats].sort((a, b) => {
            const costA = costPrices[a.sku] || 0;
            const costB = costPrices[b.sku] || 0;
            const profitA = costA > 0 ? a.totalSettlement - costA * a.totalQty : 0;
            const profitB = costB > 0 ? b.totalSettlement - costB * b.totalQty : 0;
            const marginA = costA > 0 && a.totalRevenue > 0 ? profitA / a.totalRevenue * 100 : -999;
            const marginB = costB > 0 && b.totalRevenue > 0 ? profitB / b.totalRevenue * 100 : -999;

            let va = 0, vb = 0;
            switch (sortBy) {
                case 'revenue': va = a.totalRevenue; vb = b.totalRevenue; break;
                case 'profit': va = profitA; vb = profitB; break;
                case 'margin': va = marginA; vb = marginB; break;
                case 'qty': va = a.totalQty; vb = b.totalQty; break;
                case 'cancel': va = a.cancelRate; vb = b.cancelRate; break;
            }
            return sortDir === 'desc' ? vb - va : va - vb;
        });
    }, [data?.skuStats, platformFilter, costPrices, sortBy, sortDir]);

    // Totals
    const totals = useMemo(() => {
        const rev = skuStats.reduce((s, sk) => s + sk.totalRevenue, 0);
        const sett = skuStats.reduce((s, sk) => s + sk.totalSettlement, 0);
        const fees = skuStats.reduce((s, sk) => s + sk.totalFees, 0);
        const qty = skuStats.reduce((s, sk) => s + sk.totalQty, 0);
        const totalCost = skuStats.reduce((s, sk) => s + (costPrices[sk.sku] || 0) * sk.totalQty, 0);
        const netProfit = sett - totalCost;
        const costEntered = skuStats.filter(sk => costPrices[sk.sku] > 0).length;
        return { rev, sett, fees, qty, totalCost, netProfit, costEntered, margin: rev > 0 ? netProfit / rev * 100 : 0 };
    }, [skuStats, costPrices]);

    // ABC classification
    const abcData = useMemo(() => {
        let cumRev = 0;
        const totalRev = skuStats.reduce((s, sk) => s + sk.totalRevenue, 0);
        return skuStats.map(sk => {
            cumRev += sk.totalRevenue;
            const cumPct = totalRev > 0 ? cumRev / totalRev * 100 : 0;
            const cls = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
            return { ...sk, cumPct, cls };
        });
    }, [skuStats]);

    // Scatter data for profit vs qty chart
    const scatterData = useMemo(() => {
        return skuStats
            .filter(sk => costPrices[sk.sku] > 0)
            .map(sk => {
                const cost = costPrices[sk.sku] || 0;
                const profit = sk.totalSettlement - cost * sk.totalQty;
                const margin = sk.totalRevenue > 0 ? profit / sk.totalRevenue * 100 : 0;
                return { sku: sk.sku, qty: sk.totalQty, margin, profit, revenue: sk.totalRevenue };
            });
    }, [skuStats, costPrices]);

    // Export CSV
    const exportCSV = useCallback(() => {
        const headers = ['#', 'SKU', 'ABC', 'Tên SP', 'Nền tảng', 'SL', 'Doanh thu', 'Thực nhận', 'Phí sàn', '% Phí', 'Giá vốn/sp', 'Tổng giá vốn', 'LN ròng', 'Biên LN', '% Hủy'];
        const rows = abcData.map((s, i) => {
            const cost = costPrices[s.sku] || 0;
            const totalCost = cost * s.totalQty;
            const profit = cost > 0 ? s.totalSettlement - totalCost : 0;
            const margin = cost > 0 && s.totalRevenue > 0 ? profit / s.totalRevenue * 100 : 0;
            const feeRate = s.totalRevenue > 0 ? s.totalFees / s.totalRevenue * 100 : 0;
            const platforms = s.shops.map(sh => sh.platform).join('+');
            return [i + 1, s.sku, s.cls, `"${s.productName}"`, platforms, s.totalQty, s.totalRevenue, s.totalSettlement, s.totalFees, feeRate.toFixed(1), cost, totalCost, profit, margin.toFixed(1), s.cancelRate.toFixed(1)];
        });
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ShopFin_PnL_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [abcData, costPrices]);

    if (status === 'loading' || loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
    }
    if (!session || !data) return null;

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const sortIcon = (col: typeof sortBy) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

    return (
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={24} style={{ color: '#2dd4bf' }} />
                        Báo cáo P&L Sản phẩm
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Phân tích lợi nhuận ròng theo SKU — tổng hợp {data.totalShops} gian hàng · {skuStats.length} SKU
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {/* Platform Filter */}
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
                    <button onClick={exportCSV} style={{
                        padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                        background: '#22c55e', color: '#fff', border: 'none',
                        fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <Download size={12} /> Export CSV
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                {[
                    { label: 'Tổng Doanh thu', value: fmtCur(totals.rev), color: '#22c55e', icon: TrendingUp },
                    { label: 'Thực nhận', value: fmtCur(totals.sett), color: '#a855f7', icon: DollarSign },
                    { label: 'Tổng Phí sàn', value: fmtCur(totals.fees), sub: fmtPct(totals.rev > 0 ? totals.fees / totals.rev * 100 : 0), color: '#ef4444', icon: Percent },
                    { label: 'Tổng Giá vốn', value: fmtCur(totals.totalCost), sub: `${totals.costEntered}/${skuStats.length} SKU`, color: '#f59e0b', icon: Package },
                    { label: 'LN Ròng', value: fmtCur(totals.netProfit), sub: totals.costEntered > 0 ? fmtPct(totals.margin) : 'Chưa nhập giá vốn', color: totals.netProfit > 0 ? '#22c55e' : '#ef4444', icon: DollarSign },
                    { label: 'Tổng SP bán', value: fmtNum(totals.qty), sub: `${skuStats.length} SKU`, color: '#2dd4bf', icon: Package },
                ].map((c, i) => (
                    <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-default)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.label}</span>
                            <c.icon size={14} style={{ color: c.color, opacity: 0.6 }} />
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                        {c.sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Scatter: SKU Performance Matrix (only if cost entered) */}
            {scatterData.length > 2 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-default)' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={16} style={{ color: '#818cf8' }} /> Ma trận SKU: Biên LN vs Số lượng bán
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>Chỉ SKU đã nhập giá vốn · Kích thước = Doanh thu</span>
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ left: 10, right: 30, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="qty" type="number" name="SL bán" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} label={{ value: 'Số lượng bán', position: 'bottom', fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis dataKey="margin" type="number" name="Biên LN %" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} label={{ value: 'Biên LN %', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                            <ZAxis dataKey="revenue" range={[60, 400]} name="Doanh thu" />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: '0.78rem' }}
                                formatter={(value: number, name: string) => {
                                    if (name === 'Doanh thu') return [fmtCur(value), name];
                                    if (name === 'Biên LN %') return [fmtPct(value), name];
                                    return [fmtNum(value), name];
                                }}
                                labelFormatter={(v) => `SKU: ${v}`}
                            />
                            <Scatter data={scatterData} nameKey="sku">
                                {scatterData.map((entry, i) => (
                                    <Cell key={i} fill={entry.margin > 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Full P&L Table */}
            <div style={{
                background: 'var(--bg-secondary)', borderRadius: 12,
                border: '1px solid var(--border-default)', overflow: 'hidden',
            }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={16} style={{ color: '#2dd4bf' }} />
                        Bảng P&L Chi tiết ({skuStats.length} SKU)
                    </h2>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click cột tiêu đề để sắp xếp · Nhập giá vốn (nghìn đồng K)</span>
                </div>
                <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 2 }}>
                                <th style={th}>#</th>
                                <th style={th}>ABC</th>
                                <th style={th}>SKU</th>
                                <th style={th}>Tên SP</th>
                                <th style={{ ...th, textAlign: 'center' }}>Nền tảng</th>
                                <th style={{ ...th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('qty')}>SL{sortIcon('qty')}</th>
                                <th style={{ ...th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('revenue')}>Doanh thu{sortIcon('revenue')}</th>
                                <th style={{ ...th, textAlign: 'right' }}>Thực nhận</th>
                                <th style={{ ...th, textAlign: 'right' }}>Phí sàn (%)</th>
                                <th style={{ ...th, textAlign: 'right' }}>Giá vốn</th>
                                <th style={{ ...th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('profit')}>LN ròng{sortIcon('profit')}</th>
                                <th style={{ ...th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('margin')}>Biên LN{sortIcon('margin')}</th>
                                <th style={{ ...th, textAlign: 'right' }}>LN/sp</th>
                                <th style={{ ...th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('cancel')}>Hủy{sortIcon('cancel')}</th>
                                <th style={{ ...th, textAlign: 'right' }}>% Tích lũy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {abcData.map((s, i) => {
                                const cost = costPrices[s.sku] || 0;
                                const totalCost = cost * s.totalQty;
                                const netProfit = cost > 0 ? s.totalSettlement - totalCost : 0;
                                const margin = cost > 0 && s.totalRevenue > 0 ? (netProfit / s.totalRevenue) * 100 : 0;
                                const profitPerUnit = cost > 0 && s.totalQty > 0 ? netProfit / s.totalQty : 0;
                                const feeRate = s.totalRevenue > 0 ? (s.totalFees / s.totalRevenue) * 100 : 0;
                                const isLoss = cost > 0 && netProfit < 0;
                                const highCancel = s.cancelRate > 20;

                                const shopeeRev = s.shops.filter(sh => sh.platform === 'shopee').reduce((sum, sh) => sum + sh.revenue, 0);
                                const tiktokRev = s.shops.filter(sh => sh.platform === 'tiktok').reduce((sum, sh) => sum + sh.revenue, 0);

                                const clsBg = s.cls === 'A' ? 'rgba(45,212,191,0.1)' : s.cls === 'B' ? 'rgba(129,140,248,0.1)' : 'rgba(107,114,128,0.1)';
                                const clsColor = s.cls === 'A' ? '#2dd4bf' : s.cls === 'B' ? '#818cf8' : '#6b7280';

                                return (
                                    <tr key={s.sku} style={{
                                        borderTop: '1px solid var(--border-default)',
                                        background: isLoss ? 'rgba(239,68,68,0.04)' : undefined,
                                    }}>
                                        <td style={{ ...td, fontWeight: 700, color: i < 3 ? '#2dd4bf' : 'var(--text-muted)', fontSize: '0.72rem' }}>{i + 1}</td>
                                        <td style={td}>
                                            <span style={{ padding: '1px 6px', borderRadius: 3, background: clsBg, color: clsColor, fontSize: '0.68rem', fontWeight: 700 }}>{s.cls}</span>
                                        </td>
                                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{s.sku}</td>
                                        <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={s.productName}>
                                            {s.productName.substring(0, 30)}{s.productName.length > 30 ? '…' : ''}
                                        </td>
                                        <td style={{ ...td, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                                                {shopeeRev > 0 && <span style={{ fontSize: '0.62rem', padding: '0 4px', borderRadius: 2, background: 'rgba(238,77,45,0.1)', color: '#ee4d2d' }}>🛒{fmtCur(shopeeRev)}</span>}
                                                {tiktokRev > 0 && <span style={{ fontSize: '0.62rem', padding: '0 4px', borderRadius: 2, background: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}>🎵{fmtCur(tiktokRev)}</span>}
                                            </div>
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{fmtNum(s.totalQty)}</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>{fmtCur(s.totalRevenue)}</td>
                                        <td style={{ ...td, textAlign: 'right', color: '#a855f7', fontWeight: 500 }}>{fmtCur(s.totalSettlement)}</td>
                                        <td style={{ ...td, textAlign: 'right', color: feeRate > 30 ? '#ef4444' : 'var(--text-muted)' }}>
                                            {fmtCur(s.totalFees)} <span style={{ fontSize: '0.65rem' }}>({fmtPct(feeRate)})</span>
                                        </td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <CostInput value={cost} onChange={v => updateCost(s.sku, v)} />
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: cost > 0 ? (netProfit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                            {cost > 0 ? fmtCur(netProfit) : '—'}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: cost > 0 ? (margin > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                                            {cost > 0 ? fmtPct(margin) : '—'}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: cost > 0 ? (profitPerUnit > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)', fontSize: '0.72rem' }}>
                                            {cost > 0 ? fmtCur(profitPerUnit) : '—'}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: highCancel ? '#ef4444' : 'var(--text-muted)', fontWeight: highCancel ? 600 : 400 }}>
                                            {fmtPct(s.cancelRate)}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                                <div style={{ width: 30, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(s.cumPct, 100)}%`, height: '100%', borderRadius: 2, background: clsColor }} />
                                                </div>
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{fmtPct(s.cumPct)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Totals row */}
                            <tr style={{ borderTop: '2px solid var(--border-default)', background: 'var(--bg-tertiary)', position: 'sticky', bottom: 0 }}>
                                <td colSpan={5} style={{ ...td, fontWeight: 700 }}>TỔNG CỘNG</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtNum(totals.qty)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{fmtCur(totals.rev)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#a855f7' }}>{fmtCur(totals.sett)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmtCur(totals.fees)} ({fmtPct(totals.rev > 0 ? totals.fees / totals.rev * 100 : 0)})</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmtCur(totals.totalCost)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: totals.netProfit > 0 ? '#22c55e' : '#ef4444' }}>{fmtCur(totals.netProfit)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: totals.margin > 0 ? '#22c55e' : '#ef4444' }}>{fmtPct(totals.margin)}</td>
                                <td style={td}></td>
                                <td style={td}></td>
                                <td style={td}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ABC Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {(['A', 'B', 'C'] as const).map(cls => {
                    const items = abcData.filter(s => s.cls === cls);
                    const rev = items.reduce((s, sk) => s + sk.totalRevenue, 0);
                    const clsColor = cls === 'A' ? '#2dd4bf' : cls === 'B' ? '#818cf8' : '#6b7280';
                    const clsLabel = cls === 'A' ? 'Nhóm A — Chủ lực (80% DT)' : cls === 'B' ? 'Nhóm B — Tiềm năng (15% DT)' : 'Nhóm C — Long tail (5% DT)';
                    return (
                        <div key={cls} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, border: `1px solid ${clsColor}30` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span style={{ padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.72rem', background: `${clsColor}15`, color: clsColor }}>{cls}</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{clsLabel}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>{items.length} SKU</span>
                                <span style={{ fontWeight: 600, color: clsColor }}>{fmtCur(rev)} <span style={{ fontWeight: 400 }}>({fmtPct(totals.rev > 0 ? rev / totals.rev * 100 : 0)})</span></span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {items.slice(0, 5).map(s => s.sku).join(', ')}{items.length > 5 ? `, +${items.length - 5}` : ''}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const th: React.CSSProperties = {
    padding: '10px 6px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
    padding: '6px', color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: '0.75rem',
};
