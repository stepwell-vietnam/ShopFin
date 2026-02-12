'use client';

import { useState, useRef, useCallback } from 'react';
import {
    UploadCloud, FileSpreadsheet, CheckCircle2, Loader2, X,
    DollarSign, TrendingUp, TrendingDown, Percent, Receipt,
    ShoppingCart, Package, BarChart3, Calendar, ArrowDownRight,
    RefreshCw, AlertTriangle,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    AreaChart, Area,
} from 'recharts';
import { parseIncomeExcel, type IncomeParseResult } from '@/lib/parsers/income-parser';
import { formatCurrency, formatShortCurrency, formatPercent, formatNumber, formatDate, formatFileSize } from '@/lib/formatters';
import styles from './income.module.css';

const FEE_COLORS: Record<string, string> = {
    'Phí cố định': '#ef4444',
    'Phí Dịch Vụ': '#f97316',
    'Phí thanh toán': '#eab308',
    'Hoa hồng TTLK': '#8b5cf6',
    'Phí PiShip': '#06b6d4',
    'Thuế GTGT': '#64748b',
    'Thuế TNCN': '#94a3b8',
};

const TABS = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'fees', label: 'Cơ cấu Chi phí', icon: Percent },
    { id: 'daily', label: 'Theo ngày', icon: Calendar },
    { id: 'orders', label: 'Chi tiết đơn', icon: ShoppingCart },
    { id: 'refunds', label: 'Hoàn/Trả hàng', icon: RefreshCw },
] as const;

type TabId = typeof TABS[number]['id'];

export default function IncomePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    // Local state for parsed data
    const [data, setData] = useState<IncomeParseResult | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [fileSize, setFileSize] = useState<number>(0);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setIsProcessing(true);
        setFileName(file.name);
        setFileSize(file.size);

        try {
            const result = await parseIncomeExcel(file);
            setData(result);
            setActiveTab('overview');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi khi xử lý file');
            setData(null);
        } finally {
            setIsProcessing(false);
        }
    }, []);

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
    // UPLOAD STATE
    // =====================================================
    if (!data) {
        return (
            <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-header__title">Phân tích Thu nhập</h1>
                        <p className="page-header__subtitle">Upload file Income Excel từ Shopee để phân tích chi tiết</p>
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
                            </>
                        ) : (
                            <>
                                <UploadCloud size={48} className={styles.uploadIcon} />
                                <h2 className={styles.uploadTitle}>Kéo thả file Income Excel vào đây</h2>
                                <p className={styles.uploadSub}>hoặc click để chọn file (.xlsx)</p>
                            </>
                        )}
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
    // DATA LOADED — Render tabs
    // =====================================================
    const s = data.summary;
    const orders = data.orders;
    const daily = data.dailyIncome;
    const adjustments = data.adjustments;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">Phân tích Thu nhập</h1>
                    <p className="page-header__subtitle">
                        {s.shopName} · {s.period.from} → {s.period.to}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { setData(null); setFileName(''); }}>
                    <UploadCloud size={16} /> Upload file mới
                </button>
            </div>

            {/* File Info Bar */}
            <div className={styles.fileInfoBar}>
                <FileSpreadsheet size={20} className={styles.fileInfoIcon} />
                <div>
                    <div className={styles.fileInfoName}>{fileName}</div>
                    <div className={styles.fileInfoMeta}>
                        {formatFileSize(fileSize)} · {formatNumber(orders.length)} đơn · {daily.length} ngày · {adjustments.length} hoàn
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
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
            {activeTab === 'overview' && <TabOverview s={s} daily={daily} orders={orders} />}
            {activeTab === 'fees' && <TabFees s={s} />}
            {activeTab === 'daily' && <TabDaily daily={daily} />}
            {activeTab === 'orders' && <TabOrders orders={orders} />}
            {activeTab === 'refunds' && <TabRefunds adjustments={adjustments} s={s} />}
        </div>
    );
}

