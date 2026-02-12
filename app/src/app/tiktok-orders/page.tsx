'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, BarChart3, ShoppingCart, MapPin, Clock, Tag, RefreshCw, TrendingUp, TrendingDown, DollarSign, Percent, Package, Users, ArrowDown } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseTikTokOrderExcel, type TikTokOrder, type TikTokOrderParseResult } from '@/lib/parsers/tiktok-order-parser';
import type { ProgressCallback } from '@/lib/parsers/income-parser';
import { formatCurrency, formatShortCurrency, formatNumber, formatPercent, formatFileSize } from '@/lib/formatters';
import { useDataStore } from '@/store/useDataStore';
import styles from '../income/income.module.css';

const TABS = [
    { id: 'funnel', label: 'Phễu Đơn hàng', icon: BarChart3 },
    { id: 'products', label: 'Sản phẩm', icon: Package },
    { id: 'regional', label: 'Địa lý', icon: MapPin },
    { id: 'behavior', label: 'Hành vi', icon: Clock },
    { id: 'pricing', label: 'Giá & KM', icon: Tag },
    { id: 'returns', label: 'Trả hàng', icon: RefreshCw },
] as const;
type TabId = typeof TABS[number]['id'];

const STATUS_COLORS: Record<string, string> = {
    'Đã hoàn tất': '#22c55e', 'Đã vận chuyển': '#2dd4bf', 'Đã giao': '#2dd4bf',
    'Đã hủy': '#ef4444', 'Đang vận chuyển': '#f59e0b', 'Chờ xử lý': '#818cf8',
};
const PIE_COLORS = ['#2dd4bf', '#818cf8', '#f472b6', '#fb923c', '#a3e635', '#ef4444', '#64748b', '#06b6d4', '#eab308', '#8b5cf6'];

