'use client';

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Loader2, Calendar } from 'lucide-react';
import {
    type DailyData, type AggData, type TimeViewMode, type TimePreset,
    fmtCur, fmtShort, fmtNum, fmtDate, fmtAggLabel,
} from '@/lib/reports/revenue-utils';

interface RevenueTabProps {
    data: DailyData[];
    aggregated: AggData[];
    loading: boolean;
    viewMode: TimeViewMode;
    setViewMode: (m: TimeViewMode) => void;
    timePreset: TimePreset;
    setTimePreset: (p: TimePreset) => void;
    customFrom: string;
    setCustomFrom: (v: string) => void;
    customTo: string;
    setCustomTo: (v: string) => void;
}

const PRESETS: { id: TimePreset; label: string }[] = [
    { id: 'this_month', label: 'Tháng này' },
    { id: 'this_quarter', label: 'Quý này' },
    { id: 'this_year', label: 'Năm nay' },
    { id: 'all', label: 'Tất cả' },
    { id: 'custom', label: 'Tùy chọn' },
];

export default function RevenueTab({
    data, aggregated, loading, viewMode, setViewMode,
    timePreset, setTimePreset, customFrom, setCustomFrom, customTo, setCustomTo,
}: RevenueTabProps) {
    if (loading) {
        return (
            <div style={{ padding: 60, textAlign: 'center' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: '0.85rem' }}>Đang tải dữ liệu doanh thu...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: 60,
                background: 'var(--bg-secondary)', borderRadius: 12,
                border: '1px solid var(--border-default)',
            }}>
                <TrendingUp size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Chưa có dữ liệu doanh thu. Hãy upload file Income trước.
                </p>
            </div>
        );
    }

    const totalRevenue = data.reduce((s, d) => s + d.productPrice, 0);
    const totalPayment = data.reduce((s, d) => s + d.totalPayment, 0);
    const totalFees = data.reduce((s, d) => s + Math.abs(d.totalFees), 0);
    const totalTax = data.reduce((s, d) => s + Math.abs(d.totalTax), 0);
    const totalOrders = data.reduce((s, d) => s + d.orderCount, 0);

    const chartData = aggregated.map(d => ({
        date: fmtAggLabel(d.label, viewMode),
        revenue: d.productPrice,
        net: d.totalPayment,
    }));

    const totals = aggregated.reduce(
        (acc, d) => ({
            orderCount: acc.orderCount + d.orderCount,
            productPrice: acc.productPrice + d.productPrice,
            totalFees: acc.totalFees + d.totalFees,
            totalTax: acc.totalTax + d.totalTax,
            totalPayment: acc.totalPayment + d.totalPayment,
        }),
        { orderCount: 0, productPrice: 0, totalFees: 0, totalTax: 0, totalPayment: 0 }
    );

    return (
        <>
            {/* Time Filter Bar */}
            <div style={{
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                marginBottom: 16, padding: '12px 16px',
                background: 'var(--bg-secondary)', borderRadius: 10,
                border: '1px solid var(--border-default)',
            }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 4 }}>Thời gian:</span>
                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setTimePreset(p.id)}
                        style={{
                            padding: '5px 12px', borderRadius: 6,
                            border: timePreset === p.id ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                            background: timePreset === p.id ? 'rgba(45,212,191,0.1)' : 'transparent',
                            color: timePreset === p.id ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '0.78rem',
                            fontWeight: timePreset === p.id ? 600 : 400,
                            transition: 'all 0.15s',
                        }}
                    >
                        {p.label}
                    </button>
                ))}
                {timePreset === 'custom' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                        <input type="month" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            style={{
                                padding: '4px 8px', borderRadius: 6,
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                fontSize: '0.78rem',
                            }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>→</span>
                        <input type="month" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            style={{
                                padding: '4px 8px', borderRadius: 6,
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                fontSize: '0.78rem',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Summary Stats Bar */}
            <div style={{
                display: 'flex', gap: 24, padding: '12px 20px',
                background: 'var(--bg-secondary)', borderRadius: 10,
                border: '1px solid var(--border-default)', marginBottom: 20,
                flexWrap: 'wrap',
            }}>
                <StatItem label="Tổng doanh thu" value={fmtCur(totalRevenue)} color="#2dd4bf" />
                <StatItem label="Thực nhận" value={fmtCur(totalPayment)} color="#22c55e" />
                <StatItem label="Tổng phí sàn" value={fmtCur(totalFees)} color="#ef4444" />
                <StatItem label="Thuế" value={fmtCur(totalTax)} color="#64748b" />
                <StatItem label="Tỷ trọng CP" value={totalRevenue > 0 ? `${((totalFees + totalTax) / totalRevenue * 100).toFixed(1)}%` : '0%'} color="#f97316" />
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
                                    padding: '5px 12px', borderRadius: 6, border: 'none',
                                    background: viewMode === m ? 'var(--accent)' : 'transparent',
                                    color: viewMode === m ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer', fontSize: '0.78rem',
                                    fontWeight: viewMode === m ? 600 : 400,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {m === 'day' ? 'Theo ngày' : m === 'week' ? 'Theo tuần' : 'Theo tháng'}
                            </button>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="shopRevGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="shopNetGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={chartData.length > 31 ? Math.floor(chartData.length / 20) : 0} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                        <Tooltip
                            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                            formatter={(value: number | undefined) => [fmtCur(value ?? 0), '']}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2dd4bf" fill="url(#shopRevGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="net" name="Thực nhận" stroke="#818cf8" fill="url(#shopNetGrad)" strokeWidth={2} />
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
                                const pf = Math.abs(d.totalFees);
                                const tx = Math.abs(d.totalTax);
                                const cr = d.productPrice > 0 ? ((pf + tx) / d.productPrice * 100) : 0;
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                                        <td style={tdStyle}>{viewMode === 'day' ? fmtDate(d.label) : fmtAggLabel(d.label, viewMode)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{d.orderCount}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(d.productPrice)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{fmtCur(pf)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{fmtCur(tx)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{fmtCur(d.totalPayment)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{cr.toFixed(1)}%</td>
                                    </tr>
                                );
                            })}
                            {/* Totals */}
                            {(() => {
                                const tF = Math.abs(totals.totalFees);
                                const tT = Math.abs(totals.totalTax);
                                const tC = totals.productPrice > 0 ? ((tF + tT) / totals.productPrice * 100) : 0;
                                return (
                                    <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
                                        <td style={tdStyle}>TỔNG</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(totals.orderCount)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(totals.productPrice)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{fmtCur(tF)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{fmtCur(tT)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 700 }}>{fmtCur(totals.totalPayment)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{tC.toFixed(1)}%</td>
                                    </tr>
                                );
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color }}>{value}</div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px 8px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '8px', color: 'var(--text-primary)', whiteSpace: 'nowrap',
};