// =====================================================
// TAB 1: Tổng quan
// =====================================================
function TabOverview({ s, daily, orders }: {
    s: IncomeParseResult['summary'];
    daily: IncomeParseResult['dailyIncome'];
    orders: IncomeParseResult['orders'];
}) {
    const margin = s.totalRevenue > 0 ? (s.netRevenue / s.totalRevenue) * 100 : 0;
    const feeRatio = s.totalRevenue > 0 ? (Math.abs(s.totalFees) / s.totalRevenue) * 100 : 0;
    const refundRate = s.originalPrice > 0 ? (Math.abs(s.refundAmount) / s.originalPrice) * 100 : 0;
    const aov = orders.length > 0 ? s.totalRevenue / orders.length : 0;

    const kpis = [
        { label: 'Tổng Doanh thu', value: formatShortCurrency(s.totalRevenue), icon: DollarSign, color: '#2dd4bf', sub: `Giá gốc ${formatShortCurrency(s.originalPrice)}` },
        { label: 'Thực nhận', value: formatShortCurrency(s.netRevenue), icon: TrendingUp, color: '#22c55e', sub: `Biên ${formatPercent(margin)}` },
        { label: 'Tổng phí sàn', value: formatShortCurrency(Math.abs(s.totalFees)), icon: TrendingDown, color: '#ef4444', sub: `Tỷ lệ ${formatPercent(feeRatio)}` },
        { label: 'AOV (TB/đơn)', value: formatShortCurrency(aov), icon: ShoppingCart, color: '#818cf8', sub: `${formatNumber(orders.length)} đơn` },
    ];

    // Revenue chart (daily)
    const chartData = daily.map(d => ({
        date: d.date.substring(5),
        revenue: d.productPrice,
        net: d.totalPayment,
    }));

    return (
        <>
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

            {/* Highlights */}
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
                        <Receipt size={20} />
                    </div>
                    <div>
                        <div className={styles.highlightValue}>{formatShortCurrency(Math.abs(s.totalTax))}</div>
                        <div className={styles.highlightLabel}>Thuế (GTGT + TNCN)</div>
                    </div>
                </div>
                <div className={styles.highlightCard}>
                    <div className={styles.highlightIcon} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        <Package size={20} />
                    </div>
                    <div>
                        <div className={styles.highlightValue}>{formatShortCurrency(Math.abs(s.sellerDiscount))}</div>
                        <div className={styles.highlightLabel}>Trợ giá Người bán</div>
                    </div>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className={`card ${styles.chartCard}`}>
                <h3 className={styles.chartTitle}>
                    <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                    Doanh thu & Thực nhận theo ngày
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData} barCategoryGap="15%">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => formatShortCurrency(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Doanh thu SP" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="net" name="Thực nhận" fill="#818cf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </>
    );
}