// ===== Smart Time Aggregation =====
type TimeViewMode = 'day' | 'week' | 'month';
const TIME_VIEW_LABELS: Record<TimeViewMode, string> = { day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng' };

function parseTikTokDate(dateStr: string): string {
    // TikTok format: "31/01/2026 23:21:13" → "2026-01-31"
    if (!dateStr) return '';
    const parts = dateStr.split(' ')[0]?.split('/');
    if (!parts || parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseTikTokHour(dateStr: string): string {
    // "31/01/2026 23:21:13" → "23"
    if (!dateStr) return '';
    const time = dateStr.split(' ')[1];
    if (!time) return '';
    return time.split(':')[0] || '';
}

function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const dayOfYear = Math.floor((d.getTime() - jan4.getTime()) / 86400000) + 4;
    const week = Math.ceil(dayOfYear / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function getMonthKey(dateStr: string): string { return dateStr.substring(0, 7); }
function autoDetectViewMode(numDays: number): TimeViewMode {
    if (numDays <= 45) return 'day';
    if (numDays <= 180) return 'week';
    return 'month';
}
function formatOrderAggLabel(label: string, mode: TimeViewMode): string {
    if (mode === 'day') return label.substring(5);
    if (mode === 'week') { const [y, w] = label.split('-W'); return `T${w}/${y.substring(2)}`; }
    const [y, m] = label.split('-'); return `${parseInt(m)}/${y.substring(2)}`;
}

type OrderAggBucket = { label: string; total: number; done: number; cancel: number };

function aggregateOrdersByMode(
    dailyMap: Record<string, { total: number; done: number; cancel: number }>,
    mode: TimeViewMode
): OrderAggBucket[] {
    if (mode === 'day') {
        return Object.entries(dailyMap).sort().map(([d, v]) => ({ label: d, ...v }));
    }
    const buckets: Record<string, OrderAggBucket> = {};
    for (const [dateStr, vals] of Object.entries(dailyMap)) {
        const key = mode === 'week' ? getISOWeek(dateStr) : getMonthKey(dateStr);
        if (!buckets[key]) buckets[key] = { label: key, total: 0, done: 0, cancel: 0 };
        buckets[key].total += vals.total;
        buckets[key].done += vals.done;
        buckets[key].cancel += vals.cancel;
    }
    return Object.values(buckets).sort((a, b) => a.label.localeCompare(b.label));
}

// ===== Helper: identify order completion =====
function isCompleted(o: TikTokOrder): boolean {
    return o.status === 'Đã hoàn tất' || o.substatus === 'Đã hoàn tất' || o.substatus === 'Đã giao';
}
function isCancelled(o: TikTokOrder): boolean {
    return o.status === 'Đã hủy' || o.substatus === 'Đã hủy';
}
function isReturned(o: TikTokOrder): boolean {
    // Only count actual returns — NOT cancelled orders with returnQuantity > 0 (those are cancel type)
    return o.cancelReturnType === 'Return/Refund' || o.cancelReturnType === 'Return';
}

// =====================================================
// Main page
// =====================================================
export default function TikTokOrdersPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('funnel');
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');

    // Zustand store — persist across navigation
    const stored = useDataStore(s => s.tiktokOrders);
    const setStored = useDataStore(s => s.setTiktokOrders);
    const clearStored = useDataStore(s => s.clearTiktokOrders);

    // Local state for display (hydrate from store on mount)
    const [data, setData] = useState<TikTokOrderParseResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);

    // Hydrate from store on mount
    useEffect(() => {
        if (stored.data && !data) {
            setData(stored.data);
            setFileName(stored.fileName);
            setFileSize(stored.fileSize);
        }
    }, [stored, data]);

    const handleFile = useCallback(async (file: File) => {
        setError(null); setIsProcessing(true); setFileName(file.name); setFileSize(file.size);
        setProgress(0); setProgressMsg('');
        try {
            const onProgress: ProgressCallback = (pct, msg) => { setProgress(pct); setProgressMsg(msg); };
            const r = await parseTikTokOrderExcel(file, onProgress);
            setData(r); setActiveTab('funnel');
            // Persist to Zustand store
            setStored(r, file.name, file.size);
        }
        catch (e) { setError(e instanceof Error ? e.message : 'Lỗi'); setData(null); }
        finally { setIsProcessing(false); setProgress(0); setProgressMsg(''); }
    }, [setStored]);

    const handleClear = useCallback(() => {
        setData(null); setFileName(''); clearStored();
    }, [clearStored]);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
    const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };

    if (!data) return (
        <div>
            <div className="page-header"><div><h1 className="page-header__title">Phân tích Đơn hàng TikTok</h1><p className="page-header__subtitle">Upload file Order Excel từ TikTok Seller Center</p></div></div>
            <div className={styles.uploadSection}>
                <div className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneDragging : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onInput} className={styles.fileInput} />
                    {isProcessing ? (<><Loader2 size={48} className={styles.uploadIcon} style={{ animation: 'spin 1s linear infinite' }} /><h2 className={styles.uploadTitle}>Đang phân tích...</h2><p className={styles.uploadSub}>{fileName}</p>{progress > 0 && (<div style={{ width: '80%', maxWidth: 360, marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}><span>{progressMsg}</span><span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{progress}%</span></div><div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #2dd4bf)', borderRadius: 3, transition: 'width 0.3s ease' }} /></div></div>)}</>
                    ) : (<><UploadCloud size={48} className={styles.uploadIcon} /><h2 className={styles.uploadTitle}>Kéo thả file Order Excel vào đây</h2><p className={styles.uploadSub}>hoặc click để chọn file (.xlsx)</p></>)}
                </div>
            </div>
            <div className={styles.guideBox}>
                <div className={styles.guideTitle}>📋 Hướng dẫn lấy file Excel từ TikTok</div>
                <div className={styles.guideSteps}>
                    <div className={styles.guideStep}>
                        <span className={styles.guideStepNumber}>1</span>
                        <div>
                            <strong>Vào TikTok Seller Center</strong> và đăng nhập
                            <div className={styles.guideStepDetail}>
                                Chọn <em>Orders</em> → <em>Manage Orders</em>
                            </div>
                        </div>
                    </div>
                    <div className={styles.guideStep}>
                        <span className={styles.guideStepNumber}>2</span>
                        <div>
                            <strong>Chọn khoảng thời gian</strong> phù hợp
                            <div className={styles.guideStepDetail}>
                                Nhấn <em>Export</em> → chọn <em>Order SKU List</em> → <em>Download</em>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} />{error}</div>}
        </div>
    );

    const all = data.orders;
    const completed = all.filter(isCompleted);
    const cancelled = all.filter(isCancelled);

    return (
        <div>
            <div className="page-header">
                <div><h1 className="page-header__title">Phân tích Đơn hàng TikTok</h1><p className="page-header__subtitle">{formatNumber(all.length)} đơn · {data.totalRows} dòng</p></div>
                <button className="btn btn-primary" onClick={handleClear}><UploadCloud size={16} /> Upload file mới</button>
            </div>
            <div className={styles.fileInfoBar}><FileSpreadsheet size={20} className={styles.fileInfoIcon} /><div><div className={styles.fileInfoName}>{fileName}</div><div className={styles.fileInfoMeta}>{formatFileSize(fileSize)} · {formatNumber(all.length)} đơn · {formatNumber(completed.length)} hoàn thành · {formatNumber(cancelled.length)} hủy</div></div></div>
            <div className={styles.tabNav}>{TABS.map(t => { const I = t.icon; return <button key={t.id} className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab(t.id)}><I size={16} />{t.label}</button>; })}</div>
            {activeTab === 'funnel' && <TabFunnel all={all} completed={completed} cancelled={cancelled} />}
            {activeTab === 'products' && <TabProducts completed={completed} />}
            {activeTab === 'regional' && <TabRegional completed={completed} />}
            {activeTab === 'behavior' && <TabBehavior all={all} completed={completed} />}
            {activeTab === 'pricing' && <TabPricing all={all} completed={completed} cancelled={cancelled} />}
            {activeTab === 'returns' && <TabReturns all={all} />}
        </div>
    );
}

