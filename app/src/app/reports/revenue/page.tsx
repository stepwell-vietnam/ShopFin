'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    TrendingUp, TrendingDown, Calendar, DollarSign,
    ShoppingCart, Filter, Loader2,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer,
} from 'recharts';

// =====================================================
// Types
// =====================================================
type DailyData = {
    date: string;
    orderCount: number;
    productPrice: number;
    totalPayment: number;
    totalFees: number;
    totalTax: number;
    fixedFee: number;
    serviceFee: number;
    paymentFee: number;
    affiliateFee: number;
    refund: number;
};

type ShopMeta = { id: string; name: string; platform: string };

type TimeViewMode = 'day' | 'week' | 'month';

// =====================================================
// Helpers
// =====================================================
function formatCurrency(v: number): string {
    return Math.round(v).toLocaleString('vi-VN') + 'đ';
}

function formatShortCurrency(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `đ${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `đ${(v / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `đ${(v / 1e3).toFixed(0)}K`;
    return `đ${v}`;
}

function formatNumber(v: number): string {
    return v.toLocaleString('vi-VN');
}

function formatDate(d: string): string {
    const dt = new Date(d);
    return dt.toLocaleDateString('vi-VN');
}

function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(dateStr: string): string {
    return dateStr.substring(0, 7);
}

function formatAggLabel(label: string, mode: TimeViewMode): string {
    if (mode === 'day') return label.substring(5);
    if (mode === 'week') {
        const parts = label.split('-W');
        return `T${parts[1]}/${parts[0].substring(2)}`;
    }
    const [y, m] = label.split('-');
    return `T${m}/${y.substring(2)}`;
}

type AggregatedData = DailyData & { label: string };

function aggregateByMode(daily: DailyData[], mode: TimeViewMode): AggregatedData[] {
    const buckets: Record<string, AggregatedData> = {};
    for (const d of daily) {
        const key = mode === 'day' ? d.date : mode === 'week' ? getISOWeek(d.date) : getMonthKey(d.date);
        if (!buckets[key]) {
            buckets[key] = { ...d, label: key, date: d.date };
        } else {
            const b = buckets[key];
            b.orderCount += d.orderCount;
            b.productPrice += d.productPrice;
            b.totalPayment += d.totalPayment;
            b.totalFees += d.totalFees;
            b.totalTax += d.totalTax;
            b.fixedFee += d.fixedFee;
            b.serviceFee += d.serviceFee;
            b.paymentFee += d.paymentFee;
            b.affiliateFee += d.affiliateFee;
            b.refund += d.refund;
        }
    }
    return Object.values(buckets).sort((a, b) => a.label.localeCompare(b.label));
}

function autoDetectViewMode(totalDays: number): TimeViewMode {
    if (totalDays <= 45) return 'day';
    if (totalDays <= 180) return 'week';
    return 'month';
}

// =====================================================
// Page Component
// =====================================================
export default function RevenueReportPage() {
    const { status } = useSession();
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const [shops, setShops] = useState<{ id: string; name: string; platform: string }[]>([]);
    const [monthlySummary, setMonthlySummary] = useState<{ totalRevenue: number; totalFeesAndTax: number; totalSettlement: number; totalOrders: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState<'all' | 'shopee' | 'tiktok'>('all');
    const [viewMode, setViewMode] = useState<TimeViewMode>('day');
    const [viewInitialized, setViewInitialized] = useState(false);

    // Fetch data
    useEffect(() => {
        if (status !== 'authenticated') return;
        setLoading(true);
        fetch(`/api/reports/revenue?platform=${platform}`)
            .then(r => r.json())
            .then(d => {
                setDailyData(d.dailyData || []);
                setShops(d.shops || []);
                setMonthlySummary(d.monthlySummary || null);
                if (!viewInitialized && d.dailyData?.length) {
                    setViewMode(autoDetectViewMode(d.dailyData.length));
                    setViewInitialized(true);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [status, platform, viewInitialized]);

    const aggregated = useMemo(() => aggregateByMode(dailyData, viewMode), [dailyData, viewMode]);
    // Use DB summary for revenue/orders (matches Dashboard exactly)
    const totalRevenue = monthlySummary?.totalRevenue ?? dailyData.reduce((s, d) => s + d.productPrice, 0);
    const totalOrders = monthlySummary?.totalOrders ?? dailyData.reduce((s, d) => s + d.orderCount, 0);
    const totalPayment = monthlySummary?.totalSettlement ?? dailyData.reduce((s, d) => s + d.totalPayment, 0);
    // Tổng phí = phí sàn + thuế (from API monthlySummary, computed from rawData)
    const totalFees = monthlySummary?.totalFeesAndTax ?? (dailyData.reduce((s, d) => s + Math.abs(d.totalFees), 0) + dailyData.reduce((s, d) => s + Math.abs(d.totalTax || 0), 0));
    const avgDaily = dailyData.length > 0 ? totalRevenue / dailyData.length : 0;
    const sorted = [...aggregated].sort((a, b) => b.totalPayment - a.totalPayment);
    const bestPeriod = sorted[0];
    const worstPeriod = sorted[sorted.length - 1];
    const periodLabel = viewMode === 'day' ? 'ngày' : viewMode === 'week' ? 'tuần' : 'tháng';

    const chartData = aggregated.map(d => ({
        date: formatAggLabel(d.label, viewMode),
        revenue: d.productPrice,
        net: d.totalPayment,
        fees: Math.abs(d.totalFees),
        orders: d.orderCount,
    }));

    // Totals row for table
    const totals = aggregated.reduce(
        (acc, d) => ({
            orderCount: acc.orderCount + d.orderCount,
            productPrice: acc.productPrice + d.productPrice,
            fixedFee: acc.fixedFee + d.fixedFee,
            serviceFee: acc.serviceFee + d.serviceFee,
            paymentFee: acc.paymentFee + d.paymentFee,
            affiliateFee: acc.affiliateFee + d.affiliateFee,
            totalTax: acc.totalTax + d.totalTax,
            totalPayment: acc.totalPayment + d.totalPayment,
            totalFees: acc.totalFees + d.totalFees,
        }),
        { orderCount: 0, productPrice: 0, fixedFee: 0, serviceFee: 0, paymentFee: 0, affiliateFee: 0, totalTax: 0, totalPayment: 0, totalFees: 0 }
    );

    if (status !== 'authenticated') {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Vui lòng đăng nhập để xem báo cáo.
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: 80, textAlign: 'center' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Đang tải dữ liệu...</p>
            </div>
        );
    }

    const hasData = dailyData.length > 0;
    const platformBtns: { id: 'all' | 'shopee' | 'tiktok'; label: string; color: string }[] = [
        { id: 'all', label: '📊 Tất cả', color: '#2dd4bf' },
        { id: 'shopee', label: '🟠 Shopee', color: '#ee4d2d' },
        { id: 'tiktok', label: '⬛ TikTok', color: '#00f2ea' },
    ];

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <TrendingUp size={24} style={{ color: '#2dd4bf' }} />
                        Báo cáo Doanh thu Tổng hợp
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        {shops.length} gian hàng · {dailyData.length} ngày dữ liệu
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {platformBtns.map(b => (
                        <button
                            key={b.id}
                            onClick={() => setPlatform(b.id)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 8,
                                border: platform === b.id ? `2px solid ${b.color}` : '1px solid var(--border-default)',
                                background: platform === b.id ? `${b.color}18` : 'transparent',
                                color: platform === b.id ? b.color : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: platform === b.id ? 600 : 400,
                                transition: 'all 0.15s',
                            }}
                        >
                            {b.label}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData && (
                <div style={{
                    textAlign: 'center', padding: 60,
                    background: 'var(--bg-secondary)', borderRadius: 12,
                    border: '1px solid var(--border-default)',
                }}>
                    <DollarSign size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Chưa có dữ liệu doanh thu. Hãy upload file Income cho các gian hàng trước.
                    </p>
                </div>
            )}

            {hasData && (
                <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                        <div style={kpiCardStyle}>
                            <div style={kpiLabelStyle}>TB Doanh thu/ngày</div>
                            <div style={kpiValueStyle}>{formatShortCurrency(avgDaily)}</div>
                            <div style={kpiSubStyle}>{dailyData.length} ngày · {aggregated.length} {periodLabel}</div>
                        </div>
                        <div style={kpiCardStyle}>
                            <div style={kpiLabelStyle}>
                                {viewMode === 'day' ? 'Ngày' : viewMode === 'week' ? 'Tuần' : 'Tháng'} cao nhất
                            </div>
                            <div style={{ ...kpiValueStyle, color: '#22c55e' }}>
                                {bestPeriod ? formatAggLabel(bestPeriod.label, viewMode) : '-'}
                            </div>
                            <div style={kpiSubStyle}>
                                {bestPeriod ? `${formatShortCurrency(bestPeriod.totalPayment)} · ${bestPeriod.orderCount} đơn` : ''}
                            </div>
                        </div>
                        <div style={kpiCardStyle}>
                            <div style={kpiLabelStyle}>
                                {viewMode === 'day' ? 'Ngày' : viewMode === 'week' ? 'Tuần' : 'Tháng'} thấp nhất
                            </div>
                            <div style={{ ...kpiValueStyle, color: '#ef4444' }}>
                                {worstPeriod ? formatAggLabel(worstPeriod.label, viewMode) : '-'}
                            </div>
                            <div style={kpiSubStyle}>
                                {worstPeriod ? `${formatShortCurrency(worstPeriod.totalPayment)} · ${worstPeriod.orderCount} đơn` : ''}
                            </div>
                        </div>
                        <div style={kpiCardStyle}>
                            <div style={kpiLabelStyle}>TB Đơn/ngày</div>
                            <div style={kpiValueStyle}>
                                {dailyData.length > 0 ? (totalOrders / dailyData.length).toFixed(1) : '0'}
                            </div>
                            <div style={kpiSubStyle}>{formatNumber(totalOrders)} tổng đơn</div>
                        </div>
                    </div>

                    {/* Summary Stats Bar */}
                    <div style={{
                        display: 'flex', gap: 24, padding: '12px 20px',
                        background: 'var(--bg-secondary)', borderRadius: 10,
                        border: '1px solid var(--border-default)', marginBottom: 20,
                        flexWrap: 'wrap',
                    }}>
                        <StatItem label="Tổng doanh thu" value={formatCurrency(totalRevenue)} color="#2dd4bf" />
                        <StatItem label="Thực nhận" value={formatCurrency(totalPayment)} color="#22c55e" />
                        <StatItem label="Tổng phí" value={formatCurrency(totalFees)} color="#ef4444" />
                        <StatItem label="Tỷ lệ phí" value={totalRevenue > 0 ? `${(totalFees / totalRevenue * 100).toFixed(1)}%` : '0%'} color="#f97316" />
                    </div>

                    {/* Chart */}
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: 12,
                        border: '1px solid var(--border-default)', padding: 20,
                        marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TrendingUp size={18} style={{ color: '#2dd4bf' }} />
                                Xu hướng Doanh thu
                            </h3>
                            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-tertiary)', borderRadius: 8, padding: 2 }}>
                                {(['day', 'week', 'month'] as TimeViewMode[]).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setViewMode(m)}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            border: 'none',
                                            background: viewMode === m ? 'var(--accent)' : 'transparent',
                                            color: viewMode === m ? '#fff' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            fontSize: '0.78rem',
                                            fontWeight: viewMode === m ? 600 : 400,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {m === 'day' ? 'Theo ngày' : m === 'week' ? 'Theo tuần' : 'Theo tháng'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="crossRevGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="crossNetGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                    interval={chartData.length > 31 ? Math.floor(chartData.length / 20) : 0}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                    tickFormatter={v => formatShortCurrency(v)}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                    }}
                                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="revenue" name="Doanh thu SP" stroke="#2dd4bf" fill="url(#crossRevGrad)" strokeWidth={2} />
                                <Area type="monotone" dataKey="net" name="Thực nhận" stroke="#818cf8" fill="url(#crossNetGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Detail Table */}
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: 12,
                        border: '1px solid var(--border-default)', padding: 20,
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Chi tiết {viewMode === 'day' ? 'theo ngày' : viewMode === 'week' ? 'theo tuần' : 'theo tháng'}
                        </h3>
                        <div style={{ overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                        <th style={thStyle}>Thời gian</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Số đơn</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Doanh thu</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Phí sàn</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Thuế</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Thực nhận</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Tỷ trọng CP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aggregated.map((d, i) => {
                                        const platformFees = Math.abs(d.totalFees);
                                        const tax = Math.abs(d.totalTax);
                                        const costRatio = d.productPrice > 0 ? ((platformFees + tax) / d.productPrice * 100) : 0;
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                                                <td style={tdStyle}>{viewMode === 'day' ? formatDate(d.label) : formatAggLabel(d.label, viewMode)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{d.orderCount}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(d.productPrice)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(platformFees)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{formatCurrency(tax)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{formatCurrency(d.totalPayment)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{costRatio.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Totals row */}
                                    {(() => {
                                        const tFees = Math.abs(totals.totalFees);
                                        const tTax = Math.abs(totals.totalTax);
                                        const tCostR = totals.productPrice > 0 ? ((tFees + tTax) / totals.productPrice * 100) : 0;
                                        return (
                                            <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
                                                <td style={tdStyle}>TỔNG</td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(totals.orderCount)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totals.productPrice)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(tFees)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{formatCurrency(tTax)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 700 }}>{formatCurrency(totals.totalPayment)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{tCostR.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// =====================================================
// Sub-components & styles
// =====================================================
function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color }}>{value}</div>
        </div>
    );
}

const kpiCardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    padding: '16px 20px',
};

const kpiLabelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: 4,
};

const kpiValueStyle: React.CSSProperties = {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
};

const kpiSubStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: 2,
};

const thStyle: React.CSSProperties = {
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '8px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
};
