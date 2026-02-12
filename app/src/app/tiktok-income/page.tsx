'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
    UploadCloud, Loader2, AlertTriangle, FileSpreadsheet,
    DollarSign, TrendingUp, TrendingDown, Percent, BarChart3,
    RefreshCw, Wallet, ShoppingCart, ArrowDownRight, Scale, Calendar, Users,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { parseTikTokIncomeExcel, type TikTokIncomeResult } from '@/lib/parsers/tiktok-income-parser';
import type { ProgressCallback } from '@/lib/parsers/income-parser';
import { formatCurrency, formatShortCurrency, formatPercent, formatNumber, formatFileSize } from '@/lib/formatters';
import { useDataStore } from '@/store/useDataStore';
import styles from '../income/income.module.css';

const FEE_COLORS: Record<string, string> = {
    'Hoa hồng TikTok': '#ef4444',
    'Affiliate Commission': '#f97316',
    'Phí giao dịch': '#eab308',
    'Voucher Xtra': '#8b5cf6',
    'Phí xử lý đơn': '#06b6d4',
    'VAT': '#64748b',
    'PIT': '#94a3b8',
    'Phí SFR': '#ec4899',
    'Affiliate Shop Ads': '#10b981',
    'Phí ship': '#3b82f6',
    'SFP Service Fee': '#6366f1',
    'Bonus Cashback': '#14b8a6',
    'LIVE Specials': '#f43f5e',
    'Flash Sale': '#a855f7',
    'EAMS Program': '#0ea5e9',
    'TikTok PayLater': '#84cc16',
    'Campaign Resource': '#d946ef',
};