// ===== Visual funnel bar component =====
function FunnelBar({ label, count, total, color, icon, sub }: { label: string; count: number; total: number; color: string; icon: React.ReactNode; sub?: string }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(count)} <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-muted)' }}>({pct.toFixed(1)}%)</span></span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

// ===== TAB 1: Order Funnel =====
function TabFunnel({ all, completed, cancelled }: { all: TikTokOrder[]; completed: TikTokOrder[]; cancelled: TikTokOrder[] }) {
    const returned = all.filter(isReturned);
    const kept = completed.filter(o => !isReturned(o));
    const completionRate = all.length > 0 ? (completed.length / all.length) * 100 : 0;
    const cancelRate = all.length > 0 ? (cancelled.length / all.length) * 100 : 0;
    const returnRate = completed.length > 0 ? (returned.length / completed.length) * 100 : 0;
    const totalRevenue = completed.reduce((s, o) => s + o.subtotalAfterDiscount, 0);
    const aov = completed.length > 0 ? totalRevenue / completed.length : 0;

    // 3-category pie: Giữ lại, Hủy, Return/Refund
    const funnelPie = [
        { name: 'Giữ lại', value: kept.length },
        { name: 'Hủy', value: cancelled.length },
        { name: 'Return/Refund', value: returned.length },
    ].filter(d => d.value > 0);
    const FUNNEL_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

    // Cancel reasons
    const reasons: Record<string, number> = {};
    cancelled.forEach(o => { const r = o.cancelReason?.substring(0, 50) || 'Không rõ'; reasons[r] = (reasons[r] || 0) + 1; });
    const cancelData = Object.entries(reasons).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Cancel by breakdown
    const cancelByMap: Record<string, number> = {};
    cancelled.forEach(o => { const cb = o.cancelBy || 'Không rõ'; cancelByMap[cb] = (cancelByMap[cb] || 0) + 1; });
    const cancelByData = Object.entries(cancelByMap).map(([name, value]) => ({ name, value, pct: cancelled.length > 0 ? (value / cancelled.length * 100) : 0 })).sort((a, b) => b.value - a.value);

    // Daily orders map
    const dailyMap: Record<string, { total: number; done: number; cancel: number; ret: number }> = {};
    all.forEach(o => {
        const d = parseTikTokDate(o.createdTime);
        if (!d) return;
        if (!dailyMap[d]) dailyMap[d] = { total: 0, done: 0, cancel: 0, ret: 0 };
        dailyMap[d].total++;
        if (isCompleted(o)) dailyMap[d].done++;
        if (isCancelled(o)) dailyMap[d].cancel++;
        if (isReturned(o)) dailyMap[d].ret++;
    });

    const numDays = Object.keys(dailyMap).length;
    const defaultMode = useMemo(() => autoDetectViewMode(numDays), [numDays]);
    const [viewMode, setViewMode] = useState<TimeViewMode>(defaultMode);
    // Aggregate with return data
    const aggregated = useMemo(() => {
        const map: Record<string, { total: number; done: number; cancel: number }> = {};
        for (const [d, v] of Object.entries(dailyMap)) map[d] = { total: v.total, done: v.done, cancel: v.cancel };
        return aggregateOrdersByMode(map, viewMode);
    }, [dailyMap, viewMode]);
    const chartData = aggregated.map(d => ({ date: formatOrderAggLabel(d.label, viewMode), done: d.done, cancel: d.cancel }));

    return (<>
        {/* KPI cards — 5 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Tổng đơn</span><div className={styles.summaryCardIconWrap} style={{ background: '#2dd4bf15', color: '#2dd4bf' }}><ShoppingCart size={18} /></div></div><div className={styles.summaryCardValue}>{formatNumber(all.length)}</div><div className={styles.summaryCardSub}>{formatShortCurrency(totalRevenue)}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Hoàn thành</span><div className={styles.summaryCardIconWrap} style={{ background: '#22c55e15', color: '#22c55e' }}><TrendingUp size={18} /></div></div><div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatNumber(completed.length)}</div><div className={styles.summaryCardSub}>{formatPercent(completionRate)} tổng đơn</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Hủy</span><div className={styles.summaryCardIconWrap} style={{ background: '#ef444415', color: '#ef4444' }}><TrendingDown size={18} /></div></div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{formatNumber(cancelled.length)}</div><div className={styles.summaryCardSub}>{formatPercent(cancelRate)} tổng đơn</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Return/Refund</span><div className={styles.summaryCardIconWrap} style={{ background: '#f59e0b15', color: '#f59e0b' }}><RefreshCw size={18} /></div></div><div className={styles.summaryCardValue} style={{ color: '#f59e0b' }}>{formatNumber(returned.length)}</div><div className={styles.summaryCardSub}>{formatPercent(returnRate)} hoàn thành {returnRate < 5 ? '✅' : '⚠️'}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>AOV</span><div className={styles.summaryCardIconWrap} style={{ background: '#818cf815', color: '#818cf8' }}><DollarSign size={18} /></div></div><div className={styles.summaryCardValue}>{formatShortCurrency(aov)}</div><div className={styles.summaryCardSub}>Giữ lại: {formatNumber(kept.length)}</div></div>
        </div>

        {/* Visual Funnel + Pie Chart */}
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}>
                <h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#2dd4bf' }} />Phễu Đơn hàng</h3>
                <div style={{ padding: '8px 0' }}>
                    <FunnelBar label="Tổng đơn hàng" count={all.length} total={all.length} color="#2dd4bf" icon={<ShoppingCart size={18} />} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0', color: 'var(--text-muted)' }}><ArrowDown size={16} /></div>
                    <FunnelBar label="✅ Hoàn thành" count={completed.length} total={all.length} color="#22c55e" icon={<TrendingUp size={18} />} sub={`Doanh thu: ${formatShortCurrency(totalRevenue)}`} />
                    <div style={{ paddingLeft: 48, borderLeft: '2px solid var(--border-default)', marginLeft: 18 }}>
                        <FunnelBar label="Giữ lại" count={kept.length} total={all.length} color="#22c55e" icon={<Package size={18} />} />
                        <FunnelBar label="🔄 Return/Refund" count={returned.length} total={all.length} color="#f59e0b" icon={<RefreshCw size={18} />} sub={`${formatPercent(returnRate)} đơn hoàn thành`} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0', color: 'var(--text-muted)' }}><ArrowDown size={16} /></div>
                    <FunnelBar label="❌ Hủy" count={cancelled.length} total={all.length} color="#ef4444" icon={<TrendingDown size={18} />} />
                    {cancelByData.length > 0 && (
                        <div style={{ paddingLeft: 48, borderLeft: '2px solid var(--border-default)', marginLeft: 18 }}>
                            {cancelByData.map((cb, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{cb.name}</span>
                                    <span style={{ fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{cb.value} ({cb.pct.toFixed(0)}%)</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className={`card ${styles.chartCard}`}>
                <h3 className={styles.chartTitle}><Percent size={18} style={{ color: '#2dd4bf' }} />Phân bố Kết quả</h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={funnelPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                {funnelPie.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Cancel reasons chart */}
        <div className={`card ${styles.chartCard}`}>
            <h3 className={styles.chartTitle}><TrendingDown size={18} style={{ color: '#ef4444' }} />Lý do Hủy đơn</h3>
            <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cancelData} layout="vertical" margin={{ left: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={120} />
                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Bar dataKey="value" name="Số đơn" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Daily chart */}
        <div className={`card ${styles.chartCard}`}>
            <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#2dd4bf' }} />Đơn hàng {TIME_VIEW_LABELS[viewMode].toLowerCase()}</h3>
                <div className={styles.timeToggle}>
                    {(['day', 'week', 'month'] as TimeViewMode[]).map(m => (
                        <button key={m} className={`${styles.timeToggleBtn} ${viewMode === m ? styles.timeToggleBtnActive : ''}`} onClick={() => setViewMode(m)}>{TIME_VIEW_LABELS[m]}</button>
                    ))}
                </div>
            </div>
            <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} barCategoryGap="10%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={chartData.length > 31 ? Math.floor(chartData.length / 20) : 0} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Legend />
                        <Bar dataKey="done" name="Hoàn thành" stackId="a" fill="#22c55e" />
                        <Bar dataKey="cancel" name="Hủy" stackId="a" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    </>);
}

// ===== TAB 2: Product Performance =====
function TabProducts({ completed }: { completed: TikTokOrder[] }) {
    const skuMap: Record<string, { name: string; qty: number; revenue: number; orders: number }> = {};
    completed.forEach(o => { const sku = o.sellerSku || o.skuId; if (!skuMap[sku]) skuMap[sku] = { name: o.productName.substring(0, 60), qty: 0, revenue: 0, orders: 0 }; skuMap[sku].qty += o.quantity; skuMap[sku].revenue += o.subtotalAfterDiscount; skuMap[sku].orders++; });
    const products = Object.entries(skuMap).map(([sku, d]) => ({ sku, ...d, aov: d.orders > 0 ? d.revenue / d.orders : 0 })).sort((a, b) => b.revenue - a.revenue);
    const totalQty = products.reduce((s, p) => s + p.qty, 0);
    const totalRev = products.reduce((s, p) => s + p.revenue, 0);

    // Variant analysis
    const varMap: Record<string, number> = {};
    completed.forEach(o => { const v = o.variation || 'N/A'; varMap[v] = (varMap[v] || 0) + o.quantity; });
    const variants = Object.entries(varMap).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) : name, value }));

    const chartData = products.slice(0, 10).map(p => ({ name: p.sku, qty: p.qty, revenue: p.revenue / 1e6 }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tổng SKU</div><div className={styles.summaryCardValue}>{products.length}</div><div className={styles.summaryCardSub}>Sản phẩm bán được</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tổng SL bán</div><div className={styles.summaryCardValue}>{formatNumber(totalQty)}</div><div className={styles.summaryCardSub}>{(totalQty / Math.max(1, Object.keys(skuMap).length)).toFixed(1)} sp/SKU</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Doanh thu SP</div><div className={styles.summaryCardValue}>{formatShortCurrency(totalRev)}</div><div className={styles.summaryCardSub}>Từ đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 1 SKU</div><div className={styles.summaryCardValue} style={{ color: '#2dd4bf', fontSize: '1.1rem' }}>{products[0]?.sku || '-'}</div><div className={styles.summaryCardSub}>{products[0] ? `${products[0].qty} sp · ${formatShortCurrency(products[0].revenue)}` : ''}</div></div>
        </div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#2dd4bf' }} />Top 10 SKU theo Doanh thu</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={350}><BarChart data={chartData} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `${v}M`} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={80} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}M`, '']} /><Bar dataKey="revenue" name="Doanh thu (M)" fill="#2dd4bf" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Package size={18} style={{ color: '#818cf8' }} />Top Phân loại bán chạy</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={350}><BarChart data={variants} layout="vertical" margin={{ left: 100 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={100} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="value" name="Số lượng" fill="#818cf8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết theo SKU</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>#</th><th>SKU</th><th>Tên SP</th><th style={{ textAlign: 'right' }}>SL</th><th style={{ textAlign: 'right' }}>Đơn</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>AOV</th><th style={{ textAlign: 'right' }}>% DT</th></tr></thead><tbody>{products.slice(0, 20).map((p, i) => <tr key={i}><td style={{ fontWeight: 700, color: '#2dd4bf' }}>{i + 1}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td><td style={{ fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td><td style={{ textAlign: 'right' }}>{p.qty}</td><td style={{ textAlign: 'right' }}>{p.orders}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.aov)}</td><td style={{ textAlign: 'right' }}>{totalRev > 0 ? (p.revenue / totalRev * 100).toFixed(1) : 0}%</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 3: Regional =====
function TabRegional({ completed }: { completed: TikTokOrder[] }) {
    const provMap: Record<string, { count: number; revenue: number }> = {};
    completed.forEach(o => { const p = o.province || 'N/A'; if (!provMap[p]) provMap[p] = { count: 0, revenue: 0 }; provMap[p].count++; provMap[p].revenue += o.subtotalAfterDiscount; });
    const provinces = Object.entries(provMap).map(([name, d]) => ({ name, ...d, aov: d.count > 0 ? d.revenue / d.count : 0 })).sort((a, b) => b.count - a.count);
    const totalOrders = completed.length;
    const top5 = provinces.slice(0, 5);
    const top5Pct = totalOrders > 0 ? (top5.reduce((s, p) => s + p.count, 0) / totalOrders * 100) : 0;

    const chartData = provinces.slice(0, 15).map(p => ({ name: p.name.substring(0, 12), orders: p.count, revenue: p.revenue / 1e6 }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Số tỉnh/TP</div><div className={styles.summaryCardValue}>{provinces.length}</div><div className={styles.summaryCardSub}>Có đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 1</div><div className={styles.summaryCardValue} style={{ color: '#2dd4bf', fontSize: '1rem' }}>{provinces[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{provinces[0] ? `${provinces[0].count} đơn (${(provinces[0].count / totalOrders * 100).toFixed(0)}%)` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 5 chiếm</div><div className={styles.summaryCardValue}>{formatPercent(top5Pct)}</div><div className={styles.summaryCardSub}>tổng đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>AOV cao nhất</div><div className={styles.summaryCardValue}>{formatShortCurrency([...provinces].sort((a, b) => b.aov - a.aov)[0]?.aov || 0)}</div><div className={styles.summaryCardSub}>{[...provinces].sort((a, b) => b.aov - a.aov)[0]?.name || ''}</div></div>
        </div>
        <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><MapPin size={18} style={{ color: '#2dd4bf' }} />Top 15 Tỉnh/Thành phố</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={400}><BarChart data={chartData} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={80} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="orders" name="Số đơn" fill="#2dd4bf" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết theo Tỉnh/TP</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>#</th><th>Tỉnh/TP</th><th style={{ textAlign: 'right' }}>Đơn</th><th style={{ textAlign: 'right' }}>% Tổng</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>AOV</th></tr></thead><tbody>{provinces.slice(0, 25).map((p, i) => <tr key={i}><td style={{ fontWeight: 700, color: '#2dd4bf' }}>{i + 1}</td><td>{p.name}</td><td style={{ textAlign: 'right' }}>{p.count}</td><td style={{ textAlign: 'right' }}>{(p.count / totalOrders * 100).toFixed(1)}%</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.aov)}</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 4: Customer Behavior =====
function TabBehavior({ all, completed }: { all: TikTokOrder[]; completed: TikTokOrder[] }) {
    // Hourly
    const hourMap: Record<string, number> = {};
    completed.forEach(o => { const h = parseTikTokHour(o.createdTime); if (h) hourMap[h] = (hourMap[h] || 0) + 1; });
    const hourData = Array.from({ length: 24 }, (_, i) => { const h = String(i).padStart(2, '0'); return { hour: `${h}h`, orders: hourMap[h] || 0 }; });
    const peakHour = hourData.reduce((a, b) => b.orders > a.orders ? b : a, hourData[0]);

    // Payment methods
    const pmMap: Record<string, number> = {};
    all.forEach(o => { const m = o.paymentMethod || 'N/A'; pmMap[m] = (pmMap[m] || 0) + 1; });
    const pmData = Object.entries(pmMap).map(([name, value]) => ({ name: name.substring(0, 25), value })).sort((a, b) => b.value - a.value);

    // Carrier
    const carrierMap: Record<string, number> = {};
    all.forEach(o => { const c = o.shippingProviderName || 'N/A'; carrierMap[c] = (carrierMap[c] || 0) + 1; });
    const carrierData = Object.entries(carrierMap).map(([name, value]) => ({ name: name.substring(0, 20), value })).sort((a, b) => b.value - a.value);

    // Fulfillment type
    const fulfillMap: Record<string, number> = {};
    all.forEach(o => { const f = o.fulfillmentType || 'N/A'; fulfillMap[f] = (fulfillMap[f] || 0) + 1; });
    const fulfillData = Object.entries(fulfillMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Giờ cao điểm</div><div className={styles.summaryCardValue} style={{ color: '#f59e0b' }}>{peakHour.hour}</div><div className={styles.summaryCardSub}>{peakHour.orders} đơn</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>PTTT phổ biến</div><div className={styles.summaryCardValue} style={{ fontSize: '0.95rem' }}>{pmData[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{pmData[0] ? `${pmData[0].value} đơn (${(pmData[0].value / all.length * 100).toFixed(0)}%)` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>ĐV vận chuyển chính</div><div className={styles.summaryCardValue} style={{ fontSize: '0.9rem' }}>{carrierData[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{carrierData[0] ? `${carrierData[0].value} đơn` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Fulfillment</div><div className={styles.summaryCardValue} style={{ fontSize: '0.85rem' }}>{fulfillData[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{fulfillData[0]?.value || 0} đơn</div></div>
        </div>
        <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Clock size={18} style={{ color: '#f59e0b' }} />Phân bố Giờ đặt hàng</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={hourData} barCategoryGap="8%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="orders" name="Đơn" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><DollarSign size={18} style={{ color: '#818cf8' }} />Phương thức Thanh toán</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={pmData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>{pmData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} /></PieChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Package size={18} style={{ color: '#2dd4bf' }} />Đơn vị Vận chuyển</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={carrierData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>{carrierData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} /></PieChart></ResponsiveContainer></div></div>
        </div>
    </>);
}

// ===== TAB 5: Pricing Strategy =====
function TabPricing({ all, completed, cancelled }: { all: TikTokOrder[]; completed: TikTokOrder[]; cancelled: TikTokOrder[] }) {
    const totalOriginal = completed.reduce((s, o) => s + o.subtotalBeforeDiscount, 0);
    const totalSellerDisc = completed.reduce((s, o) => s + o.sellerDiscount, 0);
    const totalPlatformDisc = completed.reduce((s, o) => s + o.platformDiscount, 0);
    const totalSale = completed.reduce((s, o) => s + o.subtotalAfterDiscount, 0);
    const discountRate = totalOriginal > 0 ? (totalSellerDisc / totalOriginal * 100) : 0;

    // With vs without discount cancel rate
    const withDisc = all.filter(o => o.sellerDiscount > 0);
    const noDisc = all.filter(o => o.sellerDiscount === 0);
    const discCancelRate = withDisc.length > 0 ? (withDisc.filter(isCancelled).length / withDisc.length * 100) : 0;
    const noDiscCancelRate = noDisc.length > 0 ? (noDisc.filter(isCancelled).length / noDisc.length * 100) : 0;

    // Price range distribution
    const ranges = [{ range: '<100K', min: 0, max: 100000 }, { range: '100-200K', min: 100000, max: 200000 }, { range: '200-300K', min: 200000, max: 300000 }, { range: '300-500K', min: 300000, max: 500000 }, { range: '>500K', min: 500000, max: Infinity }];
    const priceData = ranges.map(r => ({ range: r.range, completed: completed.filter(o => o.subtotalAfterDiscount >= r.min && o.subtotalAfterDiscount < r.max).length, cancelled: cancelled.filter(o => o.subtotalAfterDiscount >= r.min && o.subtotalAfterDiscount < r.max).length }));

    // Category analysis
    const catMap: Record<string, { category: string; revenue: number; qty: number; orders: number }> = {};
    completed.forEach(o => {
        const cat = o.productCategory || 'Khác';
        if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, qty: 0, orders: 0 };
        catMap[cat].revenue += o.subtotalAfterDiscount;
        catMap[cat].qty += o.quantity;
        catMap[cat].orders++;
    });
    const categories = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Giá gốc tổng</div><div className={styles.summaryCardValue}>{formatShortCurrency(totalOriginal)}</div><div className={styles.summaryCardSub}>Trước giảm giá</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Seller trợ giá</div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{formatShortCurrency(totalSellerDisc)}</div><div className={styles.summaryCardSub}>{formatPercent(discountRate)} giá gốc</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Platform trợ giá</div><div className={styles.summaryCardValue} style={{ color: '#f97316' }}>{formatShortCurrency(totalPlatformDisc)}</div><div className={styles.summaryCardSub}>{formatPercent(totalOriginal > 0 ? totalPlatformDisc / totalOriginal * 100 : 0)} giá gốc</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Margin ước tính</div><div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatPercent(totalOriginal > 0 ? totalSale / totalOriginal * 100 : 0)}</div><div className={styles.summaryCardSub}>Thực nhận / Giá gốc</div></div>
        </div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#818cf8' }} />Phân bố Giá bán vs Tỷ lệ hủy</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={priceData} barCategoryGap="15%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="completed" name="Hoàn thành" fill="#22c55e" radius={[4, 4, 0, 0]} /><Bar dataKey="cancelled" name="Hủy" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Tag size={18} style={{ color: '#f59e0b' }} />Hiệu quả Trợ giá</h3><div className={styles.feeGrid}><div className={styles.feeItem}><span className={styles.feeLabel}>Có trợ giá</span><span className={styles.feeValue}>{withDisc.length} đơn · Hủy {formatPercent(discCancelRate)}</span></div><div className={styles.feeItem}><span className={styles.feeLabel}>Không trợ giá</span><span className={styles.feeValue}>{noDisc.length} đơn · Hủy {formatPercent(noDiscCancelRate)}</span></div><div className={`${styles.feeItem} ${styles.feeTotal}`}><span className={styles.feeLabel}>Kết luận</span><span className={styles.feeValue} style={{ color: discCancelRate < noDiscCancelRate ? '#22c55e' : '#ef4444' }}>{discCancelRate < noDiscCancelRate ? '✅ Trợ giá giúp giảm hủy' : '⚠️ Trợ giá chưa hiệu quả giảm hủy'}</span></div></div></div>
        </div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Doanh thu theo Danh mục</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>#</th><th>Danh mục</th><th style={{ textAlign: 'right' }}>Đơn</th><th style={{ textAlign: 'right' }}>SL</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>AOV</th></tr></thead><tbody>{categories.slice(0, 15).map((c, i) => <tr key={i}><td style={{ fontWeight: 700, color: '#2dd4bf' }}>{i + 1}</td><td>{c.category}</td><td style={{ textAlign: 'right' }}>{c.orders}</td><td style={{ textAlign: 'right' }}>{c.qty}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.orders > 0 ? c.revenue / c.orders : 0)}</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 6: Returns =====
function TabReturns({ all }: { all: TikTokOrder[] }) {
    const returned = all.filter(isReturned);
    const totalReturnValue = returned.reduce((s, o) => s + o.orderRefundAmount, 0);
    const completedOrders = all.filter(isCompleted);
    const returnRate = completedOrders.length > 0 ? (returned.length / completedOrders.length * 100) : 0;

    // Products with most returns
    const retSkuMap: Record<string, { sku: string; name: string; count: number; value: number }> = {};
    returned.forEach(o => { const sku = o.sellerSku || o.skuId; if (!retSkuMap[sku]) retSkuMap[sku] = { sku, name: o.productName.substring(0, 50), count: 0, value: 0 }; retSkuMap[sku].count++; retSkuMap[sku].value += o.orderRefundAmount; });
    const retProducts = Object.values(retSkuMap).sort((a, b) => b.count - a.count);

    // Cancel by breakdown
    const cancelByMap: Record<string, number> = {};
    returned.forEach(o => { const cb = o.cancelBy || 'N/A'; cancelByMap[cb] = (cancelByMap[cb] || 0) + 1; });
    const cancelByData = Object.entries(cancelByMap).map(([name, value]) => ({ name, value }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Đơn trả hàng</div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{returned.length}</div><div className={styles.summaryCardSub}>Tổng yêu cầu</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Giá trị hoàn</div><div className={styles.summaryCardValue}>{formatShortCurrency(totalReturnValue)}</div><div className={styles.summaryCardSub}>Tổng refund</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tỷ lệ trả hàng</div><div className={styles.summaryCardValue}>{formatPercent(returnRate)} {returnRate < 5 ? '✅' : '⚠️'}</div><div className={styles.summaryCardSub}>Mục tiêu: dưới 5%</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>TB giá trị trả</div><div className={styles.summaryCardValue}>{formatShortCurrency(returned.length > 0 ? totalReturnValue / returned.length : 0)}</div><div className={styles.summaryCardSub}>mỗi đơn trả</div></div>
        </div>
        {retProducts.length > 0 && <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><RefreshCw size={18} style={{ color: '#ef4444' }} />SP bị trả nhiều nhất</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={250}><BarChart data={retProducts.slice(0, 8)} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="sku" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={80} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="count" name="Số đơn trả" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>}
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết đơn trả hàng</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>Mã đơn</th><th>SKU</th><th>Tên SP</th><th>Loại</th><th style={{ textAlign: 'right' }}>Giá trị hoàn</th><th>Ngày tạo</th></tr></thead><tbody>{returned.map((o, i) => <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.sellerSku || o.skuId}</td><td style={{ fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.productName.substring(0, 40)}</td><td><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: o.cancelReturnType === 'Return' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: o.cancelReturnType === 'Return' ? '#ef4444' : '#f59e0b' }}>{o.cancelReturnType || 'Return'}</span></td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(o.orderRefundAmount)}</td><td style={{ fontSize: '0.8rem' }}>{o.createdTime}</td></tr>)}</tbody></table></div></div>
    </>);
}