// =====================================================
// TAB 2: Cơ cấu Chi phí
// =====================================================
function TabFees({ s }: { s: IncomeParseResult['summary'] }) {
    const fees = [
        { name: 'Phí cố định', value: Math.abs(s.fixedFee) },
        { name: 'Phí Dịch Vụ', value: Math.abs(s.serviceFee) },
        { name: 'Phí thanh toán', value: Math.abs(s.paymentFee) },
        { name: 'Hoa hồng TTLK', value: Math.abs(s.affiliateFee) },
        { name: 'Phí PiShip', value: Math.abs(s.pishipFee) },
        { name: 'Thuế GTGT', value: Math.abs(s.vatTax) },
        { name: 'Thuế TNCN', value: Math.abs(s.pitTax) },
    ].filter(f => f.value > 0);

    const totalAll = fees.reduce((s, f) => s + f.value, 0);
    const maxFee = Math.max(...fees.map(f => f.value));

    const pieData = fees.map(f => ({ ...f, color: FEE_COLORS[f.name] || '#64748b' }));

    return (
        <>
            {/* Summary */}
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
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>Phí cố định</div>
                    <div className={styles.summaryCardSub}>
                        {formatCurrency(Math.abs(s.fixedFee))} ({formatPercent(totalAll > 0 ? Math.abs(s.fixedFee) / totalAll * 100 : 0)} tổng phí)
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Tỷ lệ phí sàn</span>
                    </div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(s.totalRevenue > 0 ? Math.abs(s.totalFees) / s.totalRevenue * 100 : 0)}
                    </div>
                    <div className={styles.summaryCardSub}>Trên doanh thu sản phẩm</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Thuế / Doanh thu</span>
                    </div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(s.totalRevenue > 0 ? Math.abs(s.totalTax) / s.totalRevenue * 100 : 0)}
                    </div>
                    <div className={styles.summaryCardSub}>{formatCurrency(Math.abs(s.totalTax))}</div>
                </div>
            </div>

            <div className={styles.chartsRow}>
                {/* Pie Chart */}
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

                {/* Fee Waterfall */}
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
                            <span style={{ width: '80px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>% DT SP</span>
                        </div>
                        <div className={styles.feeItem}>
                            <span className={styles.feeLabel}>Doanh thu sản phẩm</span>
                            <span style={{ flex: 1 }} />
                            <span className={styles.feeValue} style={{ color: '#2dd4bf', width: '140px', textAlign: 'right' }}>{formatCurrency(s.totalRevenue)}</span>
                            <span style={{ width: '80px', textAlign: 'right', color: '#2dd4bf', fontWeight: 600, fontSize: '0.85rem' }}>100%</span>
                        </div>
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
                        <div className={`${styles.feeItem} ${styles.feeTotal}`}>
                            <span className={styles.feeLabel}>= Thực nhận</span>
                            <span style={{ flex: 1 }} />
                            <span className={styles.feeValue} style={{ color: '#22c55e', fontWeight: 700, width: '140px', textAlign: 'right' }}>
                                {formatCurrency(s.netRevenue)}
                            </span>
                            <span style={{ width: '80px', textAlign: 'right', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem' }}>
                                {s.totalRevenue > 0 ? (s.netRevenue / s.totalRevenue * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// =====================================================
// TAB 3: Theo ngày
// =====================================================
function TabDaily({ daily }: { daily: IncomeParseResult['dailyIncome'] }) {
    const totalRevenue = daily.reduce((s, d) => s + d.productPrice, 0);
    const totalNet = daily.reduce((s, d) => s + d.totalPayment, 0);
    const totalOrders = daily.reduce((s, d) => s + d.orderCount, 0);
    const avgDaily = daily.length > 0 ? totalRevenue / daily.length : 0;

    // Find best & worst days
    const sorted = [...daily].sort((a, b) => b.totalPayment - a.totalPayment);
    const bestDay = sorted[0];
    const worstDay = sorted[sorted.length - 1];

    const chartData = daily.map(d => ({
        date: d.date.substring(5),
        revenue: d.productPrice,
        net: d.totalPayment,
        fees: Math.abs(d.totalFees),
        orders: d.orderCount,
    }));

    return (
        <>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>TB Doanh thu/ngày</div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(avgDaily)}</div>
                    <div className={styles.summaryCardSub}>{daily.length} ngày giao dịch</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Ngày cao nhất</div>
                    <div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>
                        {bestDay ? formatDate(bestDay.date) : '-'}
                    </div>
                    <div className={styles.summaryCardSub}>
                        {bestDay ? `${formatShortCurrency(bestDay.totalPayment)} · ${bestDay.orderCount} đơn` : ''}
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Ngày thấp nhất</div>
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>
                        {worstDay ? formatDate(worstDay.date) : '-'}
                    </div>
                    <div className={styles.summaryCardSub}>
                        {worstDay ? `${formatShortCurrency(worstDay.totalPayment)} · ${worstDay.orderCount} đơn` : ''}
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>TB Đơn/ngày</div>
                    <div className={styles.summaryCardValue}>
                        {daily.length > 0 ? (totalOrders / daily.length).toFixed(1) : 0}
                    </div>
                    <div className={styles.summaryCardSub}>{formatNumber(totalOrders)} tổng đơn</div>
                </div>
            </div>

            {/* Area Chart */}
            <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className={styles.chartTitle}>
                    <TrendingUp size={18} style={{ color: '#2dd4bf' }} />
                    Xu hướng Doanh thu 30 ngày
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="netGrad2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => formatShortCurrency(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="revenue" name="Doanh thu SP" stroke="#2dd4bf" fill="url(#revGrad)" strokeWidth={2} />
                            <Area type="monotone" dataKey="net" name="Thực nhận" stroke="#818cf8" fill="url(#netGrad2)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Daily Table */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>Chi tiết theo ngày</h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th style={{ textAlign: 'right' }}>Đơn</th>
                                <th style={{ textAlign: 'right' }}>Doanh thu SP</th>
                                <th style={{ textAlign: 'right' }}>Phí cố định</th>
                                <th style={{ textAlign: 'right' }}>Phí DV</th>
                                <th style={{ textAlign: 'right' }}>Phí TT</th>
                                <th style={{ textAlign: 'right' }}>TTLK</th>
                                <th style={{ textAlign: 'right' }}>Thuế</th>
                                <th style={{ textAlign: 'right' }}>Thực nhận</th>
                                <th style={{ textAlign: 'right' }}>Tỷ lệ phí</th>
                            </tr>
                        </thead>
                        <tbody>
                            {daily.map((d, i) => {
                                const feeR = d.productPrice > 0 ? (Math.abs(d.totalFees + d.totalTax) / d.productPrice * 100) : 0;
                                return (
                                    <tr key={i}>
                                        <td>{formatDate(d.date)}</td>
                                        <td style={{ textAlign: 'right' }}>{d.orderCount}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(d.productPrice)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(Math.abs(d.fixedFee))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#f97316' }}>{formatCurrency(Math.abs(d.serviceFee))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#eab308' }}>{formatCurrency(Math.abs(d.paymentFee))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#8b5cf6' }}>{formatCurrency(Math.abs(d.affiliateFee))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{formatCurrency(Math.abs(d.totalTax))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{formatCurrency(d.totalPayment)}</td>
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
// TAB 4: Chi tiết đơn
// =====================================================
function TabOrders({ orders }: { orders: IncomeParseResult['orders'] }) {
    const totalOrders = orders.length;
    const totalPaid = orders.reduce((s, o) => s + o.totalPaid, 0);
    const avgOrder = totalOrders > 0 ? totalPaid / totalOrders : 0;

    // Payment method distribution
    const paymentMethods: Record<string, number> = {};
    const affiliateOrders = orders.filter(o => o.affiliateFee !== 0);

    for (const o of orders) {
        const method = o.paymentMethod || 'Khác';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    }
    const paymentPie = Object.entries(paymentMethods)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const PIE_COLORS = ['#2dd4bf', '#818cf8', '#f472b6', '#fb923c', '#a3e635', '#64748b'];

    // Top products by revenue
    const productRevenue: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const o of orders) {
        // Use orderId as grouping since we only have Order rows
        const key = o.orderId;
        if (!productRevenue[key]) {
            productRevenue[key] = { name: o.orderId, count: 0, revenue: 0 };
        }
        productRevenue[key].count++;
        productRevenue[key].revenue += o.productPrice;
    }

    return (
        <>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Tổng đơn hàng</div>
                    <div className={styles.summaryCardValue}>{formatNumber(totalOrders)}</div>
                    <div className={styles.summaryCardSub}>Đã thanh toán thành công</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>AOV (TB/đơn)</div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(avgOrder)}</div>
                    <div className={styles.summaryCardSub}>Average Order Value</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Đơn có Affiliate</div>
                    <div className={styles.summaryCardValue}>{formatNumber(affiliateOrders.length)}</div>
                    <div className={styles.summaryCardSub}>
                        {formatPercent(totalOrders > 0 ? (affiliateOrders.length / totalOrders) * 100 : 0)} tổng đơn
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Phí Affiliate</div>
                    <div className={styles.summaryCardValue} style={{ color: '#8b5cf6' }}>
                        {formatShortCurrency(Math.abs(affiliateOrders.reduce((s, o) => s + o.affiliateFee, 0)))}
                    </div>
                    <div className={styles.summaryCardSub}>Tổng hoa hồng TTLK</div>
                </div>
            </div>

            <div className={styles.chartsRowEqual}>
                {/* Payment Method Pie */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <DollarSign size={18} style={{ color: 'var(--accent-primary)' }} />
                        Phương thức Thanh toán
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={paymentPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {paymentPie.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={(value: number | undefined) => [`${value ?? 0} đơn`, '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Order Value Distribution */}
                <div className={`card ${styles.chartCard}`}>
                    <h3 className={styles.chartTitle}>
                        <ShoppingCart size={18} style={{ color: '#818cf8' }} />
                        Phân bố Giá trị Đơn
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={getOrderDistribution(orders)} barCategoryGap="15%">
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
            </div>

            {/* Top 10 Orders by value */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>Top 10 đơn hàng giá trị cao nhất</h3>
                <div className={styles.tableWrap}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Mã đơn</th>
                                <th>Ngày TT</th>
                                <th>PTTT</th>
                                <th style={{ textAlign: 'right' }}>Giá SP</th>
                                <th style={{ textAlign: 'right' }}>Phí</th>
                                <th style={{ textAlign: 'right' }}>Thực nhận</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...orders].sort((a, b) => b.productPrice - a.productPrice).slice(0, 10).map((o, i) => {
                                const totalFee = o.fixedFee + o.serviceFee + o.paymentFee + o.affiliateFee;
                                return (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{i + 1}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td>
                                        <td>{o.paymentDate ? formatDate(o.paymentDate) : '-'}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{o.paymentMethod}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(o.productPrice)}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(Math.abs(totalFee))}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>{formatCurrency(o.totalPaid)}</td>
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

function getOrderDistribution(orders: IncomeParseResult['orders']) {
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
        count: orders.filter(o => o.productPrice >= r.min && o.productPrice < r.max).length,
    }));
}

// =====================================================
// TAB 5: Hoàn/Trả hàng
// =====================================================
function TabRefunds({ adjustments, s }: {
    adjustments: IncomeParseResult['adjustments'];
    s: IncomeParseResult['summary'];
}) {
    const totalRefund = adjustments.reduce((sum, a) => sum + Math.abs(a.amount), 0);
    const avgRefund = adjustments.length > 0 ? totalRefund / adjustments.length : 0;
    const refundRate = s.originalPrice > 0 ? (Math.abs(s.refundAmount) / s.originalPrice) * 100 : 0;

    // Group by week
    const byWeek: Record<string, { count: number; total: number }> = {};
    for (const a of adjustments) {
        const date = new Date(a.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const key = weekStart.toISOString().substring(0, 10);
        if (!byWeek[key]) byWeek[key] = { count: 0, total: 0 };
        byWeek[key].count++;
        byWeek[key].total += Math.abs(a.amount);
    }

    const weeklyData = Object.entries(byWeek).map(([week, data]) => ({
        week: week.substring(5),
        count: data.count,
        total: data.total,
    }));

    return (
        <>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Tổng hoàn tiền</div>
                    <div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>
                        {formatShortCurrency(totalRefund)}
                    </div>
                    <div className={styles.summaryCardSub}>{adjustments.length} giao dịch</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>TB / giao dịch hoàn</div>
                    <div className={styles.summaryCardValue}>{formatShortCurrency(avgRefund)}</div>
                    <div className={styles.summaryCardSub}>Giá trị trung bình</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Tỷ lệ hoàn / Giá gốc</div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(refundRate)}
                        {refundRate < 5 ? ' ✅' : ' ⚠️'}
                    </div>
                    <div className={styles.summaryCardSub}>Mục tiêu: dưới 5%</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardLabel}>Hoàn / Doanh thu</div>
                    <div className={styles.summaryCardValue}>
                        {formatPercent(s.totalRevenue > 0 ? (totalRefund / s.totalRevenue) * 100 : 0)}
                    </div>
                    <div className={styles.summaryCardSub}>%. tác động lên doanh thu</div>
                </div>
            </div>

            {/* Weekly chart */}
            {weeklyData.length > 0 && (
                <div className={`card ${styles.chartCard}`} style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 className={styles.chartTitle}>
                        <Calendar size={18} style={{ color: '#ef4444' }} />
                        Hoàn tiền theo tuần
                    </h3>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => formatShortCurrency(v)} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0), '']}
                                />
                                <Bar dataKey="total" name="Hoàn tiền" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className={`card ${styles.tableSection}`}>
                <h3 className={styles.sectionTitle}>
                    <RefreshCw size={18} style={{ color: '#ef4444' }} />
                    Chi tiết Giao dịch Hoàn
                </h3>
                <div className={styles.adjustmentList}>
                    {adjustments.map((a, i) => (
                        <div key={i} className={styles.adjustmentItem}>
                            <span className={styles.adjustmentDate}>{formatDate(a.date)}</span>
                            <span className={styles.adjustmentOrder}>{a.relatedOrderId}</span>
                            <span className={styles.adjustmentAmount}>-{formatCurrency(Math.abs(a.amount))}</span>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', textAlign: 'right' }}>
                    <strong>Tổng hoàn: </strong>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>-{formatCurrency(totalRefund)}</span>
                </div>
            </div>
        </>
    );
}