// ===== Time aggregation helpers =====
type TimeViewMode = 'day' | 'week' | 'month';
const TIME_VIEW_LABELS: Record<TimeViewMode, string> = { day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng' };

function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr.replace(/\//g, '-'));
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const dayOfYear = Math.floor((d.getTime() - jan4.getTime()) / 86400000) + 4;
    const week = Math.ceil(dayOfYear / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function getMonthKey(dateStr: string): string { return dateStr.replace(/\//g, '-').substring(0, 7); }
function autoDetectViewMode(numDays: number): TimeViewMode {
    if (numDays <= 45) return 'day';
    if (numDays <= 180) return 'week';
    return 'month';
}
function formatTimeLabel(label: string, mode: TimeViewMode): string {
    if (mode === 'day') return label.substring(5);
    if (mode === 'week') { const [y, w] = label.split('-W'); return `T${w}/${y.substring(2)}`; }
    const [y, m] = label.split('-'); return `${parseInt(m)}/${y.substring(2)}`;
}

const TABS = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'daily', label: 'Theo ngày', icon: Calendar },
    { id: 'fees', label: 'Cơ cấu Chi phí', icon: Percent },
    { id: 'orders', label: 'Chi tiết đơn', icon: ShoppingCart },
    { id: 'withdrawals', label: 'Rút tiền', icon: Wallet },
] as const;

type TabId = typeof TABS[number]['id'];

// =====================================================
// TAB 1: Tổng quan  (matches Shopee TabOverview layout)
// =====================================================
function TabOverview({ data }: { data: TikTokIncomeResult }) {
    const s = data.summary;
    const feeRatio = s.totalRevenue !== 0 ? (Math.abs(s.totalFees) / s.totalRevenue) * 100 : 0;
    const discountRatio = s.subtotalBeforeDiscount !== 0 ? (Math.abs(s.sellerDiscounts) / s.subtotalBeforeDiscount) * 100 : 0;
    const marginPct = s.totalRevenue > 0 ? (s.totalSettlement / s.totalRevenue) * 100 : 0;
    const refundRate = s.subtotalAfterDiscount > 0 ? (Math.abs(s.refundAfterDiscount) / s.subtotalAfterDiscount) * 100 : 0;
    const aov = data.orders.length > 0 ? s.totalRevenue / data.orders.length : 0;

    const kpis = [
        { label: 'Doanh thu bán hàng', value: formatShortCurrency(s.totalRevenue), icon: DollarSign, color: '#2dd4bf', sub: `Sau mã giảm giá shop` },
        { label: 'Thực nhận', value: formatShortCurrency(s.totalSettlement), icon: TrendingUp, color: '#22c55e', sub: `Biên ${formatPercent(marginPct)}` },
        { label: 'Tổng phí & thuế', value: formatShortCurrency(Math.abs(s.totalFees)), icon: TrendingDown, color: '#ef4444', sub: `Tỷ lệ ${formatPercent(feeRatio)}` },
        { label: 'AOV (TB/đơn)', value: formatShortCurrency(aov), icon: ShoppingCart, color: '#818cf8', sub: `${formatNumber(data.orders.length)} đơn` },
    ];

    // Revenue vs Fees pie
    const revenuePie = [
        { name: 'Thực nhận', value: s.totalSettlement, color: '#22c55e' },
        { name: 'Phí & Thuế', value: Math.abs(s.totalFees), color: '#ef4444' },
        { name: 'Hoàn hàng', value: Math.abs(s.refundAfterDiscount), color: '#f97316' },
        { name: 'Giảm giá Shop', value: Math.abs(s.sellerDiscounts), color: '#8b5cf6' },
    ].filter(d => d.value > 0);

    // Fee breakdown bar
    const feeData = [
        { name: 'Hoa hồng TT', value: Math.abs(s.commissionFee) },
        { name: 'Affiliate', value: Math.abs(s.affiliateCommission) },
        { name: 'Phí GD', value: Math.abs(s.transactionFee) },
        { name: 'Voucher Xtra', value: Math.abs(s.voucherXtraFee) },
        { name: 'VAT+PIT', value: Math.abs(s.vatWithheld) + Math.abs(s.pitWithheld) },
        { name: 'Xử lý đơn', value: Math.abs(s.orderProcessingFee) },
        { name: 'SFR', value: Math.abs(s.sfrServiceFee) },
        { name: 'Ship', value: Math.abs(s.sellerShippingFee) },
        { name: 'Ads', value: Math.abs(s.affiliateShopAds) },
    ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return (
        <>
            {/* KPI cards — same layout as Shopee summaryGrid */}
            <div className={styles.summaryGrid}>
                {kpis.map((k, i) => {
                    const Icon = k.icon;
                    return (
                        <div key={i} className={styles.summaryCard}>
                            <div className={styles.summaryCardHeader}>
                                <span className={styles.summaryCardLabel}>{k.label}</span>
                                <div className={styles.summaryCardIconWrap} style={{ background: `${k.color}15`, color: k.color }}>
                                    <Icon size={18} />
                                </div>
                            </div>
                            <div className={styles.summaryCardValue}>{k.value}</div>
                            <div className={styles.summaryCardSub}>{k.sub}</div>
                        </div>
                    );
                })}
            </div>

            {/* Highlights — same layout as Shopee highlightGrid */}
            <div className={styles.highlightGrid}>
                <div className={styles.highlightCard}>
                    <div className={styles.highlightIcon} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        <ArrowDownRight size={20} />
                    </div>
                    <div>
                        <div className={styles.highlightValue}>{formatPercent(refundRate)}</div>
                        <div className={styles.highlightLabel}>Tỷ lệ hoàn đơn {refundRate < 5 ? '✅' : '⚠️'}</div>
                    </div>
                </div>
                <div className={styles.highlightCard}>
                    <div className={styles.highlightIcon} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                        <Scale size={20} />
                    </div>
                    <div>
                        <div className={styles.highlightValue}>{formatPercent(discountRatio)}</div>
                        <div className={styles.highlightLabel}>Discount / Giá gốc</div>
                    </div>
                </div>
                <div className={styles.highlightCard}>
                    <div className={styles.highlightIcon} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        <Wallet size={20} />
                    </div>
                    <div>
                        <div className={styles.highlightValue}>{formatShortCurrency(s.totalAdjustments)}</div>
                        <div className={styles.highlightLabel}>Bồi thường & Điều chỉnh</div>
                    </div>
                </div>
            </div>

            {/* Charts row */}
            <div className={styles.chartsRow}>
                {/* Revenue pie */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                        Cơ cấu Doanh thu
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Pie
                                    data={revenuePie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={110}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {revenuePie.map((d, i) => <Cell key={i} fill={d.color} />)}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fee breakdown bar */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <Percent size={18} style={{ color: '#ef4444' }} />
                        Phân bổ Chi phí
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={feeData} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => formatShortCurrency(v)} />
                                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={75} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                />
                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </>
    );
}

// =====================================================
// TAB 2: Cơ cấu Chi phí  (matches Shopee TabFees layout)
// =====================================================
function TabFees({ data }: { data: TikTokIncomeResult }) {
    const s = data.summary;

    // Build fees array same as Shopee
    const fees = [
        { name: 'Hoa hồng TikTok', value: Math.abs(s.commissionFee) },
        { name: 'Affiliate Commission', value: Math.abs(s.affiliateCommission) },
        { name: 'Phí giao dịch', value: Math.abs(s.transactionFee) },
        { name: 'Voucher Xtra', value: Math.abs(s.voucherXtraFee) },
        { name: 'Phí xử lý đơn', value: Math.abs(s.orderProcessingFee) },
        { name: 'VAT', value: Math.abs(s.vatWithheld) },
        { name: 'PIT', value: Math.abs(s.pitWithheld) },
        { name: 'Phí SFR', value: Math.abs(s.sfrServiceFee) },
        { name: 'Affiliate Shop Ads', value: Math.abs(s.affiliateShopAds) },
        { name: 'Phí ship', value: Math.abs(s.sellerShippingFee) },
        { name: 'SFP Service Fee', value: Math.abs(s.sfpServiceFee) },
        { name: 'Bonus Cashback', value: Math.abs(s.bonusCashbackFee) },
        { name: 'LIVE Specials', value: Math.abs(s.liveSpecialsFee) },
        { name: 'Flash Sale', value: Math.abs(s.flashSaleFee) },
        { name: 'EAMS Program', value: Math.abs(s.eamsServiceFee) },
        { name: 'TikTok PayLater', value: Math.abs(s.tikTokPayLaterFee) },
        { name: 'Campaign Resource', value: Math.abs(s.campaignResourceFee) },
    ].filter(f => f.value > 0).sort((a, b) => b.value - a.value);

    const totalAll = fees.reduce((sum, f) => sum + f.value, 0);
    const maxFee = Math.max(...fees.map(f => f.value), 1);
    const pieData = fees.map(f => ({ ...f, color: FEE_COLORS[f.name] || '#64748b' }));

    return (
        <>
            {/* Summary cards — same as Shopee TabFees */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Tổng Chi phí</span>
                        <div className={styles.summaryCardIconWrap} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            <TrendingDown size={18} />
                        </div>
                    </div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(totalAll)}</div>
                    <div className={styles.summaryCardSub}>
                        = {formatPercent(s.totalRevenue > 0 ? (totalAll / s.totalRevenue) * 100 : 0)} doanh thu
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Phí lớn nhất</span>
                    </div>
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>
                        {fees.length > 0 ? fees[0].name : '-'}
                    </div>
                    <div className={styles.summaryCardSub}>
                        {fees.length > 0 ? `${formatCurrency(fees[0].value)} (${formatPercent(totalAll > 0 ? fees[0].value / totalAll * 100 : 0)} tổng phí)` : ''}
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Tỷ lệ phí / DT</span>
                    </div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(s.totalRevenue > 0 ? Math.abs(s.totalFees) / s.totalRevenue * 100 : 0)}
                    </div>
                    <div className={styles.summaryCardSub}>Trên doanh thu thực</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Thuế / Doanh thu</span>
                    </div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(s.totalRevenue > 0 ? (Math.abs(s.vatWithheld) + Math.abs(s.pitWithheld)) / s.totalRevenue * 100 : 0)}
                    </div>
                    <div className={styles.summaryCardSub}>{formatCurrency(Math.abs(s.vatWithheld) + Math.abs(s.pitWithheld))}</div>
                </div>
            </div>

            <div className={styles.chartsRow}>
                {/* Pie Chart — same as Shopee */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <Percent size={18} style={{ color: '#ef4444' }} />
                        Biểu đồ Cơ cấu Chi phí
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={110}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((f, i) => (
                                        <Cell key={i} fill={f.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fee Waterfall — same feeGrid pattern as Shopee */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <DollarSign size={18} style={{ color: 'var(--accent-primary)' }} />
                        Bảng phân tích Chi phí
                    </h3>
                    <div className={styles.feeGrid}>
                        {/* Header row */}
                        <div className={styles.feeItem} style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '8px', marginBottom: '4px' }}>
                            <span className={styles.feeLabel} style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Hạng mục</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ width: '140px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Số tiền</span>
                            <span style={{ width: '80px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>% DT</span>
                        </div>
                        {/* Revenue row */}
                        <div className={styles.feeItem}>
                            <span className={styles.feeLabel}>Doanh thu thực</span>
                            <span style={{ flex: 1 }} />
                            <span className={styles.feeValue} style={{ color: '#2dd4bf', width: '140px', textAlign: 'right' }}>{formatCurrency(s.totalRevenue)}</span>
                            <span style={{ width: '80px', textAlign: 'right', color: '#2dd4bf', fontWeight: 600, fontSize: '0.85rem' }}>100%</span>
                        </div>
                        {/* Fee rows with progress bars */}
                        {fees.map((f, i) => {
                            const pctRevenue = s.totalRevenue > 0 ? (f.value / s.totalRevenue) * 100 : 0;
                            return (
                                <div key={i} className={styles.feeItem}>
                                    <span className={styles.feeLabel}>– {f.name}</span>
                                    <div className={styles.feeBar}>
                                        <div className={styles.feeBarFill} style={{
                                            width: `${(f.value / maxFee) * 100}%`,
                                            background: FEE_COLORS[f.name] || '#64748b',
                                        }} />
                                    </div>
                                    <span className={styles.feeValue} style={{ color: FEE_COLORS[f.name] || '#64748b', width: '140px', textAlign: 'right' }}>
                                        -{formatCurrency(f.value)}
                                    </span>
                                    <span style={{ width: '80px', textAlign: 'right', color: FEE_COLORS[f.name] || '#64748b', fontSize: '0.85rem' }}>
                                        {pctRevenue.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                        {/* Total row */}
                        <div className={`${styles.feeItem} ${styles.feeTotal}`}>
                            <span className={styles.feeLabel}>= Thực nhận</span>
                            <span style={{ flex: 1 }} />
                            <span className={styles.feeValue} style={{ color: '#22c55e', fontWeight: 700, width: '140px', textAlign: 'right' }}>
                                {formatCurrency(s.totalSettlement)}
                            </span>
                            <span style={{ width: '80px', textAlign: 'right', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem' }}>
                                {s.totalRevenue > 0 ? (s.totalSettlement / s.totalRevenue * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Shipping breakdown — table section like Shopee */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>
                    🚚 Chi tiết vận chuyển
                </h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Khoản mục</th>
                                <th style={{ textAlign: 'right' }}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { name: 'Phí ship thực tế', value: s.actualShippingFee },
                                { name: 'TikTok trợ giá ship', value: s.platformShippingDiscount },
                                { name: 'Khách trả ship', value: s.customerShippingFee },
                                { name: 'SFR hoàn trả', value: s.sfrReimbursement },
                                { name: 'Phí ship hoàn hàng', value: s.returnShippingFee },
                                { name: 'Hoàn ship khách', value: s.refundedCustomerShipping },
                            ].filter(d => d.value !== 0).map(item => (
                                <tr key={item.name}>
                                    <td>{item.name}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: item.value >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(item.value)}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                                <td style={{ fontWeight: 700 }}>Shop chịu ròng</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.sellerShippingFee)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tax breakdown — table section like Shopee */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>
                    🧾 Thuế TikTok khấu trừ
                </h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Loại thuế</th>
                                <th style={{ textAlign: 'right' }}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>VAT (thuế GTGT)</td><td style={{ textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.vatWithheld)}</td></tr>
                            <tr><td>PIT (thuế TNCN)</td><td style={{ textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.pitWithheld)}</td></tr>
                            <tr><td>PIT từ Affiliate commission</td><td style={{ textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.affiliatePIT)}</td></tr>
                            <tr><td>PIT từ Affiliate Shop Ads</td><td style={{ textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.affiliateShopAdsPIT)}</td></tr>
                            <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                                <td style={{ fontWeight: 700 }}>Tổng thuế đã khấu trừ</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.vatWithheld + s.pitWithheld + s.affiliatePIT + s.affiliateShopAdsPIT)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

// =====================================================
// TAB 3: Chi tiết đơn  (matches Shopee TabOrders layout)
// =====================================================
function TabOrders({ data }: { data: TikTokIncomeResult }) {
    const orders = data.orders;
    const totalOrders = orders.length;
    const totalPaid = orders.reduce((sum, o) => sum + o.totalSettlement, 0);
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalRevenue, 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const refundOrders = orders.filter(o => o.refundAfterDiscount !== 0);

    // Daily aggregation for revenue/settlement chart
    const dates = orders.map(o => o.orderCreatedTime.replace(/\//g, '-')).filter(Boolean).sort();
    const uniqueDates = [...new Set(dates)];
    const numDays = uniqueDates.length;
    const defaultMode = autoDetectViewMode(numDays);
    const [timeView, setTimeView] = useState<TimeViewMode>(defaultMode);

    const dailyMap = new Map<string, { label: string; revenue: number; settlement: number; orders: number }>();
    orders.forEach(o => {
        const d = o.orderCreatedTime.replace(/\//g, '-');
        if (!d) return;
        const key = timeView === 'day' ? d : timeView === 'week' ? getISOWeek(d) : getMonthKey(d);
        const existing = dailyMap.get(key) || { label: key, revenue: 0, settlement: 0, orders: 0 };
        existing.revenue += o.totalRevenue;
        existing.settlement += o.totalSettlement;
        existing.orders += 1;
        dailyMap.set(key, existing);
    });
    const dailyData = [...dailyMap.values()].sort((a, b) => a.label.localeCompare(b.label));

    if (totalOrders === 0) {
        return (
            <div className={`card ${styles.chartCard}`} style={{ textAlign: 'center', padding: 40 }}>
                <ShoppingCart size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h3 style={{ color: 'var(--text-secondary)' }}>Không có dữ liệu đơn hàng chi tiết</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sheet &quot;Order details&quot; trống hoặc file chưa có đơn settled trong kỳ này.</p>
            </div>
        );
    }

    // Order value distribution
    const orderDist = getOrderDistribution(orders);

    // Affiliate breakdown
    const affOrders = orders.filter(o => o.affiliateCommission !== 0);
    const nonAffOrders = orders.filter(o => o.affiliateCommission === 0);
    const affRevenue = affOrders.reduce((s, o) => s + o.totalRevenue, 0);
    const nonAffRevenue = nonAffOrders.reduce((s, o) => s + o.totalRevenue, 0);
    const affSettlement = affOrders.reduce((s, o) => s + o.totalSettlement, 0);
    const totalAffCommission = affOrders.reduce((s, o) => s + Math.abs(o.affiliateCommission), 0);
    const affAOV = affOrders.length > 0 ? affRevenue / affOrders.length : 0;
    const nonAffAOV = nonAffOrders.length > 0 ? nonAffRevenue / nonAffOrders.length : 0;

    const affPieData = [
        { name: 'Affiliate', value: affOrders.length, color: '#8b5cf6' },
        { name: 'Tự nhiên', value: nonAffOrders.length, color: '#2dd4bf' },
    ];

    return (
        <>
            {/* Summary cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Tổng đơn hàng</div>
                    <div className={styles.summaryCardValue}>{formatNumber(totalOrders)}</div>
                    <div className={styles.summaryCardSub}>Đã settled trong kỳ</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Doanh thu bán hàng</div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(totalRevenue)}</div>
                    <div className={styles.summaryCardSub}>Sau mã giảm giá shop</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Thực nhận</div>
                    <div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatShortCurrency(totalPaid)}</div>
                    <div className={styles.summaryCardSub}>{formatPercent(totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0)} doanh thu</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Đơn có hoàn hàng</div>
                    <div className={styles.summaryCardValue} style={{ color: '#f97316' }}>{formatNumber(refundOrders.length)}</div>
                    <div className={styles.summaryCardSub}>
                        {formatPercent(totalOrders > 0 ? (refundOrders.length / totalOrders) * 100 : 0)} tổng đơn
                    </div>
                </div>
            </div>

            {/* Affiliate vs Non-Affiliate breakdown */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className={styles.chartTitle}>
                    <Users size={18} style={{ color: '#8b5cf6' }} />
                    Affiliate vs Đơn tự nhiên
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'center' }}>
                    {/* Pie chart */}
                    <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                            <Pie data={affPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4}>
                                {affPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Comparison table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 14, background: '#8b5cf615', borderRadius: 10, borderLeft: '3px solid #8b5cf6' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>🤝 Affiliate</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{formatNumber(affOrders.length)} đơn <span style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>({formatPercent(totalOrders > 0 ? (affOrders.length / totalOrders) * 100 : 0)})</span></div>
                            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>DT: <strong>{formatShortCurrency(affRevenue)}</strong> <span style={{ color: '#8b5cf6' }}>({formatPercent(totalRevenue > 0 ? (affRevenue / totalRevenue) * 100 : 0)})</span></div>
                            <div style={{ fontSize: '0.82rem' }}>AOV: <strong>{formatCurrency(affAOV)}</strong></div>
                            <div style={{ fontSize: '0.82rem' }}>Hoa hồng: <span style={{ color: '#ef4444' }}>{formatShortCurrency(totalAffCommission)}</span></div>
                        </div>
                        <div style={{ padding: 14, background: '#2dd4bf15', borderRadius: 10, borderLeft: '3px solid #2dd4bf' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>🌱 Đơn tự nhiên</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{formatNumber(nonAffOrders.length)} đơn <span style={{ fontSize: '0.8rem', color: '#2dd4bf' }}>({formatPercent(totalOrders > 0 ? (nonAffOrders.length / totalOrders) * 100 : 0)})</span></div>
                            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>DT: <strong>{formatShortCurrency(nonAffRevenue)}</strong> <span style={{ color: '#2dd4bf' }}>({formatPercent(totalRevenue > 0 ? (nonAffRevenue / totalRevenue) * 100 : 0)})</span></div>
                            <div style={{ fontSize: '0.82rem' }}>AOV: <strong>{formatCurrency(nonAffAOV)}</strong></div>
                            <div style={{ fontSize: '0.82rem' }}>Settlement: <span style={{ color: '#22c55e' }}>{formatShortCurrency(affSettlement)}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Revenue & Settlement Chart */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 className={styles.chartTitle} style={{ margin: 0 }}>
                        <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                        Doanh số & Tiền về ví theo thời gian
                    </h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {(Object.entries(TIME_VIEW_LABELS) as [TimeViewMode, string][]).map(([mode, label]) => (
                            <button
                                key={mode}
                                onClick={() => setTimeView(mode)}
                                style={{
                                    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    fontSize: '0.75rem', fontWeight: 600,
                                    background: timeView === mode ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: timeView === mode ? '#fff' : 'var(--text-secondary)',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={dailyData} barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={l => formatTimeLabel(l, timeView)} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => formatShortCurrency(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                labelFormatter={l => formatTimeLabel(String(l), timeView)}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Doanh thu" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="settlement" name="Thực nhận" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Order Value Distribution Chart */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className={styles.chartTitle}>
                    <ShoppingCart size={18} style={{ color: '#818cf8' }} />
                    Phân bố Giá trị Đơn
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={orderDist} barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [`${value ?? 0} đơn`, '']}
                            />
                            <Bar dataKey="count" name="Số đơn" fill="#818cf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top 10 orders table */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>Top 10 đơn hàng giá trị cao nhất</h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Mã đơn</th>
                                <th>Loại</th>
                                <th>Ngày tạo</th>
                                <th style={{ textAlign: 'right' }}>Doanh thu</th>
                                <th style={{ textAlign: 'right' }}>Phí</th>
                                <th style={{ textAlign: 'right' }}>Thực nhận</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...orders].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10).map((o, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{i + 1}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td>
                                    <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', background: o.type === 'Order' ? '#22c55e22' : '#f9731622', color: o.type === 'Order' ? '#22c55e' : '#f97316' }}>{o.type}</span></td>
                                    <td>{o.orderCreatedTime}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(o.totalRevenue)}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(Math.abs(o.totalFees))}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{formatCurrency(o.totalSettlement)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function getOrderDistribution(orders: TikTokIncomeResult['orders']) {
    const ranges = [
        { range: '< 100K', min: 0, max: 100000 },
        { range: '100-200K', min: 100000, max: 200000 },
        { range: '200-300K', min: 200000, max: 300000 },
        { range: '300-500K', min: 300000, max: 500000 },
        { range: '500K-1M', min: 500000, max: 1000000 },
        { range: '> 1M', min: 1000000, max: Infinity },
    ];
    return ranges.map(r => ({
        range: r.range,
        count: orders.filter(o => o.totalRevenue >= r.min && o.totalRevenue < r.max).length,
    }));
}

// =====================================================
// TAB 5: Theo ngày (matches Shopee TabDaily layout)
// =====================================================
interface DailyAgg {
    label: string;
    orders: number;
    revenue: number;
    fees: number;
    affiliateComm: number;
    settlement: number;
    transactionFee: number;
    commissionFee: number;
}

function aggregateOrdersByMode(orders: TikTokIncomeResult['orders'], mode: TimeViewMode): DailyAgg[] {
    const map = new Map<string, DailyAgg>();
    orders.forEach(o => {
        const d = o.orderCreatedTime.replace(/\//g, '-');
        if (!d) return;
        const key = mode === 'day' ? d : mode === 'week' ? getISOWeek(d) : getMonthKey(d);
        const existing = map.get(key) || { label: key, orders: 0, revenue: 0, fees: 0, affiliateComm: 0, settlement: 0, transactionFee: 0, commissionFee: 0 };
        existing.orders += 1;
        existing.revenue += o.totalRevenue;
        existing.fees += Math.abs(o.totalFees);
        existing.affiliateComm += Math.abs(o.affiliateCommission);
        existing.settlement += o.totalSettlement;
        existing.transactionFee += Math.abs(o.transactionFee);
        existing.commissionFee += Math.abs(o.commissionFee);
        map.set(key, existing);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function TabDaily({ data }: { data: TikTokIncomeResult }) {
    const orders = data.orders;
    const dates = orders.map(o => o.orderCreatedTime.replace(/\//g, '-')).filter(Boolean);
    const numDays = new Set(dates).size;
    const defaultMode = useMemo(() => autoDetectViewMode(numDays), [numDays]);
    const [viewMode, setViewMode] = useState<TimeViewMode>(defaultMode);
    const aggregated = useMemo(() => aggregateOrdersByMode(orders, viewMode), [orders, viewMode]);

    const totalRevenue = orders.reduce((s, o) => s + o.totalRevenue, 0);
    const totalOrders = orders.length;
    const avgDaily = numDays > 0 ? totalRevenue / numDays : 0;
    const avgOrdersDaily = numDays > 0 ? totalOrders / numDays : 0;

    const sorted = [...aggregated].sort((a, b) => b.settlement - a.settlement);
    const bestPeriod = sorted[0];
    const worstPeriod = sorted[sorted.length - 1];
    const periodLabel = viewMode === 'day' ? 'ngày' : viewMode === 'week' ? 'tuần' : 'tháng';

    const chartData = aggregated.map(d => ({
        date: formatTimeLabel(d.label, viewMode),
        revenue: d.revenue,
        settlement: d.settlement,
        fees: d.fees,
        orders: d.orders,
    }));

    if (totalOrders === 0) {
        return (
            <div className={`card ${styles.chartCard}`} style={{ textAlign: 'center', padding: 40 }}>
                <Calendar size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h3 style={{ color: 'var(--text-secondary)' }}>Không có dữ liệu theo ngày</h3>
            </div>
        );
    }

    return (
        <>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>TB Doanh thu/ngày</div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(avgDaily)}</div>
                    <div className={styles.summaryCardSub}>{numDays} ngày · {aggregated.length} {periodLabel}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>{periodLabel === 'ngày' ? 'Ngày' : periodLabel === 'tuần' ? 'Tuần' : 'Tháng'} cao nhất</div>
                    <div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>
                        {bestPeriod ? formatTimeLabel(bestPeriod.label, viewMode) : '-'}
                    </div>
                    <div className={styles.summaryCardSub}>
                        {bestPeriod ? `${formatShortCurrency(bestPeriod.settlement)} · ${bestPeriod.orders} đơn` : ''}
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>{periodLabel === 'ngày' ? 'Ngày' : periodLabel === 'tuần' ? 'Tuần' : 'Tháng'} thấp nhất</div>
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>
                        {worstPeriod ? formatTimeLabel(worstPeriod.label, viewMode) : '-'}
                    </div>
                    <div className={styles.summaryCardSub}>
                        {worstPeriod ? `${formatShortCurrency(worstPeriod.settlement)} · ${worstPeriod.orders} đơn` : ''}
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>TB Đơn/ngày</div>
                    <div className={styles.summaryCardValue}>{avgOrdersDaily.toFixed(1)}</div>
                    <div className={styles.summaryCardSub}>{formatNumber(totalOrders)} tổng đơn</div>
                </div>
            </div>

            {/* Area Chart */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                        <TrendingUp size={18} style={{ color: '#2dd4bf' }} />
                        Xu hướng Doanh thu
                    </h3>
                    <div className={styles.timeToggle}>
                        {(['day', 'week', 'month'] as TimeViewMode[]).map(m => (
                            <button
                                key={m}
                                className={`${styles.timeToggleBtn} ${viewMode === m ? styles.timeToggleBtnActive : ''}`}
                                onClick={() => setViewMode(m)}
                            >
                                {TIME_VIEW_LABELS[m]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="ttRevGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="ttNetGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={chartData.length > 31 ? Math.floor(chartData.length / 20) : 0} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => formatShortCurrency(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2dd4bf" fill="url(#ttRevGrad)" strokeWidth={2} />
                            <Area type="monotone" dataKey="settlement" name="Thực nhận" stroke="#818cf8" fill="url(#ttNetGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed table */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>Chi tiết {TIME_VIEW_LABELS[viewMode].toLowerCase()}</h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{viewMode === 'day' ? 'Ngày' : viewMode === 'week' ? 'Tuần' : 'Tháng'}</th>
                                <th style={{ textAlign: 'right' }}>Đơn</th>
                                <th style={{ textAlign: 'right' }}>Doanh thu</th>
                                <th style={{ textAlign: 'right' }}>Hoa hồng TT</th>
                                <th style={{ textAlign: 'right' }}>Phí giao dịch</th>
                                <th style={{ textAlign: 'right' }}>TTLK</th>
                                <th style={{ textAlign: 'right' }}>Tổng phí</th>
                                <th style={{ textAlign: 'right' }}>Thực nhận</th>
                                <th style={{ textAlign: 'right' }}>Tỷ lệ phí</th>
                            </tr>
                        </thead>
                        <tbody>
                            {aggregated.map((d, i) => {
                                const feeR = d.revenue > 0 ? (d.fees / d.revenue * 100) : 0;
                                return (
                                    <tr key={i}>
                                        <td>{formatTimeLabel(d.label, viewMode)}</td>
                                        <td style={{ textAlign: 'right' }}>{d.orders}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(d.revenue)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(d.commissionFee)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#eab308' }}>{formatCurrency(d.transactionFee)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#8b5cf6' }}>{formatCurrency(d.affiliateComm)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#f97316' }}>{formatCurrency(d.fees)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{formatCurrency(d.settlement)}</td>
                                        <td style={{ textAlign: 'right' }}>{feeR.toFixed(1)}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}


// =====================================================
// TAB 4: Rút tiền
// =====================================================
function TabWithdrawals({ data }: { data: TikTokIncomeResult }) {
    const records = data.withdrawals;
    const earnings = records.filter(w => w.type === 'Earnings');
    const withdrawals = records.filter(w => w.type === 'Withdrawal');
    const others = records.filter(w => w.type !== 'Earnings' && w.type !== 'Withdrawal');

    const totalEarnings = earnings.reduce((s, w) => s + w.amount, 0);
    const totalWithdrawn = Math.abs(withdrawals.reduce((s, w) => s + w.amount, 0));
    const totalOther = others.reduce((s, w) => s + w.amount, 0);
    const balance = totalEarnings - totalWithdrawn + totalOther;

    if (records.length === 0) {
        return (
            <div className={`card ${styles.chartCard}`} style={{ textAlign: 'center', padding: 40 }}>
                <Wallet size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h3 style={{ color: 'var(--text-secondary)' }}>Chưa có lịch sử ví</h3>
            </div>
        );
    }

    // Daily aggregation for earnings/withdrawals chart
    const dailyMap = new Map<string, { label: string; earnings: number; withdrawn: number }>();
    records.forEach(w => {
        const d = w.requestTime.replace(/\//g, '-');
        if (!d) return;
        const existing = dailyMap.get(d) || { label: d, earnings: 0, withdrawn: 0 };
        if (w.type === 'Earnings') existing.earnings += w.amount;
        else existing.withdrawn += Math.abs(w.amount);
        dailyMap.set(d, existing);
    });
    const dailyWallet = [...dailyMap.values()].sort((a, b) => a.label.localeCompare(b.label));

    return (
        <>
            {/* Summary cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Tiền về ví</span>
                        <div className={styles.summaryCardIconWrap} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatShortCurrency(totalEarnings)}</div>
                    <div className={styles.summaryCardSub}>{earnings.length} lần nhận</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Đã rút ra</span>
                        <div className={styles.summaryCardIconWrap} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            <TrendingDown size={18} />
                        </div>
                    </div>
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{formatShortCurrency(totalWithdrawn)}</div>
                    <div className={styles.summaryCardSub}>{withdrawals.length} lần rút</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Khấu trừ khác</span>
                        <div className={styles.summaryCardIconWrap} style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                    <div className={styles.summaryCardValue} style={{ color: '#f97316' }}>{formatShortCurrency(Math.abs(totalOther))}</div>
                    <div className={styles.summaryCardSub}>{others.length > 0 ? others.map(o => o.type).join(', ') : 'Không có'}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Số dư ví</span>
                        <div className={styles.summaryCardIconWrap} style={{ background: balance >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: balance >= 0 ? '#22c55e' : '#ef4444' }}>
                            <Wallet size={18} />
                        </div>
                    </div>
                    <div className={styles.summaryCardValue} style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatShortCurrency(balance)}
                    </div>
                    <div className={styles.summaryCardSub}>Nhận − Rút − Khấu trừ</div>
                </div>
            </div>

            {/* Daily chart */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className={styles.chartTitle}>
                    <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                    Tiền về ví & Rút tiền theo ngày
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dailyWallet} barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={l => l.substring(5)} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => formatShortCurrency(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                labelFormatter={l => String(l).substring(5)}
                            />
                            <Legend />
                            <Bar dataKey="earnings" name="Tiền về ví" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="withdrawn" name="Rút ra" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Full transaction table */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>
                    <Wallet size={18} style={{ color: '#059669' }} />
                    Lịch sử giao dịch ví ({records.length} bản ghi)
                </h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Loại</th>
                                <th>Mã tham chiếu</th>
                                <th>Ngày</th>
                                <th style={{ textAlign: 'right' }}>Số tiền</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((w, i) => {
                                const isEarning = w.type === 'Earnings';
                                const isWithdrawal = w.type === 'Withdrawal';
                                const color = isEarning ? '#22c55e' : isWithdrawal ? '#ef4444' : '#f97316';
                                const bgColor = isEarning ? '#22c55e15' : isWithdrawal ? '#ef444415' : '#f9731615';
                                const label = isEarning ? '💰 Nhận tiền' : isWithdrawal ? '🏦 Rút tiền' : `⚡ ${w.type}`;
                                return (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                                        <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', background: bgColor, color }}>{label}</span></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{w.referenceId}</td>
                                        <td>{w.requestTime}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color, fontWeight: 600 }}>
                                            {isEarning ? '+' : ''}{formatCurrency(w.amount)}
                                        </td>
                                        <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', background: w.status === 'Transferred' ? '#22c55e22' : '#eab30822', color: w.status === 'Transferred' ? '#22c55e' : '#eab308' }}>{w.status === 'Transferred' ? '✅ Thành công' : w.status}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ padding: '12px 20px', background: 'rgba(34,197,94,0.06)', borderRadius: 8, flex: 1 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Tổng nhận: </strong>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>+{formatCurrency(totalEarnings)}</span>
                    </div>
                    <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, flex: 1 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Tổng rút: </strong>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>-{formatCurrency(totalWithdrawn)}</span>
                    </div>
                    <div style={{ padding: '12px 20px', background: balance >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 8, flex: 1 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Số dư: </strong>
                        <span style={{ color: balance >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{formatCurrency(balance)}</span>
                    </div>
                </div>
            </div>
        </>
    );
}

// =====================================================
// Main page
// =====================================================
export default function TikTokIncomePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');

    // Zustand store
    const stored = useDataStore(s => s.tiktokIncome);
    const setStored = useDataStore(s => s.setTiktokIncome);
    const clearStored = useDataStore(s => s.clearTiktokIncome);

    const [data, setData] = useState<TikTokIncomeResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);

    useEffect(() => {
        if (stored.data && !data) {
            setData(stored.data);
            setFileName(stored.fileName);
            setFileSize(stored.fileSize);
        }
    }, [stored, data]);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setIsProcessing(true);
        setFileName(file.name);
        setFileSize(file.size);
        setProgress(0);
        setProgressMsg('');

        try {
            const onProgress: ProgressCallback = (pct, msg) => {
                setProgress(pct);
                setProgressMsg(msg);
            };
            const result = await parseTikTokIncomeExcel(file, onProgress);
            setData(result);
            setActiveTab('overview');
            setStored(result, file.name, file.size);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi khi xử lý file');
            setData(null);
        } finally {
            setIsProcessing(false);
            setProgress(0);
            setProgressMsg('');
        }
    }, [setStored]);

    const handleClear = useCallback(() => {
        setData(null); setFileName(''); clearStored();
    }, [clearStored]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    };

    // =====================================================
    // UPLOAD STATE — same layout as Shopee
    // =====================================================
    if (!data) {
        return (
            <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-header__title">Phân Tích Doanh Thu TikTok</h1>
                        <p className="page-header__subtitle">Upload file Income Excel từ TikTok Seller Center</p>
                    </div>
                </div>

                <div className={styles.uploadSection}>
                    <div
                        className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneDragging : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileInput}
                            className={styles.fileInput}
                        />
                        {isProcessing ? (
                            <>
                                <Loader2 size={48} className={styles.uploadIcon} style={{ animation: 'spin 1s linear infinite' }} />
                                <h2 className={styles.uploadTitle}>Đang phân tích file...</h2>
                                <p className={styles.uploadSub}>{fileName}</p>
                                {progress > 0 && (
                                    <div style={{ width: '80%', maxWidth: 360, marginTop: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                            <span>{progressMsg}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{progress}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #2dd4bf)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <UploadCloud size={48} className={styles.uploadIcon} />
                                <h2 className={styles.uploadTitle}>Kéo thả file TikTok Income Excel vào đây</h2>
                                <p className={styles.uploadSub}>hoặc click để chọn file (.xlsx)</p>
                            </>
                        )}
                    </div>

                    {/* Hướng dẫn lấy file */}
                    <div className={styles.guideBox}>
                        <h3 className={styles.guideTitle}>📋 Hướng dẫn tải file Income từ TikTok Seller Center</h3>
                        <div className={styles.guideSteps}>
                            <div className={styles.guideStep}>
                                <span className={styles.guideStepNumber}>1</span>
                                <div>
                                    <strong>Đăng nhập TikTok Seller Center</strong><br />
                                    <span className={styles.guideStepDetail}>Vào mục <em>Finance</em> → <em>Settlement</em></span>
                                </div>
                            </div>
                            <div className={styles.guideStep}>
                                <span className={styles.guideStepNumber}>2</span>
                                <div>
                                    <strong>Chọn khoảng thời gian</strong> cần xuất<br />
                                    <span className={styles.guideStepDetail}>Ví dụ: tháng 01/2026</span>
                                </div>
                            </div>
                            <div className={styles.guideStep}>
                                <span className={styles.guideStepNumber}>3</span>
                                <div>
                                    <strong>Tải file Excel</strong><br />
                                    <span className={styles.guideStepDetail}>Click <em>Export</em> → Chọn <em>Income</em> → Download file <code>.xlsx</code></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{
                        padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                        color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}
            </div>
        );
    }

    // =====================================================
    // DATA LOADED — same layout as Shopee
    // =====================================================
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">Phân Tích Doanh Thu TikTok</h1>
                    <p className="page-header__subtitle">
                        {data.summary.timePeriod} · {data.summary.currency}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleClear}>
                    <UploadCloud size={16} /> Upload file mới
                </button>
            </div>

            {/* File Info Bar — same as Shopee */}
            <div className={styles.fileInfoBar}>
                <FileSpreadsheet size={20} className={styles.fileInfoIcon} />
                <div>
                    <div className={styles.fileInfoName}>{fileName}</div>
                    <div className={styles.fileInfoMeta}>
                        {formatFileSize(fileSize)} · {formatNumber(data.orders.length)} đơn · {formatNumber(data.withdrawals.length)} lần rút · TZ: {data.summary.timezone}
                    </div>
                </div>
            </div>

            {/* Tab Navigation — same as Shopee */}
            <div className={styles.tabNav}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <TabOverview data={data} />}
            {activeTab === 'daily' && <TabDaily data={data} />}
            {activeTab === 'fees' && <TabFees data={data} />}
            {activeTab === 'orders' && <TabOrders data={data} />}
            {activeTab === 'withdrawals' && <TabWithdrawals data={data} />}
        </div>
    );
}
